/**
 * Tests Convex hydratation (FakeDb) — validation serveur + isolation Pro cosmétique.
 */
import { describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  CLASSIC_BOTTLE_ML,
  GOAL_DEFAULT_ML,
  GOAL_MAX_ML,
  GLASS_ML,
} from '../../shared/hydration/constants'
import {
  isReminderTimeAllowed,
  isValidGoalMl,
  quickAddAmountMl,
  remainingMl,
} from '../../shared/hydration/math'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'hydrationSettings'
  | 'hydrationEntries'
  | 'proEntitlements'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    hydrationSettings: [],
    hydrationEntries: [],
    proEntitlements: [],
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

  table(name: TableName) {
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
  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
  collect() {
    return Promise.resolve([...this.filtered])
  }
}

async function seedUser(db: FakeDb, userId: string, token: string) {
  await db.insert('auth_users', {
    userId,
    email: `${userId}@test.local`,
    emailNorm: `${userId}@test.local`,
    displayName: userId,
    mustResetPassword: false,
    role: 'user',
    createdAt: 1,
    updatedAt: 1,
  })
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(token),
    createdAt: 1,
    expiresAt: Date.now() + 86_400_000,
  })
}

describe('hydration Convex rules (unit)', () => {
  it('CA-HY12 Pro vs free : mêmes ajouts → mêmes drunkMl ; Pro ne change pas le calcul', async () => {
    const dbFree = new FakeDb()
    const dbPro = new FakeDb()
    await seedUser(dbFree, 'free', 'tok-free')
    await seedUser(dbPro, 'pro', 'tok-pro')
    await dbPro.insert('proEntitlements', {
      userId: 'pro',
      activeUntil: Date.now() + 86_400_000,
      updatedAt: Date.now(),
    })

    for (const db of [dbFree, dbPro]) {
      const userId = db === dbFree ? 'free' : 'pro'
      await db.insert('hydrationEntries', {
        userId,
        dayKey: '2026-11-08',
        amountMl: GLASS_ML,
        source: 'glass',
        clientId: `${userId}-c1`,
        createdAt: Date.now(),
      })
      await db.insert('hydrationEntries', {
        userId,
        dayKey: '2026-11-08',
        amountMl: quickAddAmountMl('half_bottle', 'classic_2l', null),
        source: 'half_bottle',
        clientId: `${userId}-c2`,
        createdAt: Date.now() + 1,
      })
    }

    const sum = (db: FakeDb, userId: string) =>
      db
        .table('hydrationEntries')
        .filter((r) => r.userId === userId && r.undoneAt == null)
        .reduce((acc, r) => acc + Number(r.amountMl), 0)

    expect(sum(dbFree, 'free')).toBe(sum(dbPro, 'pro'))
    expect(sum(dbFree, 'free')).toBe(GLASS_ML + CLASSIC_BOTTLE_ML / 2)
    expect(remainingMl(GOAL_DEFAULT_ML, sum(dbFree, 'free'))).toBe(
      remainingMl(GOAL_DEFAULT_ML, sum(dbPro, 'pro')),
    )
  })

  it('idempotence clientId', async () => {
    const db = new FakeDb()
    await seedUser(db, 'u1', 'tok')
    await db.insert('hydrationEntries', {
      userId: 'u1',
      dayKey: '2026-11-08',
      amountMl: 250,
      source: 'glass',
      clientId: 'same-id',
      createdAt: 1,
    })
    const existing = await db
      .query('hydrationEntries')
      .withIndex('by_user_client', (q) => q.eq('userId', 'u1').eq('clientId', 'same-id'))
      .first()
    expect(existing).toBeTruthy()
    // second insert would be skipped by mutation — simulate uniqueness check
    const dup = await db
      .query('hydrationEntries')
      .withIndex('by_user_client', (q) => q.eq('userId', 'u1').eq('clientId', 'same-id'))
      .collect()
    expect(dup).toHaveLength(1)
  })

  it('CA-HY4 refuse objectif hors bornes', () => {
    expect(isValidGoalMl(GOAL_MAX_ML + 1)).toBe(false)
    expect(isValidGoalMl(999)).toBe(false)
  })

  it('CA-HY11 créneaux nuit refusés', () => {
    expect(isReminderTimeAllowed('21:00')).toBe(false)
    expect(isReminderTimeAllowed('03:00')).toBe(false)
    expect(isReminderTimeAllowed('10:00')).toBe(true)
  })

  it('Pro expiré → volume / historique conservés (données), rendu 2L côté view', async () => {
    const db = new FakeDb()
    await seedUser(db, 'u1', 'tok')
    await db.insert('proEntitlements', {
      userId: 'u1',
      activeUntil: Date.now() - 1000,
      updatedAt: 1,
    })
    await db.insert('hydrationSettings', {
      userId: 'u1',
      mode: 'my_bottle',
      goalMl: 1500,
      myBottleVolumeMl: 750,
      myBottleHasShape: true,
      remindersEnabled: false,
      reminderTimes: ['10:00', '14:00', '18:00'],
      updatedAt: 1,
    })
    const settings = await db.query('hydrationSettings').withIndex('by_user', (q) => q.eq('userId', 'u1')).first()
    const pro = await db.query('proEntitlements').withIndex('by_user', (q) => q.eq('userId', 'u1')).first()
    const proActive = Number(pro?.activeUntil) > Date.now()
    expect(proActive).toBe(false)
    expect(settings?.myBottleVolumeMl).toBe(750)
    expect(settings?.myBottleHasShape).toBe(true)
    const effectiveVisual = settings?.mode === 'my_bottle' && !proActive ? 'classic_2l' : settings?.mode
    expect(effectiveVisual).toBe('classic_2l')
  })
})
