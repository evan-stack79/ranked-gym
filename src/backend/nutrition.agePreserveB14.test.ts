/**
 * B14-01 / B14-02 — préservation d’âge serveur + chemins sync / update / import / link.
 * FakeDb, pas de réseau. Refus food-add toujours depuis l’âge STOCKÉ.
 */
import { describe, expect, it } from 'vitest'
import { assertFoodAddAccessFromStoredProfile, FOOD_ADD_ACCESS_DENIED_MINOR } from '../../convex/lib/foodAddAccess'
import {
  applyNutritionProfileFromAccountLink,
  extractStoredNutritionAge,
  mergeNutritionProfileJson,
  parseValidNutritionAge,
  updateNutritionProfileForUser,
  writeNutritionProfileJson,
} from '../../convex/lib/nutritionProfile'
import { hashToken } from '../../convex/lib/authCrypto'
import { upsertNutrition } from '../../convex/migrations'
import { pushSyncForSession } from '../../convex/sync'
import { upsertMeal } from '../../convex/nutrition'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'nutrition_state'
  | 'nutrition_meals'
  | 'nutrition_age_majority_audit'
  | 'profiles'
  | 'workouts_state'
  | 'sleep_nights'
  | 'streak_state'
  | 'custom_spots'
  | 'active_checkins'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    nutrition_state: [],
    nutrition_meals: [],
    nutrition_age_majority_audit: [],
    profiles: [],
    workouts_state: [],
    sleep_nights: [],
    streak_state: [],
    custom_spots: [],
    active_checkins: [],
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

const USER = 'user-b14'
const SESSION = 'session-b14'

async function seedMinor16(db: FakeDb, profileExtra: Record<string, unknown> = {}) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId: USER,
    email: 'b14@example.com',
    emailNorm: 'b14@example.com',
    displayName: 'B14',
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId: USER,
    tokenHash: await hashToken(SESSION),
    createdAt: now,
    expiresAt: now + 86_400_000,
  })
  await db.insert('nutrition_state', {
    userId: USER,
    profileJson: { age: 16, onboardingComplete: true, ...profileExtra },
    journalJson: {
      '2026-10-14': { meals: [{ id: 'm0', name: 'Skyr', calories: 100 }], waterMl: 0 },
    },
    updatedAt: now,
  })
}

async function seedNoAge(db: FakeDb) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId: USER,
    email: 'b14@example.com',
    emailNorm: 'b14@example.com',
    displayName: 'B14',
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId: USER,
    tokenHash: await hashToken(SESSION),
    createdAt: now,
    expiresAt: now + 86_400_000,
  })
  await db.insert('nutrition_state', {
    userId: USER,
    profileJson: { onboardingComplete: true },
    journalJson: {},
    updatedAt: now,
  })
}

function storedAge(db: FakeDb): number | null {
  const row = db.table('nutrition_state').find((r) => r.userId === USER)
  return extractStoredNutritionAge(row?.profileJson)
}

function handlerOf(fn: unknown) {
  return (fn as { _handler: (c: unknown, a: unknown) => Promise<unknown> })._handler
}

async function tryUpsertMeal(db: FakeDb) {
  return handlerOf(upsertMeal)(
    { db },
    {
      sessionToken: SESSION,
      mealId: 'meal-b14',
      dateKey: '2026-10-15',
      mealType: 'lunch',
      name: 'Riz',
      calories: 200,
      updatedAt: Date.now(),
    },
  )
}

describe('parseValidNutritionAge', () => {
  it('accepte entier et string d’entier 10–120', () => {
    expect(parseValidNutritionAge(16)).toBe(16)
    expect(parseValidNutritionAge('16')).toBe(16)
    expect(parseValidNutritionAge(10)).toBe(10)
    expect(parseValidNutritionAge(120)).toBe(120)
  })

  it('refuse 0, 150, -15, 17.9, profil non numérique', () => {
    expect(parseValidNutritionAge(0)).toBeNull()
    expect(parseValidNutritionAge(150)).toBeNull()
    expect(parseValidNutritionAge(-15)).toBeNull()
    expect(parseValidNutritionAge(17.9)).toBeNull()
    expect(parseValidNutritionAge('16a')).toBeNull()
    expect(parseValidNutritionAge(null)).toBeNull()
    expect(parseValidNutritionAge(undefined)).toBeNull()
  })
})

describe('B14-01 — compte âgé 16 : sync ne peut pas effacer l’âge', () => {
  it('âge 16 + sync profile null / string / {} : upsertMeal toujours refusé', async () => {
    for (const incoming of [null, 'corrupt-profile', {}] as const) {
      const db = new FakeDb()
      await seedMinor16(db)
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: incoming,
          // journal meaningful so sync n’est pas skippé comme empty overwrite
          journalJson: {
            '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
          },
        },
      })
      expect(storedAge(db)).toBe(16)
      const access = await assertFoodAddAccessFromStoredProfile({ db } as never, USER)
      expect(access.ok).toBe(false)
      if (!access.ok) expect(access.error).toBe(FOOD_ADD_ACCESS_DENIED_MINOR)
      await expect(tryUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_MINOR)
    }
  })

  it('âge 16 + sync age 150 : âge stocké reste 16, add refusé', async () => {
    const db = new FakeDb()
    await seedMinor16(db, { weightKg: 60 })
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: {
        profileJson: { age: 150, weightKg: 61, onboardingComplete: true },
        journalJson: {
          '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
        },
      },
    })
    expect(storedAge(db)).toBe(16)
    const row = db.table('nutrition_state')[0]
    expect((row.profileJson as { weightKg: number }).weightKg).toBe(61)
    await expect(tryUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_MINOR)
  })
})

describe('B14-02 — âge absent puis entrant', () => {
  it('sans âge + sync age string "16" : stocke 16, add refusé', async () => {
    const db = new FakeDb()
    await seedNoAge(db)
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: {
        profileJson: { age: '16', onboardingComplete: true },
        journalJson: {
          '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
        },
      },
    })
    expect(storedAge(db)).toBe(16)
    await expect(tryUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_MINOR)
  })

  it('sans âge + sync âge invalide : add toujours accepté', async () => {
    const db = new FakeDb()
    await seedNoAge(db)
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: {
        profileJson: { age: 150, onboardingComplete: true },
        journalJson: {
          '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
        },
      },
    })
    expect(storedAge(db)).toBeNull()
    const access = await assertFoodAddAccessFromStoredProfile({ db } as never, USER)
    expect(access.ok).toBe(true)
    const meal = await tryUpsertMeal(db)
    expect((meal as { applied: boolean }).applied).toBe(true)
  })
})

describe('B14 — audit mineur → 18+', () => {
  it('écrit nutrition_age_majority_audit (userId + at seulement) sur 16→18', async () => {
    const db = new FakeDb()
    // ageRecordedAt ≥ 1 an → marge +2 (temps+1) autorise 16→18
    const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000
    const at = Date.now()
    await seedMinor16(db, { ageRecordedAt: at - MS_PER_YEAR })
    const result = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 18 },
      updatedAt: at,
    })
    expect(result.wroteMajorityAudit).toBe(true)
    expect(storedAge(db)).toBe(18)
    const audits = db.table('nutrition_age_majority_audit')
    expect(audits).toHaveLength(1)
    expect(Object.keys(audits[0]).sort()).toEqual(['_id', 'at', 'userId'])
    expect(audits[0].userId).toBe(USER)
    expect(audits[0].at).toBe(at)
    // Pas de champ âge ni d’autres données métier — seulement userId + at (+ _id FakeDb).
    expect('age' in audits[0]).toBe(false)
    expect(audits[0]).not.toHaveProperty('previousAge')
    expect(audits[0]).not.toHaveProperty('nextAge')
  })
})

describe('B14 — chemins sync / profile update / import / account linking', () => {
  async function expectAgePreservedAfter(
    label: string,
    run: (db: FakeDb) => Promise<void>,
  ) {
    const db = new FakeDb()
    await seedMinor16(db)
    await run(db)
    expect(storedAge(db), label).toBe(16)
    await expect(tryUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_MINOR)
  }

  it('sync : profil null ne peut pas effacer l’âge 16', async () => {
    await expectAgePreservedAfter('sync', async (db) => {
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: null,
          journalJson: {
            '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
          },
        },
      })
    })
  })

  it('profile update : profil {} ne peut pas effacer l’âge 16', async () => {
    await expectAgePreservedAfter('profile update', async (db) => {
      await updateNutritionProfileForUser({ db } as never, USER, {})
    })
  })

  it('import : profil string ne peut pas effacer l’âge 16', async () => {
    await expectAgePreservedAfter('import', async (db) => {
      await upsertNutrition(
        { db } as never,
        { userId: USER, profileJson: 'bad', journalJson: {} },
        { prune: false },
      )
    })
  })

  it('account linking : age 150 ne peut pas effacer l’âge 16', async () => {
    await expectAgePreservedAfter('account linking', async (db) => {
      await applyNutritionProfileFromAccountLink({ db } as never, USER, { age: 150 })
    })
  })
})

describe('mergeNutritionProfileJson unit', () => {
  it('préserve l’âge si incoming non-objet', () => {
    expect(mergeNutritionProfileJson({ age: 16 }, null).profileJson.age).toBe(16)
    expect(mergeNutritionProfileJson({ age: 16 }, 'x').profileJson.age).toBe(16)
  })
})
