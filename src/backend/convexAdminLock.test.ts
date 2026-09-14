import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getPasswordResetOutboxPreviewForAdmin,
  importUsersWithoutPasswords,
  importUsersWithoutPasswordsForAdmin,
  queueGlobalPasswordResetCampaign,
  queueGlobalPasswordResetCampaignForAdmin,
  getPasswordResetOutboxPreview,
} from '../../convex/auth'
import {
  generateMigrationAvatarUploadUrl,
  generateMigrationAvatarUploadUrlForRun,
  importSupabaseAvatar,
  importSupabaseAvatarForUser,
} from '../../convex/files'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  finishRun,
  finishRunForAdmin,
  getCounts,
  getCountsForAdmin,
  importEntity,
  importEntityForRun,
  startRun,
  startRunForAdmin,
} from '../../convex/migrations'

const ADMIN_SECRET = 'unit-test-admin-secret'
const RUN_SECRET = 'unit-test-run-secret'
const SOURCE_SHA = 'sha-lock-1'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'auth_password_reset_outbox'
  | 'auth_password_reset_tokens'
  | 'profiles'
  | 'workouts_state'
  | 'nutrition_state'
  | 'checkins'
  | 'aliments'
  | 'activities'
  | 'ai_usage_limits'
  | 'legacy_supabase_backups'
  | 'user_files'
  | 'migration_runs'
  | 'migration_entity_map'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    auth_password_reset_outbox: [],
    auth_password_reset_tokens: [],
    profiles: [],
    workouts_state: [],
    nutrition_state: [],
    checkins: [],
    aliments: [],
    activities: [],
    ai_usage_limits: [],
    legacy_supabase_backups: [],
    user_files: [],
    migration_runs: [],
    migration_entity_map: [],
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

  order(direction: 'asc' | 'desc') {
    if (direction === 'desc') this.filtered.reverse()
    return this
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }

  take(limit: number) {
    return Promise.resolve(this.filtered.slice(0, limit))
  }
}

class FakeStorage {
  generateUploadUrl() {
    return Promise.resolve('https://upload.example/migration')
  }
}

function createCtx(db: FakeDb, storage = new FakeStorage()) {
  return { db, storage }
}

async function seedSession(
  db: FakeDb,
  userId: string,
  sessionToken: string,
  role?: 'admin' | 'user',
) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId,
    email: `${userId}@example.com`,
    emailNorm: `${userId}@example.com`,
    displayName: userId,
    mustResetPassword: false,
    role,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + 120_000,
  })
}

describe('Convex admin/migration endpoint lock (C1-C3)', () => {
  const previousSecret = process.env.MIGRATION_ADMIN_SECRET

  beforeEach(() => {
    process.env.MIGRATION_ADMIN_SECRET = ADMIN_SECRET
  })

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.MIGRATION_ADMIN_SECRET
    else process.env.MIGRATION_ADMIN_SECRET = previousSecret
  })

  it('exposes migration/auth admin functions as internal-only', () => {
    expect(startRun.isInternal).toBe(true)
    expect(importEntity.isInternal).toBe(true)
    expect(finishRun.isInternal).toBe(true)
    expect(getCounts.isInternal).toBe(true)
    expect(generateMigrationAvatarUploadUrl.isInternal).toBe(true)
    expect(importSupabaseAvatar.isInternal).toBe(true)
    expect(importUsersWithoutPasswords.isInternal).toBe(true)
    expect(queueGlobalPasswordResetCampaign.isInternal).toBe(true)
    expect(getPasswordResetOutboxPreview.isInternal).toBe(true)
  })

  it('refuses unauthenticated migration and auth admin calls', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    await expect(
      startRunForAdmin(ctx as never, {
        runId: 'run-1',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
      }),
    ).rejects.toThrow(/Not authenticated/)

    await expect(
      importEntityForRun(ctx as never, {
        runId: 'run-1',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        entityType: 'profiles',
        supabaseId: 'user-a',
        checksum: 'abc',
        payload: { userId: 'user-a' },
      }),
    ).rejects.toThrow(/Not authenticated/)

    await expect(
      importUsersWithoutPasswordsForAdmin(ctx as never, {
        users: [{ email: 'a@example.com' }],
      }),
    ).rejects.toThrow(/Not authenticated/)

    await expect(
      queueGlobalPasswordResetCampaignForAdmin(ctx as never, {}),
    ).rejects.toThrow(/Not authenticated/)

    await expect(getPasswordResetOutboxPreviewForAdmin(ctx as never, {})).rejects.toThrow(
      /Not authenticated/,
    )
  })

  it('refuses a standard user session for migration and auth admin calls', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedSession(db, 'user-standard', 'session-standard', 'user')

    await expect(
      startRunForAdmin(ctx as never, {
        runId: 'run-1',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        sessionToken: 'session-standard',
      }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)

    await expect(
      importUsersWithoutPasswordsForAdmin(ctx as never, {
        users: [{ email: 'a@example.com' }],
        sessionToken: 'session-standard',
      }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)

    await expect(
      getCountsForAdmin(ctx as never, { sessionToken: 'session-standard' }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)
  })

  it('allows the admin-secret path to start and import a run', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    const started = await startRunForAdmin(ctx as never, {
      runId: 'run-admin-secret',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    expect(started.created).toBe(true)
    expect(db.table('migration_runs')[0]?.adminSecretHash).toBe(await hashToken(RUN_SECRET))

    const imported = await importEntityForRun(ctx as never, {
      runId: 'run-admin-secret',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-a',
      checksum: 'checksum-1',
      payload: { userId: 'user-a', pseudo: 'A', level: 2, xp: 10, rank: 'Bronze' },
    })
    expect(imported.operation).toBe('inserted')
    expect(imported.convexId).toBeTruthy()
  })

  it('allows an explicit admin-role session path', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedSession(db, 'user-admin', 'session-admin', 'admin')

    const started = await startRunForAdmin(ctx as never, {
      runId: 'run-admin-session',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      sessionToken: 'session-admin',
    })
    expect(started.created).toBe(true)

    const importedUsers = await importUsersWithoutPasswordsForAdmin(ctx as never, {
      sessionToken: 'session-admin',
      users: [{ email: 'legacy@example.com', displayName: 'Legacy' }],
    })
    expect(importedUsers.imported).toBe(1)

    const queued = await queueGlobalPasswordResetCampaignForAdmin(ctx as never, {
      sessionToken: 'session-admin',
    })
    expect(queued.queued).toBe(1)

    const preview = await getPasswordResetOutboxPreviewForAdmin(ctx as never, {
      sessionToken: 'session-admin',
    })
    expect(preview).toHaveLength(1)
    expect(preview[0]?.email).toBe('legacy@example.com')
  })

  it('cannot create or import a migration without the admin/run secret', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    await expect(
      startRunForAdmin(ctx as never, {
        runId: 'run-no-secret',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        adminSecret: 'wrong-admin-secret-xx',
      }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)

    await startRunForAdmin(ctx as never, {
      runId: 'run-real',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await expect(
      importEntityForRun(ctx as never, {
        runId: 'run-real',
        sourceSha: SOURCE_SHA,
        runSecret: 'invented-run-secret1',
        adminSecret: ADMIN_SECRET,
        entityType: 'profiles',
        supabaseId: 'user-a',
        checksum: 'checksum-1',
        payload: { userId: 'user-a' },
      }),
    ).rejects.toThrow(/MIGRATION_RUN_SECRET_INVALID/)

    await expect(
      importEntityForRun(ctx as never, {
        runId: 'invented-run-id',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        adminSecret: ADMIN_SECRET,
        entityType: 'profiles',
        supabaseId: 'user-a',
        checksum: 'checksum-1',
        payload: { userId: 'user-a' },
      }),
    ).rejects.toThrow(/MIGRATION_RUN_NOT_FOUND/)

    await expect(
      finishRunForAdmin(ctx as never, {
        runId: 'invented-run-id',
        runSecret: RUN_SECRET,
        adminSecret: ADMIN_SECRET,
        status: 'completed',
        summaryJson: {},
      }),
    ).rejects.toThrow(/MIGRATION_RUN_NOT_FOUND/)
  })

  it('refuses avatar migration when the runId is invented or the run secret is wrong', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    await seedSession(db, 'user-a', 'session-a')

    await expect(
      generateMigrationAvatarUploadUrlForRun(ctx as never, {
        runId: 'invented-run',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        adminSecret: ADMIN_SECRET,
      }),
    ).rejects.toThrow(/MIGRATION_RUN_NOT_FOUND/)

    await startRunForAdmin(ctx as never, {
      runId: 'run-avatar',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await expect(
      generateMigrationAvatarUploadUrlForRun(ctx as never, {
        runId: 'run-avatar',
        sourceSha: SOURCE_SHA,
        runSecret: 'wrong-run-secret-xx',
        adminSecret: ADMIN_SECRET,
      }),
    ).rejects.toThrow(/MIGRATION_RUN_SECRET_INVALID/)

    const upload = await generateMigrationAvatarUploadUrlForRun(ctx as never, {
      runId: 'run-avatar',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    expect(upload.uploadUrl).toContain('https://upload.example/')

    await expect(
      importSupabaseAvatarForUser(ctx as never, {
        runId: 'run-avatar',
        sourceSha: SOURCE_SHA,
        runSecret: 'wrong-run-secret-xx',
        adminSecret: ADMIN_SECRET,
        userId: 'user-a',
        legacySupabasePath: 'user-a/avatar.jpg',
        storageId: 'storage-1' as never,
        contentType: 'image/jpeg',
        sizeBytes: 10,
        sha256: 'abc',
      }),
    ).rejects.toThrow(/MIGRATION_RUN_SECRET_INVALID/)
  })
})
