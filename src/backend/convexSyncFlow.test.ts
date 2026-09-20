import { describe, expect, it } from 'vitest'
import {
  isMeaningfulSyncPayload,
  loadSyncSnapshotForSession,
  pushSyncForSession,
} from '../../convex/sync'
import {
  applyDailyLoginStreakForSession,
  ensureProfileForSession,
  getProfileForSession,
} from '../../convex/profiles'
import { assertOwnedUserFile } from '../../convex/files'
import { assertUserOwnership, requireSessionUser } from '../../convex/lib/auth'
import { hashToken } from '../../convex/lib/authCrypto'
import { upsertImportedUserWithoutPassword } from '../../convex/auth'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'profiles'
  | 'workouts_state'
  | 'nutrition_state'
  | 'sleep_nights'
  | 'streak_state'
  | 'custom_spots'
  | 'active_checkins'
  | 'user_files'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    profiles: [],
    workouts_state: [],
    nutrition_state: [],
    sleep_nights: [],
    streak_state: [],
    custom_spots: [],
    active_checkins: [],
    user_files: [],
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

  delete(id: string) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key].splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  table<T extends TableName>(name: T): StoredRow[] {
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
        field: string
        value: unknown
      }
    }) => unknown,
  ) {
    const eqs: Array<{ field: string; value: unknown }> = []
    const chain = {
      eq(field: string, value: unknown) {
        eqs.push({ field, value })
        return chain
      },
      field: '',
      value: undefined as unknown,
    }
    fn(chain)
    this.filtered = this.filtered.filter((row) =>
      eqs.every((filter) => row[filter.field] === filter.value),
    )
    return this
  }

  order(direction: 'asc' | 'desc') {
    if (direction === 'desc') this.filtered.reverse()
    return this
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }

  take(limit: number) {
    return Promise.resolve(this.filtered.slice(0, limit))
  }
}

function createCtx(db: FakeDb): { db: FakeDb } {
  return { db }
}

async function seedUser(
  db: FakeDb,
  userId: string,
  sessionToken: string,
) {
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
}

describe('Convex sync isolation (2 users)', () => {
  it('lets user A read/write only A-owned domain docs', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')

    const pushed = await pushSyncForSession(ctx as never, 'session-b', {
      nutrition: {
        profileJson: { onboardingComplete: true, weightKg: 80 },
        journalJson: {
          '2026-09-13': {
            meals: [{ id: 'm1', name: 'B secret', calories: 500 }],
            waterEntries: [{ id: 'w1', amountMl: 250 }],
          },
        },
      },
      workouts: {
        stateJson: { workoutNotes: [{ id: 'b-note' }], completed: [], schedule: [], routines: [] },
        progressJson: { level: 9 },
      },
      sleep: [{ dateKey: '2026-09-12', bedtime: '23:00', waketime: '07:00', tstHours: 7 }],
    })
    expect(pushed.applied).toBe(true)

    const snapshotA = await loadSyncSnapshotForSession(ctx as never, 'session-a')
    expect(snapshotA.nutrition).toBeNull()
    expect(snapshotA.workouts).toBeNull()
    expect(snapshotA.sleep).toEqual([])

    const snapshotB = await loadSyncSnapshotForSession(ctx as never, 'session-b')
    expect(snapshotB.sleep).toHaveLength(1)
    const journalB = snapshotB.nutrition?.journalJson as { '2026-09-13'?: { meals: unknown[] } } | undefined
    expect(journalB?.['2026-09-13']?.meals).toHaveLength(1)

    const sessionA = await requireSessionUser(ctx as never, 'session-a')
    expect(() => assertUserOwnership('user-b', sessionA.userId)).toThrow(/cross-user access denied/i)
  })

  it('rejects user A fetching user B private avatar file metadata', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')
    const fileId = await db.insert('user_files', {
      userId: 'user-b',
      kind: 'avatar',
      storageId: 'storage-b',
      contentType: 'image/jpeg',
      sizeBytes: 12,
      sha256: 'abc',
      createdAt: Date.now(),
    })

    await expect(assertOwnedUserFile(ctx as never, 'session-a', fileId as never)).rejects.toThrow(
      /cross-user access denied/i,
    )
    const owned = await assertOwnedUserFile(ctx as never, 'session-b', fileId as never)
    expect(owned?.file.userId).toBe('user-b')
  })
})

describe('Convex sync overwrite protection', () => {
  it('treats sleep and hydration as meaningful cloud data', () => {
    expect(
      isMeaningfulSyncPayload({
        sleep: [{ dateKey: '2026-09-12', bedtime: '23:00', waketime: '07:00', tstHours: 7 }],
      }),
    ).toBe(true)
    expect(
      isMeaningfulSyncPayload({
        nutrition: {
          profileJson: {},
          journalJson: { '2026-09-13': { waterEntries: [{ amountMl: 250 }] } },
        },
      }),
    ).toBe(true)
    expect(isMeaningfulSyncPayload({ nutrition: { profileJson: {}, journalJson: {} } })).toBe(false)
  })

  it('refuses to overwrite meaningful remote state with a blank local payload', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await pushSyncForSession(ctx as never, 'session-a', {
      nutrition: {
        profileJson: { onboardingComplete: true },
        journalJson: {
          '2026-09-13': { meals: [{ id: 'keep-me', name: 'Oats', calories: 300 }] },
        },
      },
      sleep: [{ dateKey: '2026-09-12', bedtime: '23:30', waketime: '07:00', tstHours: 6.5 }],
    })

    const skipped = await pushSyncForSession(ctx as never, 'session-a', {
      nutrition: { profileJson: {}, journalJson: {} },
      workouts: { stateJson: {}, progressJson: {} },
      sleep: [],
      lobby: { customGyms: [], checkIn: null },
    })
    expect(skipped.applied).toBe(false)
    expect(skipped.skippedEmptyOverwrite).toBe(true)

    const snapshot = await loadSyncSnapshotForSession(ctx as never, 'session-a')
    expect(snapshot.sleep).toHaveLength(1)
    const journal = snapshot.nutrition?.journalJson as { '2026-09-13'?: { meals: unknown[] } } | undefined
    expect(journal?.['2026-09-13']?.meals).toHaveLength(1)
  })

  it('rejects a stale baseUpdatedAt instead of clobbering a newer snapshot', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    const first = await pushSyncForSession(ctx as never, 'session-a', {
      sleep: [{ dateKey: '2026-09-11', bedtime: '22:00', waketime: '06:00', tstHours: 7 }],
    })
    const stale = await pushSyncForSession(ctx as never, 'session-a', {
      baseUpdatedAt: first.updatedAt - 10_000,
      sleep: [{ dateKey: '2026-09-10', bedtime: '21:00', waketime: '05:00', tstHours: 6 }],
    })
    expect(stale.applied).toBe(false)
    expect(stale.stale).toBe(true)
    const snapshot = await loadSyncSnapshotForSession(ctx as never, 'session-a')
    expect(snapshot.sleep[0]?.dateKey).toBe('2026-09-11')
  })
})

describe('Convex profile + streak CAS', () => {
  it('ensures a profile for the session user and isolates streak writes', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')

    const profileA = await ensureProfileForSession(ctx as never, 'session-a', 'Alpha')
    expect(profileA.userId).toBe('user-a')
    expect(profileA.currentStreak).toBe(0)

    const updated = await applyDailyLoginStreakForSession(ctx as never, 'session-a', {
      expectedLastLoginDate: null,
      today: '2026-09-13',
      nextStreak: 1,
      nextLevel: 1,
      nextXp: 0,
      nextRank: 'Bronze',
    })
    expect(updated.didUpdate).toBe(true)
    expect(updated.profile.currentStreak).toBe(1)

    const lostRace = await applyDailyLoginStreakForSession(ctx as never, 'session-a', {
      expectedLastLoginDate: null,
      today: '2026-09-13',
      nextStreak: 1,
      nextLevel: 1,
      nextXp: 0,
      nextRank: 'Bronze',
    })
    expect(lostRace.didUpdate).toBe(false)
    expect(lostRace.profile.currentStreak).toBe(1)

    const profileB = await getProfileForSession(ctx as never, 'session-b')
    expect(profileB).toBeNull()
  })
})

describe('Auth global-reset policy remains intact', () => {
  it('still imports users without passwords and does not keep credentials', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const now = Date.now()
    await db.insert('auth_users', {
      userId: 'legacy-user',
      email: 'legacy@example.com',
      emailNorm: 'legacy@example.com',
      displayName: 'Legacy User',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_password_credentials', {
      userId: 'legacy-user',
      passwordHash: 'pbkdf2_sha256$200000$abc$xyz',
      updatedAt: now,
    })
    const outcome = await upsertImportedUserWithoutPassword(ctx as never, {
      email: 'legacy@example.com',
    })
    expect(outcome).toBe('updated')
    expect(db.table('auth_password_credentials')).toHaveLength(0)
    expect(db.table('auth_users')[0].mustResetPassword).toBe(true)
  })
})
