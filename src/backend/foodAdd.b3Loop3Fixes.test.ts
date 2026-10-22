/**
 * B3-01..06 — corrections boucle 3 QA sur 5785850.
 * FakeDb seulement ; pas de réseau.
 */
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import { FOOD_ADD_QUANTITY_INVALID } from '../../convex/lib/foodAddQuantity'
import { addFoodSnapshot } from '../../convex/foodAdd'
import { listJournalEntries, upsertFoodSelection, upsertMeal } from '../../convex/nutrition'

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

const SESSION = 'session-b3'
const USER_ID = 'user-b3'

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
    email: 'b3@example.com',
    emailNorm: 'b3@example.com',
    displayName: 'B3',
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

type JournalMeal = {
  mealId: string
  calories: number | null
  proteinG?: number | null
  grams?: number
  pieces?: number
  portionLabel?: string
  entrySource?: string
}

async function listMeals(db: FakeDb): Promise<JournalMeal[]> {
  const snap = (await handlerOf(listJournalEntries)(mutationCtx(db), {
    sessionToken: SESSION,
  })) as { meals: JournalMeal[] }
  return snap.meals
}

describe('B3-01 — listJournalEntries renvoie entrySource / portionLabel / pieces', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('kcal vide reste null (jamais 0) + entrySource / portionLabel', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'soup-null',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Soupe',
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      grams: 300,
      portionLabel: '300 g',
      entrySource: 'v3',
      createdAt: 1,
      updatedAt: 1,
      schemaVersion: 1,
    })
    const soup = (await listMeals(db)).find((m) => m.mealId === 'soup-null')!
    expect(soup.calories).toBeNull()
    expect(soup.proteinG).toBeNull()
    expect(soup.entrySource).toBe('v3')
    expect(soup.portionLabel).toBe('300 g')
  })

  it('vrai 0 kcal reste 0 + entrySource', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'eau-0',
      dateKey: '2026-10-15',
      mealType: 'snack',
      name: 'Eau',
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      grams: 250,
      portionLabel: '250 g',
      entrySource: 'v3',
      createdAt: 2,
      updatedAt: 2,
      schemaVersion: 1,
    })
    const eau = (await listMeals(db)).find((m) => m.mealId === 'eau-0')!
    expect(eau.calories).toBe(0)
    expect(eau.proteinG).toBe(0)
    expect(eau.entrySource).toBe('v3')
  })

  it('150 g + pieces + entrySource / portionLabel survivent', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'yaourt-150',
      dateKey: '2026-10-15',
      mealType: 'breakfast',
      name: 'Yaourt',
      calories: 81,
      proteinG: 6,
      grams: 150,
      pieces: 1,
      portionLabel: '150 g',
      entrySource: 'v3',
      createdAt: 3,
      updatedAt: 3,
      schemaVersion: 1,
    })
    const yaourt = (await listMeals(db)).find((m) => m.mealId === 'yaourt-150')!
    expect(yaourt.grams).toBe(150)
    expect(yaourt.pieces).toBe(1)
    expect(yaourt.calories).toBe(81)
    expect(yaourt.entrySource).toBe('v3')
    expect(yaourt.portionLabel).toBe('150 g')
  })

  it('repro QA : yaourt 150 g V3 + upsert 2500 g avec quantityRules → refus visible', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'yaourt-qa',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Yaourt',
      calories: 81,
      grams: 150,
      portionLabel: '150 g',
      entrySource: 'v3',
      createdAt: 1,
      updatedAt: 10,
      schemaVersion: 1,
    })
    await expect(
      handlerOf(upsertMeal)(mutationCtx(db), {
        sessionToken: SESSION,
        mealId: 'yaourt-qa',
        dateKey: '2026-10-15',
        mealType: 'lunch',
        name: 'Yaourt',
        calories: null,
        grams: 2500,
        quantityRules: 'v3',
        updatedAt: 20,
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ConvexError)
      expect((err as ConvexError<{ code: string }>).data.code).toBe(FOOD_ADD_QUANTITY_INVALID)
      return true
    })
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'yaourt-qa')!
    expect(row.grams).toBe(150)
    expect(row.calories).toBe(81)
  })
})

describe('B3-02 — catalogue client conservé si serveur ne connaît pas l’aliment', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('Huile 884 kcal client reste 884 après addFoodSnapshot inconnu ; A1 inchangée', async () => {
    await handlerOf(upsertFoodSelection)(mutationCtx(db), {
      sessionToken: SESSION,
      name: 'Huile',
      caloriesPer100g: 884,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 100,
      source: 'manual',
      selectionEventId: 'huile-sel',
    })
    const before = db.table('nutrition_food_catalog')[0]!
    expect(before.caloriesPer100g).toBe(884)
    expect(before.nutrientsSource).toBe('client')

    await handlerOf(addFoodSnapshot)(mutationCtx(db), {
      sessionToken: SESSION,
      mealId: 'huile-snap',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Huile',
      portionLabel: '10 g',
      grams: 10,
      selectionEventId: 'huile-ev',
      updatedAt: Date.now(),
    })

    const after = db.table('nutrition_food_catalog')[0]!
    expect(after.caloriesPer100g).toBe(884)
    expect(after.fatPer100g).toBe(100)
    expect(after.nutrientsSource).toBe('client')

    const meal = db.table('nutrition_meals').find((r) => r.mealId === 'huile-snap')!
    // A1 : catalogue client ne nourrit pas V3 → kcal null.
    expect(meal.calories).toBeNull()
    expect(meal.entrySource).toBe('v3')
  })

  it('valeur vide entrante n’écrase pas une valeur catalogue connue', async () => {
    await handlerOf(upsertFoodSelection)(mutationCtx(db), {
      sessionToken: SESSION,
      name: 'Beurre',
      caloriesPer100g: 717,
      proteinPer100g: 0.5,
      carbsPer100g: 0.1,
      fatPer100g: 81,
      source: 'manual',
      selectionEventId: 'beurre-1',
    })
    await handlerOf(addFoodSnapshot)(mutationCtx(db), {
      sessionToken: SESSION,
      mealId: 'beurre-snap',
      dateKey: '2026-10-15',
      mealType: 'breakfast',
      name: 'Beurre',
      portionLabel: '10 g',
      grams: 10,
      selectionEventId: 'beurre-ev',
      updatedAt: Date.now(),
    })
    const cat = db.table('nutrition_food_catalog')[0]!
    expect(cat.caloriesPer100g).toBe(717)
    expect(cat.proteinPer100g).toBe(0.5)
    expect(cat.nutrientsSource).toBe('client')
  })
})

describe('B3-03 — portionLabel réécrit quand grammes V3 changent (ancien chemin)', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('120→200 g sans quantityRules : portionLabel « 200 g »', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'label-scale',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Riz',
      calories: 72,
      proteinG: 2,
      grams: 120,
      portionLabel: '120 g',
      entrySource: 'v3',
      updatedAt: 1,
      schemaVersion: 1,
    })
    const result = (await handlerOf(upsertMeal)(mutationCtx(db), {
      sessionToken: SESSION,
      mealId: 'label-scale',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Riz',
      calories: 5,
      grams: 200,
      portionLabel: '120 g',
      updatedAt: 2,
    })) as { applied: boolean; portionLabel?: string }
    expect(result.applied).toBe(true)
    expect(result.portionLabel).toBe('200 g')
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'label-scale')!
    expect(row.grams).toBe(200)
    expect(row.portionLabel).toBe('200 g')
    expect(row.calories).toBe(120)
  })
})

describe('B3-04 — stale avant vérif quantité', () => {
  let db: FakeDb

  beforeEach(async () => {
    db = new FakeDb()
    await seedAuth(db)
  })

  it('envoi plus ancien + quantityRules v3 + 2500 g → stale, jamais QUANTITY_INVALID', async () => {
    await db.insert('nutrition_meals', {
      userId: USER_ID,
      mealId: 'stale-qty',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Pain',
      calories: 100,
      grams: 100,
      entrySource: 'v3',
      updatedAt: 1000,
      schemaVersion: 1,
    })
    const result = (await handlerOf(upsertMeal)(mutationCtx(db), {
      sessionToken: SESSION,
      mealId: 'stale-qty',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Pain',
      calories: null,
      grams: 2500,
      quantityRules: 'v3',
      updatedAt: 500,
    })) as { applied: boolean; stale: boolean; updatedAt: number }
    expect(result).toEqual({
      applied: false,
      stale: true,
      updatedAt: 1000,
      portionLabel: undefined,
    })
    const row = db.table('nutrition_meals').find((r) => r.mealId === 'stale-qty')!
    expect(row.grams).toBe(100)
  })
})
