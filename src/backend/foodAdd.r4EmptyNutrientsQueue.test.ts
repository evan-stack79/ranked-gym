/**
 * R4-02 (c) — file V3 OFF : repas kcal+macros vides, seul mealType change →
 * serveur garde null partout (toBeNull). FakeDb ; pas de réseau.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import { upsertMeal } from '../../convex/nutrition'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'nutrition_state'
  | 'nutrition_meals'
  | 'nutrition_food_catalog'
  | 'nutrition_water_entries'
  | 'nutrition_day_state'
  | 'off_product_nutrients'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    nutrition_state: [],
    nutrition_meals: [],
    nutrition_food_catalog: [],
    nutrition_water_entries: [],
    nutrition_day_state: [],
    off_product_nutrients: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table] ?? [])
  }

  get(id: string) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((c) => c._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }

  patch(id: string, patch: Record<string, unknown>) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((c) => c._id === id)
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
      filters.every((f) => row[f.field] === f.value),
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

const SESSION = 'session-r4'
const USER_ID = 'user-r4'

function handlerOf(fn: unknown) {
  return (fn as { _handler: (c: unknown, a: unknown) => Promise<unknown> })._handler
}

function mutationCtx(db: FakeDb) {
  return { db, storage: { getUrl: async () => null } }
}

async function seedAuth(db: FakeDb) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId: USER_ID,
    email: 'r4@example.com',
    emailNorm: 'r4@example.com',
    displayName: 'R4',
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
    profileJson: { age: 30 },
    updatedAt: now,
  })
}

describe('R4-02 — file V3 OFF garde null (kcal + macros)', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('même repas vide, seul mealType change via file → serveur toBeNull partout', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'plat-vide',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Plat sans kcal',
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      grams: 200,
      updatedAt: 10,
      schemaVersion: 1,
    })

    // Payload file = pushConvexMeal V3 OFF (pas de quantityRules) après EditMealSheet.
    const result = (await handlerOf(upsertMeal)(mutationCtx(db), {
      sessionToken: SESSION,
      mealId: 'plat-vide',
      dateKey: '2026-10-15',
      mealType: 'dinner',
      name: 'Plat sans kcal',
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      grams: 200,
      updatedAt: 20,
    })) as { applied: boolean }

    expect(result.applied).toBe(true)
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'plat-vide')!
    expect(row.mealType).toBe('dinner')
    expect(row.calories).toBeNull()
    expect(row.proteinG).toBeNull()
    expect(row.carbsG).toBeNull()
    expect(row.fatG).toBeNull()
    expect(row.calories).not.toBe(0)
    expect(row.proteinG).not.toBe(0)
  })
})
