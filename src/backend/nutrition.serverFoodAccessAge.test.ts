/**
 * Serveur food-add access : âge manquant n’est plus un refus ;
 * mineur (<18) et TCA restent refusés sur upsertMeal + OFF lookups.
 *
 * FakeDb + handlers réels (pas de lecture source). fetch OFF stubbé localement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '../../convex/auth'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  FOOD_ADD_ACCESS_DENIED_MINOR,
  FOOD_ADD_ACCESS_DENIED_TCA,
} from '../../convex/lib/foodAddAccess'
import {
  checkFoodAddAccess,
  fetchOpenFoodFactsByBarcode,
  searchOpenFoodFacts,
  upsertMeal,
} from '../../convex/nutrition'

type TableName = 'auth_users' | 'auth_sessions' | 'nutrition_state' | 'nutrition_meals'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    nutrition_state: [],
    nutrition_meals: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  get(id: string) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }

  patch(id: string, patch: Record<string, unknown>) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (!row) continue
      Object.assign(row, patch)
      return Promise.resolve()
    }
    throw new Error(`Row not found: ${id}`)
  }

  table(name: TableName): StoredRow[] {
    return this.rows[name]
  }
}

class FakeQuery {
  private filtered: StoredRow[]

  constructor(rows: StoredRow[]) {
    this.filtered = [...rows]
  }

  withIndex(
    _indexName: string,
    fn: (q: {
      eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown }
    }) => unknown,
  ) {
    const filters: Array<{ field: string; value: unknown }> = []
    const rangeBuilder = {
      eq: (field: string, value: unknown) => {
        filters.push({ field, value })
        return rangeBuilder
      },
    }
    fn(rangeBuilder)
    this.filtered = this.filtered.filter((row) =>
      filters.every((filter) => row[filter.field] === filter.value),
    )
    return this
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }
}

const SESSION = 'session-food-access-age'
const USER_ID = 'user-food-access-age'

async function seedUser(db: FakeDb, profileJson: unknown) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId: USER_ID,
    email: 'food-access@example.com',
    emailNorm: 'food-access@example.com',
    displayName: 'Food',
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId: USER_ID,
    tokenHash: await hashToken(SESSION),
    createdAt: now,
    expiresAt: now + 86_400_000,
  })
  await db.insert('nutrition_state', {
    userId: USER_ID,
    profileJson,
    updatedAt: now,
  })
}

function mutationCtx(db: FakeDb) {
  return { db }
}

type HandlerFn = (c: unknown, a: unknown) => Promise<unknown>

function handlerOf(fn: unknown): HandlerFn {
  return (fn as { _handler: HandlerFn })._handler
}

function actionCtx(db: FakeDb) {
  const qCtx = { db }
  // api.* refs are empty Proxies (new object each access) — dispatch by call order
  // as in assertActionSession: getSession → checkFoodAddAccess → (optional image cache).
  let queryCall = 0
  return {
    db,
    runQuery: async (_ref: unknown, args: { sessionToken: string }) => {
      queryCall += 1
      if (queryCall === 1) return handlerOf(getSession)(qCtx, args)
      if (queryCall === 2) return handlerOf(checkFoodAddAccess)(qCtx, args)
      return null
    },
    runAction: async () => null,
  }
}

async function callUpsertMeal(db: FakeDb) {
  return handlerOf(upsertMeal)(mutationCtx(db), {
    sessionToken: SESSION,
    mealId: 'meal-age-test',
    dateKey: '2026-10-15',
    mealType: 'lunch',
    name: 'Riz',
    calories: 200,
    proteinG: 4,
    carbsG: 40,
    fatG: 1,
    updatedAt: Date.now(),
  }) as Promise<{ applied: boolean; stale: boolean; updatedAt: number }>
}

async function callFetchBarcode(db: FakeDb) {
  return handlerOf(fetchOpenFoodFactsByBarcode)(actionCtx(db), {
    sessionToken: SESSION,
    barcode: '3017620422003',
  })
}

async function callSearchOff(db: FakeDb) {
  return handlerOf(searchOpenFoodFacts)(actionCtx(db), {
    sessionToken: SESSION,
    term: 'riz',
    limit: 5,
  })
}

describe('nutrition server food access — âge manquant / mineur / TCA', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v2/product/')) {
          return new Response(
            JSON.stringify({
              status: 1,
              product: {
                code: '3017620422003',
                product_name_fr: 'Nutella',
                brands: 'Ferrero',
                nutriments: {
                  'energy-kcal_100g': 539,
                  proteins_100g: 6,
                  carbohydrates_100g: 57,
                  fat_100g: 31,
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (url.includes('/cgi/search.pl')) {
          return new Response(
            JSON.stringify({
              products: [
                {
                  code: '1',
                  product_name_fr: 'Riz basmati',
                  brands: 'Test',
                  nutriments: { 'energy-kcal_100g': 350 },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        throw new Error(`Unexpected fetch in test: ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('(a) profil sans âge : upsertMeal + fetch barcode + search OFF réussissent', async () => {
    const db = new FakeDb()
    await seedUser(db, { declaredEatingDisorder: false })

    const meal = await callUpsertMeal(db)
    expect(meal.applied).toBe(true)
    expect(db.table('nutrition_meals')).toHaveLength(1)

    const product = (await callFetchBarcode(db)) as { nom: string; barcode: string }
    expect(product.nom).toMatch(/Nutella/i)
    expect(product.barcode).toBe('3017620422003')

    const hits = (await callSearchOff(db)) as Array<{ nom: string }>
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.nom).toMatch(/Riz/i)
  })

  it('(b) âge 16 : upsertMeal + fetch barcode + search OFF refusés (mineur)', async () => {
    const db = new FakeDb()
    await seedUser(db, { age: 16, declaredEatingDisorder: false })

    await expect(callUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_MINOR)
    await expect(callFetchBarcode(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_MINOR)
    await expect(callSearchOff(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_MINOR)
    expect(db.table('nutrition_meals')).toHaveLength(0)
  })

  it('(c) TCA déclaré : upsertMeal + fetch barcode + search OFF refusés', async () => {
    const db = new FakeDb()
    await seedUser(db, {
      age: 30,
      healthAnswer: 'situations',
      declaredEatingDisorder: true,
    })

    await expect(callUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_TCA)
    await expect(callFetchBarcode(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_TCA)
    await expect(callSearchOff(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_TCA)
    expect(db.table('nutrition_meals')).toHaveLength(0)
  })
})
