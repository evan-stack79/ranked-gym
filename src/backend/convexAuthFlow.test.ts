import { describe, expect, it } from 'vitest'
import {
  consumePasswordResetToken,
  createResetLink,
  issuePasswordResetToken,
  upsertImportedUserWithoutPassword,
} from '../../convex/auth'
import {
  createPrivateNoteForSession,
  getPrivateNoteForSession,
  listPrivateNotesForSession,
} from '../../convex/authPrivateData'
import { assertUserOwnership, requireSessionUser } from '../../convex/lib/auth'
import { hashToken, verifyPassword } from '../../convex/lib/authCrypto'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'auth_password_reset_tokens'
  | 'auth_password_reset_outbox'
  | 'auth_private_notes'

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

  withIndex(_indexName: string, fn: (q: { eq: (field: string, value: unknown) => { field: string; value: unknown } }) => { field: string; value: unknown }) {
    const filter = fn({
      eq: (field, value) => ({ field, value }),
    })
    this.filtered = this.filtered.filter((row) => row[filter.field] === filter.value)
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

function createCtx(db: FakeDb): { db: FakeDb } {
  return { db }
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
