import { describe, expect, it } from 'vitest'
import {
  countLegacyLocationRows,
  purgeLegacyLocationRows,
} from '../../convex/legacyLocation'
import { createCheckinForSession } from '../../convex/rpc'
import { pushSyncForSession } from '../../convex/sync'
import { deleteAccountAndUserData } from '../../convex/auth'
import { hashToken } from '../../convex/lib/authCrypto'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'checkins'
  | 'custom_spots'
  | 'active_checkins'
  | 'profiles'
  | 'workouts_state'
  | 'nutrition_state'
  | 'sleep_nights'
  | 'streak_state'
  | 'aliments'
  | 'activities'
  | 'ai_usage_limits'
  | 'rate_limit_buckets'
  | 'user_files'
  | 'nutrition_meals'
  | 'nutrition_water_entries'
  | 'nutrition_day_state'
  | 'nutrition_food_catalog'
  | 'password_reset_tokens'
  | 'password_reset_outbox'
  | 'avis_beta'
  | 'migration_runs'
  | 'migration_entity_map'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {}

  private tableRows(table: string): StoredRow[] {
    if (!this.rows[table]) this.rows[table] = []
    return this.rows[table]
  }

  insert(table: TableName | string, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.tableRows(table).push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName | string) {
    return new FakeQuery(this.tableRows(table))
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
    for (const key of Object.keys(this.rows)) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key].splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  table(name: string): StoredRow[] {
    return this.tableRows(name)
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

  take(limit: number) {
    return Promise.resolve(this.filtered.slice(0, limit))
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
}

function createCtx(db: FakeDb) {
  return { db }
}

async function seedUser(db: FakeDb, userId: string, sessionToken: string, password = 'pw-test') {
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
  // password hash format used by auth helpers in other tests — insert a stub credential
  const { hashPassword } = await import('../../convex/lib/authCrypto')
  await db.insert('auth_password_credentials', {
    userId,
    passwordHash: await hashPassword(password),
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + 60_000,
  })
}

describe('legacyLocation countRows / purge', () => {
  it('countRows returns only aggregate numbers', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await db.insert('checkins', {
      userId: 'u1',
      salleNom: 'A',
      salleLat: 48.8,
      salleLng: 2.3,
      gymPayload: { lat: 48.8 },
      createdAt: 1,
    })
    await db.insert('checkins', {
      userId: 'u2',
      salleNom: 'B',
      salleLat: null,
      salleLng: null,
      gymPayload: null,
      createdAt: 2,
    })
    await db.insert('custom_spots', {
      userId: 'u1',
      spotId: 's1',
      name: 'Spot',
      lat: 1,
      lng: 2,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.insert('active_checkins', {
      userId: 'u1',
      checkinJson: { gym: { lat: 1 } },
      updatedAt: 1,
    })

    const counts = await countLegacyLocationRows(ctx as never)
    expect(counts).toEqual({
      checkinsWithCoords: 1,
      checkinsTotal: 2,
      customSpots: 1,
      activeCheckins: 1,
    })
    expect(Object.keys(counts).sort()).toEqual(
      ['activeCheckins', 'checkinsTotal', 'checkinsWithCoords', 'customSpots'].sort(),
    )
    for (const value of Object.values(counts)) {
      expect(typeof value).toBe('number')
    }
  })

  it('purge dryRun (default) changes nothing; real run clears coords', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await db.insert('checkins', {
      userId: 'u1',
      salleNom: 'A',
      salleLat: 48.8,
      salleLng: 2.3,
      gymPayload: { id: 'g' },
      createdAt: 1,
    })
    await db.insert('custom_spots', {
      userId: 'u1',
      spotId: 's1',
      name: 'Spot',
      lat: 1,
      lng: 2,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.insert('active_checkins', {
      userId: 'u1',
      checkinJson: { gym: { lat: 1 } },
      updatedAt: 1,
    })

    const dry = await purgeLegacyLocationRows(ctx as never, {})
    expect(dry.dryRun).toBe(true)
    expect(dry.deletedCustomSpots).toBe(1)
    expect(dry.deletedActiveCheckins).toBe(1)
    expect(dry.clearedCheckins).toBe(1)
    expect(db.table('custom_spots')).toHaveLength(1)
    expect(db.table('active_checkins')).toHaveLength(1)
    expect(db.table('checkins')[0].salleLat).toBe(48.8)

    const real = await purgeLegacyLocationRows(ctx as never, { dryRun: false })
    expect(real.dryRun).toBe(false)
    expect(real.deletedCustomSpots).toBe(1)
    expect(real.deletedActiveCheckins).toBe(1)
    expect(real.clearedCheckins).toBe(1)
    expect(db.table('custom_spots')).toHaveLength(0)
    expect(db.table('active_checkins')).toHaveLength(0)
    expect(db.table('checkins')[0].salleLat).toBeNull()
    expect(db.table('checkins')[0].salleLng).toBeNull()
    expect(db.table('checkins')[0].gymPayload).toBeNull()
    expect(real.remainingCustomSpots).toBe(0)
    expect(real.remainingActiveCheckins).toBe(0)
    expect(real.remainingCheckinsWithCoords).toBe(0)
  })
})

describe('createCheckin strips coords from old clients', () => {
  it('ignores salleLat/salleLng/gymPayload on insert', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-b', 'session-b')

    const view = await createCheckinForSession(ctx as never, 'session-b', {
      salleNom: 'Gym B',
      salleLat: 48.86,
      salleLng: 2.35,
      gymPayload: { id: 'gym-b', lat: 48.86, lng: 2.35 },
    })

    expect(view.salle_lat).toBeNull()
    expect(view.salle_lng).toBeNull()
    expect(view.gym_payload).toBeNull()
    expect(db.table('checkins')[0].salleLat).toBeNull()
    expect(db.table('checkins')[0].salleLng).toBeNull()
    expect(db.table('checkins')[0].gymPayload).toBeNull()
  })
})

describe('sync push ignores lobby location writes', () => {
  it('does not insert custom_spots or active_checkins from lobby payload', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')

    const pushed = await pushSyncForSession(ctx as never, 'session-a', {
      sleep: [{ dateKey: '2026-09-12', bedtime: '23:00', waketime: '07:00', tstHours: 7 }],
      lobby: {
        customGyms: [{ id: 'spot-1', name: 'Secret', lat: 48.8, lng: 2.3 }],
        checkIn: {
          gymId: 'spot-1',
          gymName: 'Secret',
          checkedInAt: Date.now(),
          gym: { id: 'spot-1', lat: 48.8, lng: 2.3 },
        },
      },
    })
    expect(pushed.applied).toBe(true)
    expect(db.table('custom_spots')).toHaveLength(0)
    expect(db.table('active_checkins')).toHaveLength(0)
  })
})

describe('account deletion still clears lobby location tables', () => {
  it('deletes custom_spots, active_checkins, and checkins for the user', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const password = 'password-a'
    await seedUser(db, 'user-a', 'session-a', password)
    await seedUser(db, 'user-b', 'session-b', 'password-b')
    const now = Date.now()

    await db.insert('custom_spots', {
      userId: 'user-a',
      spotId: 'a',
      name: 'A',
      lat: 1,
      lng: 2,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('custom_spots', {
      userId: 'user-b',
      spotId: 'b',
      name: 'B',
      lat: 3,
      lng: 4,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('active_checkins', {
      userId: 'user-a',
      checkinJson: {},
      updatedAt: now,
    })
    await db.insert('active_checkins', {
      userId: 'user-b',
      checkinJson: {},
      updatedAt: now,
    })
    await db.insert('checkins', {
      userId: 'user-a',
      salleNom: 'A',
      salleLat: null,
      salleLng: null,
      gymPayload: null,
      createdAt: now,
    })
    await db.insert('checkins', {
      userId: 'user-b',
      salleNom: 'B',
      salleLat: null,
      salleLng: null,
      gymPayload: null,
      createdAt: now,
    })

    await deleteAccountAndUserData(ctx as never, {
      sessionToken: 'session-a',
      password,
    })

    expect(db.table('custom_spots').map((r) => r.userId)).toEqual(['user-b'])
    expect(db.table('active_checkins').map((r) => r.userId)).toEqual(['user-b'])
    expect(db.table('checkins').map((r) => r.userId)).toEqual(['user-b'])
  })
})
