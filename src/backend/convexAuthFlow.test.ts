import { describe, expect, it } from 'vitest'
import {
  consumePasswordResetToken,
  createResetLink,
  deleteAccountAndUserData,
  issuePasswordResetToken,
  registerUserWithEmail,
  upsertImportedUserWithoutPassword,
} from '../../convex/auth'
import {
  createPrivateNoteForSession,
  getPrivateNoteForSession,
  listPrivateNotesForSession,
} from '../../convex/authPrivateData'
import { assertUserOwnership, requireSessionUser } from '../../convex/lib/auth'
import { hashPassword, hashToken, verifyPassword } from '../../convex/lib/authCrypto'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'auth_password_reset_tokens'
  | 'auth_password_reset_outbox'
  | 'auth_private_notes'
  | 'profiles'
  | 'workouts_state'
  | 'nutrition_state'
  | 'sleep_nights'
  | 'checkins'
  | 'custom_spots'
  | 'active_checkins'
  | 'aliments'
  | 'activities'
  | 'ai_usage_limits'
  | 'streak_state'
  | 'user_files'
  | 'legacy_supabase_backups'
  | 'migration_entity_map'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    auth_password_reset_tokens: [],
    auth_password_reset_outbox: [],
    auth_private_notes: [],
    profiles: [],
    workouts_state: [],
    nutrition_state: [],
    sleep_nights: [],
    checkins: [],
    custom_spots: [],
    active_checkins: [],
    aliments: [],
    activities: [],
    ai_usage_limits: [],
    streak_state: [],
    user_files: [],
    legacy_supabase_backups: [],
    migration_entity_map: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${this.idCounter += 1}`, ...value }
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

  order(direction: 'asc' | 'desc') {
    if (direction === 'desc') {
      this.filtered.reverse()
    }
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

class FakeStorage {
  readonly deletedStorageIds: string[] = []

  delete(storageId: string) {
    this.deletedStorageIds.push(storageId)
    return Promise.resolve()
  }
}

function createCtx(db: FakeDb, storage = new FakeStorage()): { db: FakeDb; storage: FakeStorage } {
  return { db, storage }
}

describe('Convex auth password reset flow', () => {
  it('issues reset token, consumes it once, rotates sessions, and stores hashed password only', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const userId = 'user-a'
    const now = Date.now()
    await db.insert('auth_users', {
      userId,
      email: 'user-a@example.com',
      emailNorm: 'user-a@example.com',
      displayName: 'User A',
      mustResetPassword: true,
      createdAt: now,
      updatedAt: now,
    })
    const previousTokenHash = await hashToken('old-session-token')
    await db.insert('auth_sessions', {
      userId,
      tokenHash: previousTokenHash,
      createdAt: now,
      expiresAt: now + 30_000,
    })

    const issued = await issuePasswordResetToken(
      ctx as never,
      userId,
      'user-a@example.com',
      'user-a@example.com',
      'https://rankedgym.app',
    )
    expect(issued.rawToken).toBeTruthy()
    expect(db.table('auth_password_reset_outbox')).toHaveLength(1)

    const result = await consumePasswordResetToken(
      ctx as never,
      issued.rawToken,
      'new-password-123',
    )

    const credentials = db.table('auth_password_credentials')
    expect(credentials).toHaveLength(1)
    const storedPasswordHash = String(credentials[0].passwordHash)
    expect(storedPasswordHash).not.toContain('new-password-123')
    await expect(verifyPassword('new-password-123', storedPasswordHash)).resolves.toBe(true)

    const users = db.table('auth_users')
    expect(users[0].mustResetPassword).toBe(false)

    const resetTokens = db.table('auth_password_reset_tokens')
    expect(resetTokens[0].consumedAt).toBeTypeOf('number')

    const sessions = db.table('auth_sessions')
    const revoked = sessions.filter((row) => typeof row.revokedAt === 'number')
    const active = sessions.filter((row) => !row.revokedAt)
    expect(revoked.length).toBeGreaterThanOrEqual(1)
    expect(active).toHaveLength(1)
    expect(result.sessionToken).toBeTruthy()

    await expect(
      consumePasswordResetToken(ctx as never, issued.rawToken, 'another-password'),
    ).rejects.toThrow(/AUTH_RESET_TOKEN_INVALID/)
  })

  it('builds a safe https reset link', () => {
    const url = createResetLink('https://ranked-gym.pages.dev', 'token-123')
    expect(url).toContain('https://ranked-gym.pages.dev/auth/reset-password?token=token-123')
  })
})

describe('Convex auth isolation guard (2 users)', () => {
  it('rejects cross-user access for auth-gated query/mutation flows', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const now = Date.now()
    await db.insert('auth_users', {
      userId: 'user-a',
      email: 'a@example.com',
      emailNorm: 'a@example.com',
      displayName: 'A',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_users', {
      userId: 'user-b',
      email: 'b@example.com',
      emailNorm: 'b@example.com',
      displayName: 'B',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_sessions', {
      userId: 'user-a',
      tokenHash: await hashToken('session-a'),
      createdAt: now,
      expiresAt: now + 60_000,
    })
    await db.insert('auth_sessions', {
      userId: 'user-b',
      tokenHash: await hashToken('session-b'),
      createdAt: now,
      expiresAt: now + 60_000,
    })

    const sessionUserA = await requireSessionUser(ctx as never, 'session-a')
    expect(sessionUserA.userId).toBe('user-a')
    expect(() => assertUserOwnership('user-b', sessionUserA.userId)).toThrow(
      /cross-user access denied/i,
    )
    expect(() => assertUserOwnership('user-a', sessionUserA.userId)).not.toThrow()
  })
})

describe('Convex auth migration policy (global reset, no legacy bridge)', () => {
  it('imports users without passwords and removes existing credentials', async () => {
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
      displayName: 'Legacy Renamed',
    })
    expect(outcome).toBe('updated')
    expect(db.table('auth_password_credentials')).toHaveLength(0)

    const user = db.table('auth_users')[0]
    expect(user.mustResetPassword).toBe(true)
    expect(user.displayName).toBe('Legacy Renamed')
  })
})

describe('Convex auth-gated private data isolation', () => {
  it('ensures user A cannot read user B private note', async () => {
    const db = new FakeDb()
    const mutationCtx = createCtx(db)
    const queryCtx = createCtx(db)
    const now = Date.now()
    await db.insert('auth_users', {
      userId: 'user-a',
      email: 'a@example.com',
      emailNorm: 'a@example.com',
      displayName: 'A',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_users', {
      userId: 'user-b',
      email: 'b@example.com',
      emailNorm: 'b@example.com',
      displayName: 'B',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_sessions', {
      userId: 'user-a',
      tokenHash: await hashToken('session-a'),
      createdAt: now,
      expiresAt: now + 60_000,
    })
    await db.insert('auth_sessions', {
      userId: 'user-b',
      tokenHash: await hashToken('session-b'),
      createdAt: now,
      expiresAt: now + 60_000,
    })

    const noteB = await createPrivateNoteForSession(
      mutationCtx as never,
      'session-b',
      'private note from user b',
    )
    const notesA = await listPrivateNotesForSession(queryCtx as never, 'session-a')
    expect(notesA).toHaveLength(0)

    await expect(
      getPrivateNoteForSession(queryCtx as never, 'session-a', noteB.noteId),
    ).rejects.toThrow(/cross-user access denied/i)

    const ownNote = await getPrivateNoteForSession(
      queryCtx as never,
      'session-b',
      noteB.noteId,
    )
    expect(ownNote?.content).toContain('user b')
  })
})

describe('Convex signup private-beta server enforcement', () => {
  it('rejects signups by default and allows signups only when explicitly enabled', async () => {
    const previous = process.env.CONVEX_ALLOW_PUBLIC_SIGNUP
    try {
      delete process.env.CONVEX_ALLOW_PUBLIC_SIGNUP
      const db = new FakeDb()
      const ctx = createCtx(db)

      await expect(
        registerUserWithEmail(ctx as never, {
          email: 'beta-user@example.com',
          password: 'password-123',
          displayName: 'Beta User',
        }),
      ).rejects.toThrow(/AUTH_SIGNUP_DISABLED/)

      process.env.CONVEX_ALLOW_PUBLIC_SIGNUP = 'true'
      const created = await registerUserWithEmail(ctx as never, {
        email: 'beta-user@example.com',
        password: 'password-123',
        displayName: 'Beta User',
      })

      expect(created.sessionToken).toBeTruthy()
      expect(created.user.email).toBe('beta-user@example.com')
      expect(db.table('auth_users')).toHaveLength(1)
      expect(db.table('auth_password_credentials')).toHaveLength(1)
    } finally {
      if (previous === undefined) {
        delete process.env.CONVEX_ALLOW_PUBLIC_SIGNUP
      } else {
        process.env.CONVEX_ALLOW_PUBLIC_SIGNUP = previous
      }
    }
  })
})

describe('Convex deleteOwnAccount full cascade and isolation', () => {
  it('deletes all user A domain/auth data and storage while leaving user B untouched', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    const now = Date.now()
    const userA = 'user-a'
    const userB = 'user-b'
    const sessionA = 'session-a'

    await db.insert('auth_users', {
      userId: userA,
      email: 'a@example.com',
      emailNorm: 'a@example.com',
      displayName: 'A',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_users', {
      userId: userB,
      email: 'b@example.com',
      emailNorm: 'b@example.com',
      displayName: 'B',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_password_credentials', {
      userId: userA,
      passwordHash: await hashPassword('password-a'),
      updatedAt: now,
    })
    await db.insert('auth_password_credentials', {
      userId: userB,
      passwordHash: await hashPassword('password-b'),
      updatedAt: now,
    })
    await db.insert('auth_sessions', {
      userId: userA,
      tokenHash: await hashToken(sessionA),
      createdAt: now,
      expiresAt: now + 60_000,
    })
    await db.insert('auth_sessions', {
      userId: userB,
      tokenHash: await hashToken('session-b'),
      createdAt: now,
      expiresAt: now + 60_000,
    })
    await db.insert('auth_password_reset_tokens', {
      userId: userA,
      tokenHash: 'token-a',
      createdAt: now,
      expiresAt: now + 60_000,
    })
    await db.insert('auth_password_reset_tokens', {
      userId: userB,
      tokenHash: 'token-b',
      createdAt: now,
      expiresAt: now + 60_000,
    })
    await db.insert('auth_password_reset_outbox', {
      userId: userA,
      email: 'a@example.com',
      emailNorm: 'a@example.com',
      resetLink: 'https://example.com/reset?a',
      tokenHash: 'token-a',
      createdAt: now,
      attemptCount: 0,
    })
    await db.insert('auth_password_reset_outbox', {
      userId: userB,
      email: 'b@example.com',
      emailNorm: 'b@example.com',
      resetLink: 'https://example.com/reset?b',
      tokenHash: 'token-b',
      createdAt: now,
      attemptCount: 0,
    })
    await db.insert('auth_private_notes', {
      userId: userA,
      content: 'note-a',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_private_notes', {
      userId: userB,
      content: 'note-b',
      createdAt: now,
      updatedAt: now,
    })

    await db.insert('profiles', {
      userId: userA,
      pseudo: 'A',
      level: 2,
      xp: 100,
      rank: 'Silver',
      discipline: 'Musculation',
      isGhostModeEnabled: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('profiles', {
      userId: userB,
      pseudo: 'B',
      level: 3,
      xp: 150,
      rank: 'Gold',
      discipline: 'Musculation',
      isGhostModeEnabled: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('workouts_state', {
      userId: userA,
      stateJson: {},
      progressJson: {},
      updatedAt: now,
    })
    await db.insert('workouts_state', {
      userId: userB,
      stateJson: {},
      progressJson: {},
      updatedAt: now,
    })
    await db.insert('nutrition_state', {
      userId: userA,
      profileJson: {},
      journalJson: {},
      updatedAt: now,
    })
    await db.insert('nutrition_state', {
      userId: userB,
      profileJson: {},
      journalJson: {},
      updatedAt: now,
    })
    await db.insert('sleep_nights', {
      userId: userA,
      dateKey: '2026-09-12',
      bedtime: '22:00',
      waketime: '06:00',
      tstHours: 8,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('sleep_nights', {
      userId: userB,
      dateKey: '2026-09-12',
      bedtime: '22:00',
      waketime: '06:00',
      tstHours: 8,
      createdAt: now,
      updatedAt: now,
    })
    const checkinAId = await db.insert('checkins', {
      userId: userA,
      legacySupabaseId: 'checkin-a',
      salleNom: 'A Gym',
      createdAt: now,
    })
    const checkinBId = await db.insert('checkins', {
      userId: userB,
      legacySupabaseId: 'checkin-b',
      salleNom: 'B Gym',
      createdAt: now,
    })
    await db.insert('custom_spots', {
      userId: userA,
      spotId: 'spot-a',
      name: 'Spot A',
      lat: 1,
      lng: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('custom_spots', {
      userId: userB,
      spotId: 'spot-b',
      name: 'Spot B',
      lat: 2,
      lng: 2,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('active_checkins', {
      userId: userA,
      checkinJson: {},
      updatedAt: now,
    })
    await db.insert('active_checkins', {
      userId: userB,
      checkinJson: {},
      updatedAt: now,
    })
    await db.insert('aliments', {
      userId: userA,
      legacySupabaseId: 'aliment-a',
      nom: 'A Food',
      calories: 100,
      proteines: 10,
      glucides: 10,
      lipides: 10,
      createdAt: now,
    })
    await db.insert('aliments', {
      userId: userB,
      legacySupabaseId: 'aliment-b',
      nom: 'B Food',
      calories: 120,
      proteines: 12,
      glucides: 12,
      lipides: 12,
      createdAt: now,
    })
    await db.insert('activities', {
      userId: userA,
      legacySupabaseId: 'activity-a',
      activityType: 'workout',
      actionText: 'A did workout',
      xpEarned: 12,
      createdAt: now,
    })
    await db.insert('activities', {
      userId: userB,
      legacySupabaseId: 'activity-b',
      activityType: 'workout',
      actionText: 'B did workout',
      xpEarned: 15,
      createdAt: now,
    })
    await db.insert('ai_usage_limits', {
      userId: userA,
      dateOfScan: '2026-09-13',
      scanCount: 2,
      updatedAt: now,
    })
    await db.insert('ai_usage_limits', {
      userId: userB,
      dateOfScan: '2026-09-13',
      scanCount: 1,
      updatedAt: now,
    })
    await db.insert('streak_state', {
      userId: userA,
      currentStreak: 4,
      lastLoginDate: '2026-09-13',
      updatedAt: now,
    })
    await db.insert('streak_state', {
      userId: userB,
      currentStreak: 8,
      lastLoginDate: '2026-09-13',
      updatedAt: now,
    })
    const userFileAId = await db.insert('user_files', {
      userId: userA,
      kind: 'avatar',
      storageId: 'storage-a',
      contentType: 'image/jpeg',
      sizeBytes: 1,
      sha256: 'sha-a',
      createdAt: now,
    })
    await db.insert('user_files', {
      userId: userB,
      kind: 'avatar',
      storageId: 'storage-b',
      contentType: 'image/jpeg',
      sizeBytes: 1,
      sha256: 'sha-b',
      createdAt: now,
    })
    await db.insert('legacy_supabase_backups', {
      userId: userA,
      payloadJson: { backup: 'a' },
      updatedAt: now,
      source: 'supabase_user_backups',
    })
    await db.insert('legacy_supabase_backups', {
      userId: userB,
      payloadJson: { backup: 'b' },
      updatedAt: now,
      source: 'supabase_user_backups',
    })
    await db.insert('migration_entity_map', {
      runId: 'run-1',
      entityType: 'checkins',
      supabaseId: 'sup-checkin-a',
      convexId: checkinAId,
      checksum: 'aaa',
      importedAt: now,
    })
    await db.insert('migration_entity_map', {
      runId: 'run-1',
      entityType: 'user_files',
      supabaseId: 'sup-file-a',
      convexId: userFileAId,
      checksum: 'bbb',
      importedAt: now,
    })
    await db.insert('migration_entity_map', {
      runId: 'run-1',
      entityType: 'checkins',
      supabaseId: 'sup-checkin-b',
      convexId: checkinBId,
      checksum: 'ccc',
      importedAt: now,
    })

    const deleted = await deleteAccountAndUserData(ctx as never, {
      sessionToken: sessionA,
      password: 'password-a',
    })
    expect(deleted.deleted).toBe(true)

    const rowsForA = (table: TableName) => db.table(table).filter((row) => row.userId === userA)
    const rowsForB = (table: TableName) => db.table(table).filter((row) => row.userId === userB)
    const userScopedTables: TableName[] = [
      'auth_users',
      'auth_password_credentials',
      'auth_sessions',
      'auth_password_reset_tokens',
      'auth_password_reset_outbox',
      'auth_private_notes',
      'profiles',
      'workouts_state',
      'nutrition_state',
      'sleep_nights',
      'checkins',
      'custom_spots',
      'active_checkins',
      'aliments',
      'activities',
      'ai_usage_limits',
      'streak_state',
      'user_files',
      'legacy_supabase_backups',
    ]
    for (const table of userScopedTables) {
      expect(rowsForA(table), `expected ${table} rows for user A to be deleted`).toHaveLength(0)
      expect(rowsForB(table), `expected ${table} rows for user B to remain`).toHaveLength(1)
    }

    expect(db.table('migration_entity_map').map((row) => row.supabaseId)).toEqual(['sup-checkin-b'])
    expect(storage.deletedStorageIds).toEqual(['storage-a'])
  })
})
