import { describe, expect, it } from 'vitest'
import {
  countCheckinsForSession,
  createCheckinForSession,
  getSocialActivityFeed,
  getUserStatsForSession,
  listRecentCheckinsForSession,
  recordActivityForSession,
  releaseAiMealScanForSession,
  reserveAiMealScanForSession,
} from '../../convex/rpc'
import { hashToken } from '../../convex/lib/authCrypto'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'profiles'
  | 'workouts_state'
  | 'checkins'
  | 'activities'
  | 'ai_usage_limits'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    profiles: [],
    workouts_state: [],
    checkins: [],
    activities: [],
    ai_usage_limits: [],
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
}

class FakeQuery {
  private filtered: StoredRow[]

  constructor(rows: StoredRow[]) {
    this.filtered = [...rows]
  }

  withIndex(
    _indexName: string,
    fn?: (q: {
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => unknown
      }
    }) => unknown,
  ) {
    if (!fn) return this
    const clauses: Array<{ field: string; value: unknown }> = []
    const chain = {
      eq(field: string, value: unknown) {
        clauses.push({ field, value })
        return chain
      },
    }
    fn(chain)
    this.filtered = this.filtered.filter((row) =>
      clauses.every((clause) => row[clause.field] === clause.value),
    )
    return this
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
}

function createCtx(db: FakeDb): { db: FakeDb } {
  return { db }
}

async function seedUser(db: FakeDb, userId: string, sessionToken: string, ghost = false) {
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
    tokenHash: await hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + 60_000,
  })
  await db.insert('profiles', {
    userId,
    pseudo: userId === 'user-a' ? 'Alpha' : 'Bravo',
    level: 1,
    xp: 0,
    rank: 'Bronze',
    discipline: 'Musculation',
    isGhostModeEnabled: ghost,
    createdAt: now,
    updatedAt: now,
  })
}

describe('Convex PR-G RPC isolation', () => {
  it('prevents cross-user checkin reads/writes via session ownership', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')

    await createCheckinForSession(ctx as never, 'session-b', {
      salleNom: 'Gym B',
      salleLat: 48.86,
      salleLng: 2.35,
      gymPayload: { id: 'gym-b' },
    })

    const rowsA = await listRecentCheckinsForSession(ctx as never, 'session-a')
    const rowsB = await listRecentCheckinsForSession(ctx as never, 'session-b')
    expect(rowsA).toHaveLength(0)
    expect(rowsB).toHaveLength(1)
    expect(rowsB[0]?.user_id).toBe('user-b')

    const countA = await countCheckinsForSession(ctx as never, 'session-a')
    const countB = await countCheckinsForSession(ctx as never, 'session-b')
    expect(countA).toBe(0)
    expect(countB).toBe(1)
  })

  it('returns sanitized feed rows while preserving ghost-mode privacy', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a', false)
    await seedUser(db, 'user-b', 'session-b', true)

    await recordActivityForSession(ctx as never, 'session-b', {
      activityType: 'checkin',
      actionText: 'a check-in a Gym Secret',
      xpEarned: 90,
      originLat: 48.86,
      originLng: 2.35,
    })

    const feedForA = await getSocialActivityFeed(ctx as never, {
      sessionToken: 'session-a',
      viewerLat: 44.84,
      viewerLng: -0.58,
      radiusKm: 1,
      limit: 10,
    })
    expect(feedForA).toHaveLength(1)
    expect(feedForA[0]?.pseudo).toBe('Athlete Furtif')
    expect(feedForA[0]?.distance_label).toBeNull()
    expect(feedForA[0]?.is_ghost_mode_enabled).toBe(true)
    expect(feedForA[0]?.is_self).toBe(false)

    const feedForB = await getSocialActivityFeed(ctx as never, {
      sessionToken: 'session-b',
      viewerLat: 48.86,
      viewerLng: 2.35,
      radiusKm: 25,
      limit: 10,
    })
    expect(feedForB[0]?.pseudo).toBe('Bravo')
    expect(feedForB[0]?.is_self).toBe(true)
  })

  it('isolates stats and AI daily counters between two users', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')
    await db.insert('workouts_state', {
      userId: 'user-b',
      stateJson: {
        workoutNotes: [
          {
            id: 'b1',
            dateKey: '2026-09-08',
            routineId: 'upper',
            exercises: [{ name: 'Bench Press', sets: [{ weightKg: 80, reps: 5 }] }],
          },
          {
            id: 'b2',
            dateKey: '2026-09-12',
            routineId: 'lower',
            exercises: [{ name: 'Squat', sets: [{ weightKg: 120, reps: 4 }] }],
          },
        ],
      },
      progressJson: {},
      updatedAt: Date.now(),
    })

    const statsA = (await getUserStatsForSession(ctx as never, 'session-a')) as {
      weekly_sessions: { completed: number }
    }
    const statsB = (await getUserStatsForSession(ctx as never, 'session-b')) as {
      weekly_sessions: { completed: number }
    }
    expect(statsA.weekly_sessions.completed).toBe(0)
    expect(statsB.weekly_sessions.completed).toBeGreaterThanOrEqual(1)

    for (let i = 0; i < 5; i += 1) {
      const usage = await reserveAiMealScanForSession(ctx as never, 'session-a')
      expect(usage.allowed).toBe(true)
    }
    const blocked = await reserveAiMealScanForSession(ctx as never, 'session-a')
    expect(blocked.allowed).toBe(false)
    expect(blocked.scan_count).toBe(5)

    const firstB = await reserveAiMealScanForSession(ctx as never, 'session-b')
    expect(firstB.allowed).toBe(true)
    expect(firstB.scan_count).toBe(1)

    await releaseAiMealScanForSession(ctx as never, 'session-a')
    const afterRelease = await reserveAiMealScanForSession(ctx as never, 'session-a')
    expect(afterRelease.allowed).toBe(true)
    expect(afterRelease.scan_count).toBe(5)
  })
})
