/**
 * B15 — SAFETY FIELDS (age, declaredEatingDisorder, declaredDiabetes,
 * declaredPregnancy, declaredBreastfeeding) : sync/import ne peuvent jamais
 * les effacer ni passer true→false. FakeDb + write token runtime.
 */
import { describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import { FOOD_ADD_ACCESS_DENIED_TCA } from '../../convex/lib/foodAddAccess'
import {
  NUTRITION_PROFILE_SAFETY_FIELDS,
  NUTRITION_SAFETY_CLEAR_AUDIT_TABLE,
  applyNutritionProfileFromAccountLink,
  clearNutritionSafetyBoolField,
  isNutritionProfileWriteAuthorized,
  mergeNutritionProfileJson,
  updateNutritionProfileForUser,
  writeNutritionProfileJson,
} from '../../convex/lib/nutritionProfile'
import { upsertNutrition } from '../../convex/migrations'
import { clearSafetyFlag, upsertMeal } from '../../convex/nutrition'
import { pushSyncForSession } from '../../convex/sync'
import { getNutritionTarget, hasMealTargets } from '../services/nutritionActivity'
import { decideEstimationEligibility, decideLossEligibility } from '../services/nutritionSafetyRules'
import type { CalorieProfile } from '../types/nutrition'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'nutrition_state'
  | 'nutrition_meals'
  | 'nutrition_age_majority_audit'
  | 'nutrition_safety_clear_audit'
  | 'profiles'
  | 'workouts_state'
  | 'sleep_nights'
  | 'streak_state'
  | 'custom_spots'
  | 'active_checkins'

type StoredRow = Record<string, unknown> & { _id: string }

/** FakeDb qui refuse toute écriture profileJson hors write depth token. */
class GuardedFakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    nutrition_state: [],
    nutrition_meals: [],
    nutrition_age_majority_audit: [],
    nutrition_safety_clear_audit: [],
    profiles: [],
    workouts_state: [],
    sleep_nights: [],
    streak_state: [],
    custom_spots: [],
    active_checkins: [],
  }

  private assertProfileWriteAuthorized(value: Record<string, unknown>) {
    if (!('profileJson' in value)) return
    if (!isNutritionProfileWriteAuthorized()) {
      throw new Error('UNAUTHORIZED_PROFILE_JSON_WRITE')
    }
  }

  insert(table: string, value: Record<string, unknown>) {
    try {
      // Runtime : table peut être une variable dont la valeur est nutrition_state.
      if (table === 'nutrition_state') this.assertProfileWriteAuthorized(value)
    } catch (err) {
      return Promise.reject(err)
    }
    const typed = table as TableName
    if (!this.rows[typed]) this.rows[typed] = []
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[typed].push(row)
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
      try {
        if (row._id.startsWith('nutrition_state:')) this.assertProfileWriteAuthorized(patch)
      } catch (err) {
        return Promise.reject(err)
      }
      Object.assign(row, patch)
      return Promise.resolve()
    }
    return Promise.reject(new Error(`Row not found: ${id}`))
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

const USER = 'user-b15'
const SESSION = 'session-b15'
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

function handlerOf(fn: unknown) {
  return (fn as { _handler: (c: unknown, a: unknown) => Promise<unknown> })._handler
}

function profileOf(db: GuardedFakeDb): Record<string, unknown> {
  const row = db.table('nutrition_state').find((r) => r.userId === USER)
  return (row?.profileJson as Record<string, unknown>) ?? {}
}

async function seedAuth(db: GuardedFakeDb) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId: USER,
    email: 'b15@example.com',
    emailNorm: 'b15@example.com',
    displayName: 'B15',
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
}

async function seedProfile(db: GuardedFakeDb, profile: Record<string, unknown>) {
  await writeNutritionProfileJson({ db } as never, {
    userId: USER,
    incomingProfileJson: profile,
    journalJson: {},
    updatedAt: Date.now(),
  })
}

describe('B15 — liste SAFETY FIELDS', () => {
  it('expose exactement les clés réelles profileJson (dont minorAgeRef B16)', () => {
    expect([...NUTRITION_PROFILE_SAFETY_FIELDS]).toEqual([
      'age',
      'declaredEatingDisorder',
      'declaredDiabetes',
      'declaredPregnancy',
      'declaredBreastfeeding',
      'minorAgeRef',
    ])
  })
})

describe('B15-01 — sync/import ne peut pas effacer ni true→false', () => {
  const TRUE_FLAGS = {
    declaredEatingDisorder: true,
    declaredDiabetes: true,
    declaredPregnancy: true,
    declaredBreastfeeding: true,
  } as const

  it.each([
    ['sync profile {}', async (db: GuardedFakeDb) => {
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: {},
          journalJson: {
            '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
          },
        },
      })
    }],
    ['sync profile null', async (db: GuardedFakeDb) => {
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: null,
          journalJson: {
            '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
          },
        },
      })
    }],
    ['sync flags false', async (db: GuardedFakeDb) => {
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: {
            declaredEatingDisorder: false,
            declaredDiabetes: false,
            declaredPregnancy: false,
            declaredBreastfeeding: false,
            age: 30,
          },
          journalJson: {
            '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
          },
        },
      })
    }],
    ['profile update {}', async (db: GuardedFakeDb) => {
      await updateNutritionProfileForUser({ db } as never, USER, {
        declaredEatingDisorder: false,
        declaredDiabetes: false,
      })
    }],
    ['import string', async (db: GuardedFakeDb) => {
      await upsertNutrition(
        { db } as never,
        { userId: USER, profileJson: 'bad', journalJson: {} },
        { prune: false },
      )
    }],
    ['account linking false flags + age erase', async (db: GuardedFakeDb) => {
      await applyNutritionProfileFromAccountLink({ db } as never, USER, {
        declaredEatingDisorder: false,
        declaredDiabetes: false,
        declaredPregnancy: false,
        declaredBreastfeeding: false,
        // Tentative d’effacement d’âge (adulte peut monter, pas effacer).
        age: null,
      })
    }],
  ] as const)('%s : conserve les 5 SAFETY FIELDS', async (_label, run) => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, { age: 30, onboardingComplete: true, ...TRUE_FLAGS })
    await run(db)
    const p = profileOf(db)
    expect(p.age).toBe(30)
    expect(p.declaredEatingDisorder).toBe(true)
    expect(p.declaredDiabetes).toBe(true)
    expect(p.declaredPregnancy).toBe(true)
    expect(p.declaredBreastfeeding).toBe(true)
  })

  it('false → true via sync est accepté', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, { age: 30 })
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: {
        profileJson: { age: 30, declaredDiabetes: true, declaredPregnancy: true },
        journalJson: {
          '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
        },
      },
    })
    const p = profileOf(db)
    expect(p.declaredDiabetes).toBe(true)
    expect(p.declaredPregnancy).toBe(true)
  })
})

describe('B15 — clearSafetyFlag diabète / grossesse / allaitement + audit', () => {
  it.each([
    ['declaredDiabetes'],
    ['declaredPregnancy'],
    ['declaredBreastfeeding'],
  ] as const)('%s : clear → false + audit userId+at seulement', async (field) => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, {
      age: 28,
      declaredDiabetes: true,
      declaredPregnancy: true,
      declaredBreastfeeding: true,
    })
    const atBefore = Date.now()
    const result = await handlerOf(clearSafetyFlag)(
      { db },
      { sessionToken: SESSION, field },
    )
    expect((result as { cleared: boolean }).cleared).toBe(true)
    const p = profileOf(db)
    expect(p[field]).toBeUndefined()
    // Les autres flags restent
    for (const other of ['declaredDiabetes', 'declaredPregnancy', 'declaredBreastfeeding'] as const) {
      if (other === field) continue
      expect(p[other]).toBe(true)
    }
    const audits = db.table(NUTRITION_SAFETY_CLEAR_AUDIT_TABLE)
    expect(audits).toHaveLength(1)
    expect(Object.keys(audits[0]).sort()).toEqual(['_id', 'at', 'userId'])
    expect(audits[0].userId).toBe(USER)
    expect(typeof audits[0].at).toBe('number')
    expect(audits[0].at as number).toBeGreaterThanOrEqual(atBefore)
    expect(audits[0]).not.toHaveProperty('field')
    expect(audits[0]).not.toHaveProperty('flag')
  })

  it('declaredEatingDisorder : clear refuse (TCA locked)', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, { age: 28, declaredEatingDisorder: true })
    await expect(
      clearNutritionSafetyBoolField({ db } as never, {
        userId: USER,
        field: 'declaredEatingDisorder',
      }),
    ).rejects.toThrow('NUTRITION_SAFETY_TCA_LOCKED')
    expect(profileOf(db).declaredEatingDisorder).toBe(true)
    expect(db.table(NUTRITION_SAFETY_CLEAR_AUDIT_TABLE)).toHaveLength(0)
  })
})

describe('B15-04 — âge mineur temps + 1 an', () => {
  it('sans ageRecordedAt : +1 max ; hausse excessive → ageRejectedContactUs', () => {
    const now = Date.now()
    const rejected = mergeNutritionProfileJson({ age: 15 }, { age: 30 }, now)
    expect(rejected.profileJson.age).toBe(15)
    expect(rejected.ageRejectedContactUs).toBe(true)

    const ok = mergeNutritionProfileJson({ age: 15 }, { age: 16 }, now)
    expect(ok.profileJson.age).toBe(16)
    expect(ok.ageRejectedContactUs).toBe(false)
  })

  it('(e) âge stocké 16 → 25 le même jour : refusé, âge reste 16', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    const now = Date.now()
    await seedProfile(db, { age: 16, ageRecordedAt: now })
    const result = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 25 },
      updatedAt: now,
    })
    expect(result.ageRejectedContactUs).toBe(true)
    expect(profileOf(db).age).toBe(16)
  })

  it('(f) âge stocké 16 → 17 le même jour : accepté', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    const now = Date.now()
    await seedProfile(db, { age: 16, ageRecordedAt: now })
    const result = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 17 },
      updatedAt: now,
    })
    expect(result.ageRejectedContactUs).toBe(false)
    expect(profileOf(db).age).toBe(17)
  })

  it('avec minorAgeRef ancien : hausse dans la marge ; audit majorité', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    const now = Date.now()
    // B16 — client ageRecordedAt ignoré ; ancrer la ref via updatedAt d’écriture.
    await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 16 },
      updatedAt: now - MS_PER_YEAR,
      journalJson: {},
    })
    const result = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 18 },
      updatedAt: now,
    })
    expect(result.wroteMajorityAudit).toBe(true)
    expect(profileOf(db).age).toBe(18)
    expect(db.table('nutrition_age_majority_audit')).toHaveLength(1)
  })
})

describe('B15 permanent — TCA / diabète / import / old client', () => {
  async function tryUpsertMeal(db: GuardedFakeDb) {
    return handlerOf(upsertMeal)(
      { db },
      {
        sessionToken: SESSION,
        mealId: 'meal-b15-perm',
        dateKey: '2026-10-15',
        mealType: 'lunch',
        name: 'Riz',
        calories: 200,
        updatedAt: Date.now(),
      },
    )
  }

  const journal = {
    '2026-10-15': { meals: [{ id: 'm1', name: 'Pain', calories: 80 }], waterMl: 0 },
  }

  it('(a) TCA true + sync profile {} : flag gardé et upsertMeal refusé', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, {
      age: 30,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: { profileJson: {}, journalJson: journal },
    })
    expect(profileOf(db).declaredEatingDisorder).toBe(true)
    await expect(tryUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_TCA)
  })

  it('(b) TCA true + sync {declaredEatingDisorder:false} : flag gardé et upsertMeal refusé', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, {
      age: 30,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: {
        profileJson: { age: 30, declaredEatingDisorder: false },
        journalJson: journal,
      },
    })
    expect(profileOf(db).declaredEatingDisorder).toBe(true)
    await expect(tryUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_TCA)
  })

  it('(c) IMPORT profile null + TCA true : flag gardé et upsertMeal refusé', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, {
      age: 30,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    await upsertNutrition(
      { db } as never,
      { userId: USER, profileJson: null, journalJson: {} },
      { prune: false },
    )
    expect(profileOf(db).declaredEatingDisorder).toBe(true)
    await expect(tryUpsertMeal(db)).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_TCA)
  })

  it('(d) diabète true + sync {} : flag gardé et objectif kcal bloqué', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, {
      age: 34,
      sex: 'male',
      weightKg: 80,
      heightCm: 178,
      goal: 'cut',
      weeklyPaceKg: 0.4,
      onboardingComplete: true,
      declaredDiabetes: true,
      healthAnswer: 'none',
    })
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: { profileJson: {}, journalJson: journal },
    })
    const p = profileOf(db)
    expect(p.declaredDiabetes).toBe(true)
    const asCalorie = p as unknown as CalorieProfile
    const nutrition = getNutritionTarget(asCalorie, { calorieGoalEnabled: true })
    expect(nutrition.showCalorieGoal).toBe(false)
    expect(hasMealTargets(nutrition)).toBe(false)
    expect(decideEstimationEligibility(asCalorie, { calorieGoalEnabled: true }).allowed).toBe(
      false,
    )
    expect(decideLossEligibility(asCalorie, { calorieGoalEnabled: true }).reason).toBe('diabetes')
  })

  it('(h) old client 1657a82 payload (profile ?? {}) n’efface aucun SAFETY FIELD', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, {
      age: 30,
      declaredEatingDisorder: true,
      declaredDiabetes: true,
      declaredPregnancy: true,
      declaredBreastfeeding: true,
      healthAnswer: 'situations',
    })
    // Mimique convexCloudBackup.backupPayloadToPushArgs : profileJson: profile ?? {}
    const profile: Record<string, unknown> | undefined = undefined
    const profileJson = profile ?? {}
    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: { profileJson, journalJson: journal },
    })
    const p = profileOf(db)
    expect(p.age).toBe(30)
    expect(p.declaredEatingDisorder).toBe(true)
    expect(p.declaredDiabetes).toBe(true)
    expect(p.declaredPregnancy).toBe(true)
    expect(p.declaredBreastfeeding).toBe(true)
  })
})

describe('B15-02 — FakeDb refuse écriture profileJson sans token', () => {
  it('writeNutritionProfileJson passe le garde', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, { age: 22 })
    expect(profileOf(db).age).toBe(22)
  })

  it.each([
    [
      '(g1) shorthand { profileJson }',
      async (db: GuardedFakeDb, rowId: string) => {
        await db.patch(rowId, { profileJson: { age: 99 } })
      },
    ],
    [
      '(g2) object in a variable',
      async (db: GuardedFakeDb, rowId: string) => {
        const patch = { profileJson: { age: 99 }, updatedAt: Date.now() }
        await db.patch(rowId, patch)
      },
    ],
    [
      '(g3) {...payload} spread',
      async (db: GuardedFakeDb, rowId: string) => {
        const payload = { profileJson: { age: 99 }, updatedAt: Date.now() }
        await db.patch(rowId, { ...payload })
      },
    ],
    [
      '(g4) nested object before the key',
      async (db: GuardedFakeDb, rowId: string) => {
        await db.patch(rowId, { updatedAt: Date.now(), journalJson: {}, profileJson: { age: 99 } })
      },
    ],
    [
      '(g5) table name in a variable',
      async (db: GuardedFakeDb) => {
        const tableName = 'nutrition_state'
        await db.insert(tableName, {
          userId: 'other',
          profileJson: { age: 99 },
          journalJson: {},
          updatedAt: Date.now(),
        })
      },
    ],
    [
      '(g6) computed key',
      async (db: GuardedFakeDb, rowId: string) => {
        const key = 'profileJson'
        await db.patch(rowId, { [key]: { age: 99 }, updatedAt: Date.now() })
      },
    ],
  ] as const)('%s → UNAUTHORIZED', async (_label, run) => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, { age: 22 })
    const rowId = db.table('nutrition_state')[0]._id
    await expect(run(db, rowId)).rejects.toThrow('UNAUTHORIZED_PROFILE_JSON_WRITE')
    expect(profileOf(db).age).toBe(22)
  })
})

describe('B15 — mergeNutritionProfileJson unit safety bools', () => {
  it('true stocké ne passe jamais à false', () => {
    const merged = mergeNutritionProfileJson(
      {
        age: 30,
        declaredEatingDisorder: true,
        declaredDiabetes: true,
        declaredPregnancy: true,
        declaredBreastfeeding: true,
      },
      {
        age: 30,
        declaredEatingDisorder: false,
        declaredDiabetes: false,
        declaredPregnancy: false,
        declaredBreastfeeding: false,
      },
    )
    expect(merged.profileJson.declaredEatingDisorder).toBe(true)
    expect(merged.profileJson.declaredDiabetes).toBe(true)
    expect(merged.profileJson.declaredPregnancy).toBe(true)
    expect(merged.profileJson.declaredBreastfeeding).toBe(true)
  })
})
