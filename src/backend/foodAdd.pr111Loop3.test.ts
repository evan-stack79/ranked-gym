/**
 * PR #111 boucle 3 — A (quantityRules) + QA + Architecte + croisé d33b724.
 * FakeDb seulement ; aucun serveur réel.
 */
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  pickCatalogNutrient,
  sanitizeLegacyMealNutrient,
  sanitizeLegacyQuantity,
  sanitizePer100gNutrients,
} from '../../convex/lib/foodAddUpsertSanitize'
import { FOOD_ADD_QUANTITY_INVALID } from '../../convex/lib/foodAddQuantity'
import { addFoodSnapshot } from '../../convex/foodAdd'
import { upsertFoodSelection, upsertMeal } from '../../convex/nutrition'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'nutrition_state'
  | 'nutrition_meals'
  | 'nutrition_food_catalog'
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

const SESSION = 'session-pr111-loop3'
const USER_ID = 'user-pr111-loop3'

function handlerOf(fn: unknown) {
  return (fn as { _handler: (c: unknown, a: unknown) => Promise<unknown> })._handler
}

function mutationCtx(db: FakeDb) {
  return {
    db,
    storage: {
      getUrl: async () => null,
    },
  }
}

async function seedAuth(db: FakeDb, profile: Record<string, unknown> = { age: 30 }) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId: USER_ID,
    email: 'loop3@example.com',
    emailNorm: 'loop3@example.com',
    displayName: 'Loop3',
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
    profileJson: profile,
    updatedAt: now,
  })
}

function baseMealArgs(overrides: Record<string, unknown> = {}) {
  return {
    sessionToken: SESSION,
    mealId: 'meal-1',
    dateKey: '2026-10-15',
    mealType: 'lunch',
    name: 'Riz',
    calories: 200,
    proteinG: 4,
    carbsG: 40,
    fatG: 1,
    updatedAt: Date.now(),
    ...overrides,
  }
}

async function callUpsertMeal(db: FakeDb, overrides: Record<string, unknown> = {}) {
  return handlerOf(upsertMeal)(mutationCtx(db), baseMealArgs(overrides))
}

async function callUpsertFoodSelection(
  db: FakeDb,
  overrides: Record<string, unknown> = {},
) {
  return handlerOf(upsertFoodSelection)(mutationCtx(db), {
    sessionToken: SESSION,
    name: 'Pomme',
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 14,
    fatPer100g: 0.2,
    source: 'manual',
    selectionEventId: 'sel-1',
    ...overrides,
  })
}

async function callAddFoodSnapshot(db: FakeDb, overrides: Record<string, unknown> = {}) {
  return handlerOf(addFoodSnapshot)(mutationCtx(db), {
    sessionToken: SESSION,
    mealId: 'snap-1',
    dateKey: '2026-10-15',
    mealType: 'lunch',
    name: 'Pomme',
    portionLabel: '100 g',
    grams: 100,
    updatedAt: Date.now(),
    ...overrides,
  })
}

describe('A — quantityRules + legacy ne refuse rien', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('A.1 legacy sans quantityRules : 120,5 g accepté tel quel', async () => {
    const result = (await callUpsertMeal(db, {
      mealId: 'a1',
      grams: 120.5,
      calories: 450,
    })) as { applied: boolean }
    expect(result.applied).toBe(true)
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'a1')!
    expect(row.grams).toBe(120.5)
    expect(row.calories).toBe(450)
  })

  it('A.2 quantityRules:v3 rejette 0 g / 2500 g / 1,5 g', async () => {
    for (const grams of [0, 2500, 1.5]) {
      await expect(
        callUpsertMeal(db, {
          mealId: `v3-bad-${grams}`,
          grams,
          quantityRules: 'v3',
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ConvexError)
        expect((err as ConvexError<{ code: string }>).data.code).toBe(
          FOOD_ADD_QUANTITY_INVALID,
        )
        return true
      })
    }
  })

  it('A.3 quantityRules:v3 accepte 200 g et réécrit portionLabel', async () => {
    const result = (await callUpsertMeal(db, {
      mealId: 'a3',
      grams: 200,
      portionLabel: 'client stale',
      quantityRules: 'v3',
      calories: 9999,
    })) as { applied: boolean; portionLabel?: string }
    expect(result.applied).toBe(true)
    expect(result.portionLabel).toBe('200 g')
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'a3')!
    expect(row.grams).toBe(200)
    expect(row.portionLabel).toBe('200 g')
    expect(row.entrySource).toBe('v3')
    // Création V3 sans ligne existante : kcal client ignorés → null (pas d’existant).
    expect(row.calories).toBeNull()
  })

  it('A.4 0 g sans quantityRules → accepté, grams non enregistré', async () => {
    const result = (await callUpsertMeal(db, {
      mealId: 'a4-zero',
      grams: 0,
      calories: 100,
    })) as { applied: boolean }
    expect(result.applied).toBe(true)
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'a4-zero')!
    expect(row.grams).toBeUndefined()
    expect(row.calories).toBe(100)
  })
})

describe('QA 1 + croisé d33b724 — upsertMeal/upsertFoodSelection sans quantityRules → 0 refus', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('file typique d33b724 : tous acceptés (0 refus)', async () => {
    const payloads: Array<Record<string, unknown>> = [
      { mealId: 'q-120.5', grams: 120.5, calories: 200 },
      { mealId: 'q-2500', grams: 2500, calories: 200 },
      { mealId: 'q-3000', grams: 3000, calories: 200 },
      { mealId: 'q-0.1', grams: 0.1, calories: 200 },
      { mealId: 'q-0', grams: 0, calories: 200 },
      { mealId: 'q-neg5', grams: -5, calories: 200 },
      { mealId: 'q-nan', grams: Number.NaN, calories: 200 },
      { mealId: 'q-150-3', grams: 150, pieces: 3, calories: 200 },
      { mealId: 'q-600-60', grams: 600, pieces: 60, calories: 200 },
      { mealId: 'q-40-1.3', grams: 40, pieces: 1.3, calories: 200 },
      { mealId: 'q-kcal-neg', grams: 100, calories: -3, proteinG: -3 },
    ]

    const refusals: string[] = []
    for (const p of payloads) {
      try {
        const r = (await callUpsertMeal(db, p)) as { applied: boolean }
        expect(r.applied).toBe(true)
      } catch (e) {
        refusals.push(String(p.mealId))
        void e
      }
    }
    expect(refusals).toEqual([])

    const zero = db.table('nutrition_meals').find((r) => r.mealId === 'q-0')!
    expect(zero.grams).toBeUndefined()

    const neg = db.table('nutrition_meals').find((r) => r.mealId === 'q-neg5')!
    expect(neg.grams).toBeUndefined()

    const nanRow = db.table('nutrition_meals').find((r) => r.mealId === 'q-nan')!
    expect(nanRow.grams).toBeUndefined()

    const both = db.table('nutrition_meals').find((r) => r.mealId === 'q-150-3')!
    expect(both.grams).toBe(150)
    expect(both.pieces).toBe(3)

    const kcalNeg = db.table('nutrition_meals').find((r) => r.mealId === 'q-kcal-neg')!
    expect(kcalNeg.calories).toBeNull()
    expect(kcalNeg.proteinG).toBeNull()
    expect(kcalNeg.grams).toBe(100)
  })

  it('macros 60+30+20 → 3 null ; 900 kcal ok / 901 → null', async () => {
    await callUpsertFoodSelection(db, {
      name: 'MacroSum',
      selectionEventId: 'macro-sum',
      caloriesPer100g: 400,
      proteinPer100g: 60,
      carbsPer100g: 30,
      fatPer100g: 20,
    })
    const sumRow = db.table('nutrition_food_catalog').find((r) =>
      String(r.foodKey).includes('macrosum'),
    )!
    expect(sumRow.proteinPer100g).toBeNull()
    expect(sumRow.carbsPer100g).toBeNull()
    expect(sumRow.fatPer100g).toBeNull()
    expect(sumRow.caloriesPer100g).toBe(400)

    await callUpsertFoodSelection(db, {
      name: 'Fat900',
      selectionEventId: 'fat-900',
      caloriesPer100g: 900,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 100,
    })
    const ok900 = db.table('nutrition_food_catalog').find((r) =>
      String(r.foodKey).includes('fat900'),
    )!
    expect(ok900.caloriesPer100g).toBe(900)

    await callUpsertFoodSelection(db, {
      name: 'Fat901',
      selectionEventId: 'fat-901',
      caloriesPer100g: 901,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 100,
    })
    const bad901 = db.table('nutrition_food_catalog').find((r) =>
      String(r.foodKey).includes('fat901'),
    )!
    expect(bad901.caloriesPer100g).toBeNull()
  })
})

describe('Architecte PC — upsertMeal V3 ignore client + catalog client', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('1. V3 81 kcal renvoyé avec calories null → 81 restent', async () => {
    await db.insert('off_product_nutrients', {
      offCode: '123',
      caloriesPer100g: 54,
      proteinPer100g: 4,
      carbsPer100g: 6,
      fatPer100g: 1,
      servingSize: '100 g',
      servingGrams: 100,
      updatedAt: Date.now(),
    })
    await callAddFoodSnapshot(db, {
      mealId: 'arch-81',
      offCode: '123',
      grams: 150,
      selectionEventId: 'ev-81',
    })
    const afterSnap = db.table('nutrition_meals').find((r) => r.mealId === 'arch-81')!
    expect(afterSnap.calories).toBe(81)
    expect(afterSnap.entrySource).toBe('v3')

    await callUpsertMeal(db, {
      mealId: 'arch-81',
      grams: 150,
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      // pas de quantityRules — marqueur ligne gagne
      updatedAt: Date.now() + 1,
    })
    const afterUpsert = db.table('nutrition_meals').find((r) => r.mealId === 'arch-81')!
    expect(afterUpsert.calories).toBe(81)
  })

  it('2. ligne V3 + upsert sans quantityRules + 9999 kcal → kcal inchangées', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'arch-v3',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Yaourt',
      calories: 81,
      proteinG: 6,
      carbsG: 9,
      fatG: 1.5,
      grams: 150,
      entrySource: 'v3',
      updatedAt: 1,
      schemaVersion: 1,
    })
    await callUpsertMeal(db, {
      mealId: 'arch-v3',
      grams: 150,
      calories: 9999,
      proteinG: -3,
      updatedAt: 2,
    })
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'arch-v3')!
    expect(row.calories).toBe(81)
    expect(row.proteinG).toBe(6)
  })

  it('3. repas ancien 120,5 g + 450 kcal ; proteinG −3 → null', async () => {
    await callUpsertMeal(db, {
      mealId: 'arch-legacy',
      grams: 120.5,
      calories: 450,
      proteinG: -3,
    })
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'arch-legacy')!
    expect(row.grams).toBe(120.5)
    expect(row.calories).toBe(450)
    expect(row.proteinG).toBeNull()
  })

  it('4. upsertFoodSelection Pomme 9999 → addFoodSnapshot kcal null', async () => {
    await callUpsertFoodSelection(db, {
      name: 'Pomme',
      caloriesPer100g: 9999,
      proteinPer100g: 500,
      carbsPer100g: 10,
      fatPer100g: 10,
      selectionEventId: 'pomme-client',
    })
    const catalog = db.table('nutrition_food_catalog')[0]!
    expect(catalog.nutrientsSource).toBe('client')
    expect(catalog.caloriesPer100g).toBeNull() // >900 → null

    await callAddFoodSnapshot(db, {
      mealId: 'pomme-snap',
      name: 'Pomme',
      grams: 100,
      selectionEventId: 'pomme-snap-ev',
    })
    const meal = db.table('nutrition_meals').find((r) => r.mealId === 'pomme-snap')!
    expect(meal.calories).toBeNull()
  })

  it('6. 3 essais même mealId → selectedCount +1 seulement', async () => {
    await db.insert('off_product_nutrients', {
      offCode: '999',
      caloriesPer100g: 100,
      proteinPer100g: 1,
      carbsPer100g: 10,
      fatPer100g: 1,
      servingSize: '100 g',
      servingGrams: 100,
      updatedAt: Date.now(),
    })
    for (let i = 0; i < 3; i++) {
      await callAddFoodSnapshot(db, {
        mealId: 'same-meal',
        offCode: '999',
        name: 'Biscuit',
        grams: 50,
        selectionEventId: 'same-ev',
        updatedAt: Date.now() + i,
      })
    }
    expect(db.table('nutrition_meals').filter((r) => r.mealId === 'same-meal')).toHaveLength(1)
    const catalog = db.table('nutrition_food_catalog').find((r) => r.barcode === '999')!
    expect(catalog.selectedCount).toBe(1)
  })

  it('V3 grams 120→200 : proportion 90→150 kcal', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'scale',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Yaourt',
      calories: 90,
      proteinG: 6,
      carbsG: 9,
      fatG: 1.5,
      grams: 120,
      entrySource: 'v3',
      updatedAt: 1,
      schemaVersion: 1,
    })
    await callUpsertMeal(db, {
      mealId: 'scale',
      grams: 200,
      quantityRules: 'v3',
      calories: 9999,
      updatedAt: 2,
    })
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'scale')!
    expect(row.calories).toBe(150)
    expect(row.grams).toBe(200)
    expect(row.portionLabel).toBe('200 g')
  })
})

describe('QA 4 — pickCatalogNutrient garde vrai 0', () => {
  it('pickCatalogNutrient(null, 0) === 0', () => {
    expect(pickCatalogNutrient(null, 0)).toBe(0)
    expect(pickCatalogNutrient(undefined, 0)).toBe(0)
    expect(pickCatalogNutrient(539, 0)).toBe(539)
  })
})

describe('sanitize helpers — legacy ignore / per100g guards', () => {
  it('sanitizeLegacyQuantity : 0 / négatif / NaN / inf → undefined', () => {
    expect(sanitizeLegacyQuantity(0)).toBeUndefined()
    expect(sanitizeLegacyQuantity(-5)).toBeUndefined()
    expect(sanitizeLegacyQuantity(Number.NaN)).toBeUndefined()
    expect(sanitizeLegacyQuantity(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(sanitizeLegacyQuantity(120.5)).toBe(120.5)
  })

  it('sanitizeLegacyMealNutrient : négatif / NaN → null ; 0 gardé', () => {
    expect(sanitizeLegacyMealNutrient(-3)).toBeNull()
    expect(sanitizeLegacyMealNutrient(Number.NaN)).toBeNull()
    expect(sanitizeLegacyMealNutrient(0)).toBe(0)
    expect(sanitizeLegacyMealNutrient(450)).toBe(450)
  })

  it('sanitizePer100gNutrients : somme macros >100 → 3 null', () => {
    const r = sanitizePer100gNutrients({
      caloriesPer100g: 400,
      proteinPer100g: 60,
      carbsPer100g: 30,
      fatPer100g: 20,
    })
    expect(r.proteinPer100g).toBeNull()
    expect(r.carbsPer100g).toBeNull()
    expect(r.fatPer100g).toBeNull()
    expect(r.caloriesPer100g).toBe(400)
  })
})
