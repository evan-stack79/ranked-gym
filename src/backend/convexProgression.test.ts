import { describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  awardWorkoutXpForSession,
  getDaySnapshotForSession,
  patchWorkoutsStateForSession,
  upsertDaySnapshotForSession,
} from '../../convex/progression'
import { ensureProfileForSession } from '../../convex/profiles'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'profiles'
  | 'streak_state'
  | 'day_snapshots'
  | 'workout_xp_awards'
  | 'workouts_state'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    profiles: [],
    streak_state: [],
    day_snapshots: [],
    workout_xp_awards: [],
    workouts_state: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
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

const PAYLOAD = {
  workoutStrain: 68,
  strainZ: 2.8,
  sleepBankMinutes: -300,
  preparation: 65,
  xpAwarded: 116,
  strainScale: 160,
  muscleFreshness: { Pectoraux: 0 },
}

async function seedAuth(db: FakeDb, userId: string, token: string) {
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
}

async function seedUser(db: FakeDb, userId: string, token: string) {
  await seedAuth(db, userId, token)
  const now = Date.now()
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
}

describe('Convex progression DB-1..DB-4', () => {
  it('écrit et relit un day snapshot, isolé par session', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')

    const written = await upsertDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-23',
      timezone: 'Europe/Paris',
      inputsHash: 'hash-a',
      payload: PAYLOAD,
    })
    expect(written.updated).toBe(true)
    expect(db.table('day_snapshots')).toHaveLength(1)

    const again = await upsertDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-23',
      timezone: 'Europe/Paris',
      inputsHash: 'hash-a',
      payload: PAYLOAD,
    })
    expect(again.updated).toBe(false)
    expect(db.table('day_snapshots')).toHaveLength(1)

    const replaced = await upsertDaySnapshotForSession(ctx as never, 'session-a', {
      dateKey: '2026-10-23',
      timezone: 'Europe/Paris',
      inputsHash: 'hash-b',
      payload: { ...PAYLOAD, xpAwarded: 118, strainScale: 150 },
    })
    expect(replaced.updated).toBe(true)
    expect(db.table('day_snapshots')).toHaveLength(1)

    const own = await getDaySnapshotForSession(ctx as never, 'session-a', '2026-10-23')
    expect(own?.payload.xpAwarded).toBe(118)
    expect(own?.inputsHash).toBe('hash-b')
    const other = await getDaySnapshotForSession(ctx as never, 'session-b', '2026-10-23')
    expect(other).toBeNull()
  })

  it('crédite l’XP une seule fois pour le même noteId et pose le rating par défaut', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')

    const first = await awardWorkoutXpForSession(ctx as never, 'session-a', {
      noteId: 'note-1',
      xp: 116,
      performanceRating: 1024,
    })
    expect(first.applied).toBe(true)
    expect(first.profile.xp).toBe(116)
    expect(first.profile.level).toBe(1)
    expect(first.profile.rank).toBe('Bronze')
    expect(first.profile.rankDivision).toBe('I')
    expect(first.profile.performanceRating).toBe(1024)
    expect(first.profile.ratedSessions).toBe(1)
    expect(first.ratingBefore).toBe(1000)

    const second = await awardWorkoutXpForSession(ctx as never, 'session-a', {
      noteId: 'note-1',
      xp: 116,
      performanceRating: 2000,
    })
    expect(second.applied).toBe(false)
    expect(second.profile.xp).toBe(116)
    expect(second.profile.performanceRating).toBe(1024)
    expect(second.profile.ratedSessions).toBe(1)
    expect(db.table('workout_xp_awards')).toHaveLength(1)
  })

  it('116 XP au-dessus de 900 fait passer le niveau sans second crédit', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')
    const row = db.table('profiles')[0]
    row.xp = 900
    const awarded = await awardWorkoutXpForSession(ctx as never, 'session-a', {
      noteId: 'note-level',
      xp: 116,
      performanceRating: 1024,
    })
    expect(awarded.profile.level).toBe(2)
    expect(awarded.profile.xp).toBe(16)
    expect(awarded.profile.rank).toBe('Bronze')
  })

  it('un profil créé par ensure pose 1000 / 0 séance / division I', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedAuth(db, 'user-a', 'session-a')
    const created = await ensureProfileForSession(ctx as never, 'session-a', 'Ada')
    expect(created.performanceRating).toBe(1000)
    expect(created.ratedSessions).toBe(0)
    expect(created.rankDivision).toBe('I')
    const row = db.table('profiles')[0]
    expect(row.performanceRating).toBe(1000)
    expect(row.ratedSessions).toBe(0)
    expect(row.rankDivision).toBe('I')
  })

  it('le patch workouts conserve les clés absentes du patch', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await seedUser(db, 'user-a', 'session-a')
    await db.insert('workouts_state', {
      userId: 'user-a',
      stateJson: { schedule: [{ id: 'rule-1' }], workoutNotes: [] },
      progressJson: { kept: true },
      updatedAt: 1,
    })
    await patchWorkoutsStateForSession(ctx as never, 'session-a', {
      statePatch: {
        workoutNotes: [{ id: 'n1', schemaVersion: 2, setGroups: [], exercises: [] }],
      },
    })
    const row = db.table('workouts_state')[0]
    const state = row.stateJson as { schedule: unknown[]; workoutNotes: unknown[] }
    expect(state.schedule).toEqual([{ id: 'rule-1' }])
    expect(state.workoutNotes).toHaveLength(1)
    expect(row.progressJson).toEqual({ kept: true })
  })
})
