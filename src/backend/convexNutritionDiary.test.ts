import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import { FOOD_ADD_ACCESS_DENIED_MINOR, FOOD_ADD_ACCESS_DENIED_TCA } from '../../convex/lib/foodAddAccess'
import { awardNutritionXpForSession } from '../../convex/nutritionDiary'
import {
  getDaySnapshotForSession,
  mergeNutritionDaySnapshotForSession,
  upsertDaySnapshotForSession,
} from '../../convex/progression'
import { nutritionDayCache, diaryRollup } from '../nutrition-engine/diaryRollup'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'profiles'
  | 'nutrition_state'
  | 'day_snapshots'
  | 'nutrition_xp_awards'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    profiles: [],
    nutrition_state: [],
    day_snapshots: [],
    nutrition_xp_awards: [],
  }
  patches = 0

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  patch(id: string, patch: Record<string, unknown>) {
    this.patches += 1
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (!row) continue
      Object.assign(row, patch)
      return Promise.resolve()
    }
    throw new Error(`Row not found: ${id}`)
  }

  delete(id: string) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key].splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
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
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => unknown
      }
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

const JOURNAL = [
  { mealType: 'breakfast', calories: 150, proteinG: 25, carbsG: 10, fatG: 0, fiberG: 0 },
  { mealType: 'lunch', calories: 260, proteinG: 6, carbsG: 56, fatG: 0, fiberG: 2 },
  { mealType: 'dinner', calories: 330, proteinG: 69, carbsG: 0, fatG: 6, fiberG: 0 },
  { mealType: 'snack', calories: 90, proteinG: 1, carbsG: 23, fatG: 0, fiberG: 2 },
]

const EVENTS = [{ muscles: ['Pectoraux'], units: 100, hoursAgo: 48 }]

const STRAIN = {
  workoutStrain: 68,
  strainZ: 2.8,
  sleepBankMinutes: -300,
  preparation: 65,
  xpAwarded: 116,
  strainScale: 160,
  muscleFreshness: { Pectoraux: 0 },
  freshnessEvents: EVENTS,
}

async function seedUser(db: FakeDb, userId: string, token: string, age = 22) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId,
    email: `${userId}@example.com`,
    emailNorm: `${userId}@example.com`,
    displayName: userId,
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(token),
    createdAt: now,
    expiresAt: now + 60_000,
  })
  await db.insert('profiles', {
    userId,
    pseudo: userId,
    level: 1,
    xp: 0,
    rank: 'Bronze',
    discipline: 'Musculation',
    isGhostModeEnabled: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('nutrition_state', {
    userId,
    profileJson: { age },
    journalJson: {},
    updatedAt: now,
  })
}

describe('DB-N1 / DB-N2 nutrition XP et snapshot', () => {
  it('fusionne la nutrition sans effacer le strain, et ignore le même hash', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')
    await upsertDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      inputsHash: 'strain-1',
      payload: STRAIN,
    })
    const cache = nutritionDayCache({
      rollup: diaryRollup({ meals: JOURNAL, waterMl: 750 }),
      targetKcal: 2798,
      proteinTargetG: 97.6,
    })
    const merged = await mergeNutritionDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      nutrition: cache,
    })
    expect(merged.updated).toBe(true)
    expect(merged.snapshot.payload.workoutStrain).toBe(68)
    expect(merged.snapshot.payload.preparation).toBe(65)
    expect(merged.snapshot.payload.nutrition?.kcal).toBe(830)
    expect(merged.snapshot.inputsHash).toBe('strain-1')

    const patches = db.patches
    const again = await mergeNutritionDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      nutrition: cache,
    })
    expect(again.updated).toBe(false)
    expect(db.patches).toBe(patches)

    const replaced = await upsertDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      inputsHash: 'strain-2',
      payload: { ...STRAIN, xpAwarded: 118, strainScale: 150 },
    })
    expect(replaced.updated).toBe(true)
    expect(replaced.snapshot.payload.xpAwarded).toBe(118)
    expect(replaced.snapshot.payload.nutrition?.kcal).toBe(830)
    expect(replaced.snapshot.payload.nutrition?.proteinG).toBe(101)
  })

  it('crédite 35 XP une seule fois et ne retire rien si le journal change', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')
    const base = {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      meals: JOURNAL,
      waterMl: 750,
      targetKcal: 2798,
      proteinTargetG: 97.6,
    }
    const meals = await awardNutritionXpForSession(ctx as never, 'session-a', {
      ...base,
      kind: 'meals_complete',
    })
    const protein = await awardNutritionXpForSession(ctx as never, 'session-a', {
      ...base,
      kind: 'protein_goal',
      freshnessEvents: EVENTS,
    })
    expect(meals.applied).toBe(true)
    expect(meals.xp).toBe(25)
    expect(protein.applied).toBe(true)
    expect(protein.xp).toBe(10)
    expect(protein.totalXp).toBe(35)
    expect(db.table('profiles')[0]?.xp).toBe(35)
    expect(db.table('nutrition_xp_awards')).toHaveLength(2)

    const repeat = await awardNutritionXpForSession(ctx as never, 'session-a', {
      ...base,
      kind: 'protein_goal',
      meals: [{ mealType: 'snack', calories: 90 }],
    })
    expect(repeat.applied).toBe(false)
    expect(repeat.xp).toBe(10)
    expect(db.table('profiles')[0]?.xp).toBe(35)
    expect(db.table('nutrition_xp_awards')).toHaveLength(2)
  })

  it('protein_goal après la séance raccourcit la demi-vie de tout le dateKey', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')
    await upsertDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      inputsHash: 'strain-1',
      payload: STRAIN,
    })
    await awardNutritionXpForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      kind: 'protein_goal',
      meals: JOURNAL,
      waterMl: 750,
      targetKcal: 2798,
      proteinTargetG: 97.6,
    })
    const snapshot = await getDaySnapshotForSession(ctx as never, 'session-a', '2026-10-21')
    expect(snapshot?.payload.freshnessHalfLifeFactor).toBe(0.9)
    expect(snapshot?.payload.muscleFreshness).toEqual({ Pectoraux: 67 })
    expect(snapshot?.payload.preparation).toBe(65)
    expect(snapshot?.payload.workoutStrain).toBe(68)
    expect(snapshot?.payload.nutrition?.kcal).toBe(830)
  })

  it('protein_goal avant la séance s’applique quand le snapshot de séance arrive', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')
    await awardNutritionXpForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      kind: 'protein_goal',
      meals: JOURNAL,
      waterMl: 750,
      targetKcal: 2798,
      proteinTargetG: 97.6,
    })
    const written = await upsertDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-21',
      timezone: 'Europe/Paris',
      inputsHash: 'strain-later',
      payload: STRAIN,
    })
    expect(written.snapshot.payload.freshnessHalfLifeFactor).toBe(0.9)
    expect(written.snapshot.payload.muscleFreshness).toEqual({ Pectoraux: 67 })
    expect(written.snapshot.payload.preparation).toBe(65)
    expect(written.snapshot.payload.nutrition?.targetKcal).toBe(2798)
    expect(written.snapshot.inputsHash).toBe('strain-later')
  })

  it('mineur et TCA ne reçoivent pas d’XP nutrition', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'minor', 'session-minor', 16)
    await expect(
      awardNutritionXpForSession(ctx as never, 'session-minor', {
        dateKey: '2026-10-21',
        timezone: 'Europe/Paris',
        kind: 'meals_complete',
        meals: JOURNAL,
        waterMl: null,
        targetKcal: null,
        proteinTargetG: null,
      }),
    ).rejects.toMatchObject({ data: { code: FOOD_ADD_ACCESS_DENIED_MINOR } })

    await seedUser(db, 'tca', 'session-tca', 22)
    db.table('nutrition_state').find((row) => row.userId === 'tca')!.profileJson = {
      age: 22,
      declaredEatingDisorder: true,
    }
    await expect(
      awardNutritionXpForSession(ctx as never, 'session-tca', {
        dateKey: '2026-10-21',
        timezone: 'Europe/Paris',
        kind: 'meals_complete',
        meals: JOURNAL,
        waterMl: null,
        targetKcal: 2798,
        proteinTargetG: 97.6,
      }),
    ).rejects.toBeInstanceOf(ConvexError)
    await expect(
      awardNutritionXpForSession(ctx as never, 'session-tca', {
        dateKey: '2026-10-21',
        timezone: 'Europe/Paris',
        kind: 'meals_complete',
        meals: JOURNAL,
        waterMl: null,
        targetKcal: 2798,
        proteinTargetG: 97.6,
      }),
    ).rejects.toMatchObject({ data: { code: FOOD_ADD_ACCESS_DENIED_TCA } })
    expect(db.table('nutrition_xp_awards')).toHaveLength(0)
  })
})
