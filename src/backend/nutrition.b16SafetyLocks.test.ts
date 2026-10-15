/**
 * B16 — TCA/healthAnswer serveur, minorAgeRef, ignore client ageRecordedAt.
 * FakeDb + write token ; pas de réseau.
 */
import { describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import { FOOD_ADD_ACCESS_DENIED_TCA } from '../../convex/lib/foodAddAccess'
import {
  extractMinorAgeRef,
  isNutritionProfileWriteAuthorized,
  mergeNutritionProfileJson,
  writeNutritionProfileJson,
} from '../../convex/lib/nutritionProfile'
import { upsertNutrition } from '../../convex/migrations'
import { upsertMeal } from '../../convex/nutrition'
import { pushSyncForSession } from '../../convex/sync'

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

class GuardedFakeDb {
  /** Seed legacy rows (sans passer par merge) — tests B16-03 uniquement. */
  allowUnsafeProfileSeed = false
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
    if (this.allowUnsafeProfileSeed) return
    if (!isNutritionProfileWriteAuthorized()) {
      throw new Error('UNAUTHORIZED_PROFILE_JSON_WRITE')
    }
  }

  insert(table: string, value: Record<string, unknown>) {
    try {
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

const USER = 'user-b16'
const SESSION = 'session-b16'
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
    email: 'b16@example.com',
    emailNorm: 'b16@example.com',
    displayName: 'B16',
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

async function tryUpsertMeal(db: GuardedFakeDb) {
  return handlerOf(upsertMeal)(
    { db },
    {
      sessionToken: SESSION,
      mealId: 'meal-b16',
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

describe('B16-01 — TCA + healthAnswer prefer_not/none : flag gardé, situations, upsertMeal refusé', () => {
  async function assertTcaLockedAfter(
    label: string,
    run: (db: GuardedFakeDb) => Promise<void>,
  ) {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    await seedProfile(db, {
      age: 30,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    await run(db)
    const p = profileOf(db)
    expect(p.declaredEatingDisorder, label).toBe(true)
    expect(p.healthAnswer, label).toBe('situations')
    await expect(tryUpsertMeal(db), label).rejects.toThrow(FOOD_ADD_ACCESS_DENIED_TCA)
  }

  it.each([
    ['sync prefer_not', async (db: GuardedFakeDb) => {
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: {
            age: 30,
            healthAnswer: 'prefer_not',
            declaredEatingDisorder: false,
          },
          journalJson: journal,
        },
      })
    }],
    ['sync none', async (db: GuardedFakeDb) => {
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: {
            age: 30,
            healthAnswer: 'none',
            declaredEatingDisorder: false,
          },
          journalJson: journal,
        },
      })
    }],
    ['import prefer_not', async (db: GuardedFakeDb) => {
      await upsertNutrition(
        { db } as never,
        {
          userId: USER,
          profileJson: { age: 30, healthAnswer: 'prefer_not', declaredEatingDisorder: false },
          journalJson: {},
        },
        { prune: false },
      )
    }],
    ['import none', async (db: GuardedFakeDb) => {
      await upsertNutrition(
        { db } as never,
        {
          userId: USER,
          profileJson: { age: 30, healthAnswer: 'none', declaredEatingDisorder: false },
          journalJson: {},
        },
        { prune: false },
      )
    }],
    ['old-client 1657a82 prefer_not (profile ?? {})', async (db: GuardedFakeDb) => {
      // Mimique ancien client : payload avec healthAnswer prefer_not / Aucune.
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: { healthAnswer: 'prefer_not' },
          journalJson: journal,
        },
      })
    }],
    ['old-client 1657a82 none', async (db: GuardedFakeDb) => {
      await pushSyncForSession({ db } as never, SESSION, {
        nutrition: {
          profileJson: { healthAnswer: 'none' },
          journalJson: journal,
        },
      })
    }],
  ] as const)('%s', async (label, run) => {
    await assertTcaLockedAfter(label, run)
  })
})

describe('B16-02 — minorAgeRef : 16→17→18→25 même jour borné ; ref inchangée', () => {
  it('même jour : 16→17 OK, 17→18 et 18→25 refusés ; minorAgeRef stable', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    const now = Date.now()
    await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 16 },
      updatedAt: now,
      journalJson: {},
    })
    const ref0 = extractMinorAgeRef(profileOf(db))
    expect(ref0).toEqual({ age: 16, at: now })

    const step17 = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 17, ageRecordedAt: now },
      updatedAt: now,
    })
    expect(step17.ageRejectedContactUs).toBe(false)
    expect(profileOf(db).age).toBe(17)
    expect(extractMinorAgeRef(profileOf(db))).toEqual(ref0)

    const step18 = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 18, ageRecordedAt: now },
      updatedAt: now,
    })
    expect(step18.ageRejectedContactUs).toBe(true)
    expect(profileOf(db).age).toBe(17)
    expect(extractMinorAgeRef(profileOf(db))).toEqual(ref0)

    const step25 = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 25, ageRecordedAt: now },
      updatedAt: now,
    })
    expect(step25.ageRejectedContactUs).toBe(true)
    expect(profileOf(db).age).toBe(17)
    expect(extractMinorAgeRef(profileOf(db))).toEqual(ref0)
  })

  it('baisse d’âge acceptée sans reset de minorAgeRef', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    const now = Date.now()
    await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 16 },
      updatedAt: now,
      journalJson: {},
    })
    const ref0 = extractMinorAgeRef(profileOf(db))
    await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 14 },
      updatedAt: now,
    })
    expect(profileOf(db).age).toBe(14)
    expect(extractMinorAgeRef(profileOf(db))).toEqual(ref0)
    // Toujours borné par ref 16 + 0 + 1 = 17
    const tooHigh = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 18 },
      updatedAt: now,
    })
    expect(tooHigh.ageRejectedContactUs).toBe(true)
    expect(profileOf(db).age).toBe(14)
    expect(extractMinorAgeRef(profileOf(db))).toEqual(ref0)
  })

  it('après 1 an : refAge+elapsed+1 autorise 16→18 ; ref inchangée', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    const now = Date.now()
    const recorded = now - MS_PER_YEAR
    await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 16 },
      updatedAt: recorded,
      journalJson: {},
    })
    const ref0 = extractMinorAgeRef(profileOf(db))
    expect(ref0?.age).toBe(16)
    expect(ref0?.at).toBe(recorded)

    const result = await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: { age: 18 },
      updatedAt: now,
    })
    expect(result.ageRejectedContactUs).toBe(false)
    expect(profileOf(db).age).toBe(18)
    expect(extractMinorAgeRef(profileOf(db))).toEqual(ref0)
  })
})

describe('B16-03 — client ageRecordedAt ignoré ; ancienne ligne mineur sans date → ref.at=now', () => {
  it('merge : age 16 sans date + client ageRecordedAt ancien → ref.at=now ; 16→25 refusé', () => {
    const now = 1_700_000_000_000
    const forgedOld = now - 10 * MS_PER_YEAR
    const result = mergeNutritionProfileJson(
      { age: 16 },
      { age: 25, ageRecordedAt: forgedOld },
      now,
    )
    expect(result.profileJson.age).toBe(16)
    expect(result.ageRejectedContactUs).toBe(true)
    expect(result.profileJson.minorAgeRef).toEqual({ age: 16, at: now })
    // Pas la date forgée client.
    expect(result.profileJson.ageRecordedAt).not.toBe(forgedOld)
  })

  it('sync FakeDb : ligne legacy age 16 sans ageRecordedAt ; client date ignorée ; 25 refusé', async () => {
    const db = new GuardedFakeDb()
    await seedAuth(db)
    const now = Date.now()
    const forgedOld = now - 10 * MS_PER_YEAR
    db.allowUnsafeProfileSeed = true
    await db.insert('nutrition_state', {
      userId: USER,
      profileJson: { age: 16 },
      journalJson: {},
      updatedAt: now - 1000,
    })
    db.allowUnsafeProfileSeed = false

    await pushSyncForSession({ db } as never, SESSION, {
      nutrition: {
        profileJson: { age: 25, ageRecordedAt: forgedOld },
        journalJson: journal,
      },
    })
    const p = profileOf(db)
    expect(p.age).toBe(16)
    const ref = extractMinorAgeRef(p)
    expect(ref?.age).toBe(16)
    // Strictest : première passe serveur pose ref.at ≈ now (pas forgedOld).
    expect(ref?.at).toBeGreaterThan(forgedOld)
    expect(ref?.at).toBeGreaterThanOrEqual(now - 60_000)
    expect(p.ageRecordedAt).not.toBe(forgedOld)
  })
})
