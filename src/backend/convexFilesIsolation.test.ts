import { describe, expect, it } from 'vitest'
import {
  deleteOwnAvatarForSession,
  getOwnedFileView,
  importSupabaseAvatarForUser,
} from '../../convex/files'
import { hashToken } from '../../convex/lib/authCrypto'

type TableName = 'auth_users' | 'auth_sessions' | 'profiles' | 'user_files' | 'migration_runs'
type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    profiles: [],
    user_files: [],
    migration_runs: [],
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

  collect() {
    return Promise.resolve([...this.filtered])
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
}

class FakeStorage {
  readonly signedUrlCalls: string[] = []
  readonly deleteCalls: string[] = []
  private counter = 0

  getUrl(storageId: string) {
    this.signedUrlCalls.push(storageId)
    return Promise.resolve(`https://signed.example/${storageId}?sig=${this.signedUrlCalls.length}`)
  }

  delete(storageId: string) {
    this.deleteCalls.push(storageId)
    return Promise.resolve()
  }

  generateUploadUrl() {
    this.counter += 1
    return Promise.resolve(`https://upload.example/${this.counter}`)
  }
}

function createCtx(db: FakeDb, storage: FakeStorage): { db: FakeDb; storage: FakeStorage } {
  return { db, storage }
}

async function seedUser(db: FakeDb, userId: string, sessionToken: string) {
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
    expiresAt: now + 120_000,
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
}

describe('Convex file storage isolation', () => {
  it('never issues signed URLs for cross-user access', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')
    const fileId = await db.insert('user_files', {
      userId: 'user-b',
      kind: 'avatar',
      storageId: 'storage-b-1',
      contentType: 'image/jpeg',
      sizeBytes: 42,
      sha256: 'deadbeef',
      createdAt: Date.now(),
    })

    await expect(getOwnedFileView(ctx as never, 'session-a', fileId as never)).rejects.toThrow(
      /cross-user access denied/i,
    )
    expect(storage.signedUrlCalls).toHaveLength(0)

    const owned = await getOwnedFileView(ctx as never, 'session-b', fileId as never)
    expect(owned?.userId).toBe('user-b')
    expect(storage.signedUrlCalls).toEqual(['storage-b-1'])
  })

  it('deletes only the caller avatar and clears profile pointer', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')
    const fileA = await db.insert('user_files', {
      userId: 'user-a',
      kind: 'avatar',
      storageId: 'storage-a-1',
      contentType: 'image/jpeg',
      sizeBytes: 30,
      sha256: 'aaa',
      createdAt: Date.now(),
    })
    await db.insert('user_files', {
      userId: 'user-b',
      kind: 'avatar',
      storageId: 'storage-b-1',
      contentType: 'image/jpeg',
      sizeBytes: 31,
      sha256: 'bbb',
      createdAt: Date.now(),
    })
    const profileA = db.table('profiles').find((row) => row.userId === 'user-a')
    expect(profileA).toBeTruthy()
    await db.patch(profileA!._id, { avatarFileId: fileA })

    const result = await deleteOwnAvatarForSession(ctx as never, 'session-a')
    expect(result.deleted).toBe(true)
    expect(result.fileId).toBe(fileA)
    expect(storage.deleteCalls).toEqual(['storage-a-1'])

    const updatedProfileA = db.table('profiles').find((row) => row.userId === 'user-a')
    expect(updatedProfileA?.avatarFileId).toBeUndefined()
    const updatedFileA = db.table('user_files').find((row) => row._id === fileA)
    expect(typeof updatedFileA?.replacedAt).toBe('number')

    const fileB = db.table('user_files').find((row) => row.userId === 'user-b')
    expect(fileB?.replacedAt).toBeUndefined()
  })

  it('imports Supabase avatars only for known migration runs', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    await seedUser(db, 'user-a', 'session-a')
    await db.insert('migration_runs', {
      runId: 'run-avatar-1',
      startedAt: Date.now(),
      status: 'running',
      sourceSha: 'sha-123',
      summaryJson: {},
    })

    await expect(
      importSupabaseAvatarForUser(ctx as never, {
        runId: 'run-avatar-1',
        sourceSha: 'different-sha',
        userId: 'user-a',
        legacySupabasePath: 'user-a/avatar.jpg',
        storageId: 'storage-a-imported' as never,
        contentType: 'image/jpeg',
        sizeBytes: 300,
        sha256: 'imported',
      }),
    ).rejects.toThrow(/MIGRATION_SOURCE_SHA_MISMATCH/i)

    const imported = await importSupabaseAvatarForUser(ctx as never, {
      runId: 'run-avatar-1',
      sourceSha: 'sha-123',
      userId: 'user-a',
      legacySupabasePath: 'user-a/avatar.jpg',
      storageId: 'storage-a-imported' as never,
      contentType: 'image/jpeg',
      sizeBytes: 300,
      sha256: 'imported',
    })
    expect(imported.userId).toBe('user-a')
    expect(imported.legacySupabasePath).toBe('user-a/avatar.jpg')
  })
})
