import { describe, expect, it, vi } from 'vitest'
import {
  consumePasswordResetToken,
  deleteAccountAndUserData,
  requestPasswordResetForEmail,
  signInWithPasswordForEmail,
} from '../../convex/auth'
import { generateAvatarUploadUrlForSession } from '../../convex/files'
import { hashPassword, hashToken } from '../../convex/lib/authCrypto'
import {
  consumeRateLimit,
  hashRateLimitKey,
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_USER_MESSAGE,
  RATE_LIMITED_ERROR,
} from '../../convex/lib/rateLimit'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'auth_password_reset_tokens'
  | 'auth_password_reset_outbox'
  | 'rate_limit_buckets'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    auth_password_reset_tokens: [],
    auth_password_reset_outbox: [],
    rate_limit_buckets: [],
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

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }
}

class FakeStorage {
  generateUploadUrl() {
    return Promise.resolve('https://upload.example/1')
  }
}

function createCtx(db: FakeDb, storage = new FakeStorage()) {
  return { db, storage }
}

async function fillPolicy(
  ctx: { db: FakeDb },
  policy: keyof typeof RATE_LIMIT_POLICIES,
  subject: { kind: 'email' | 'userId' | 'token' | 'admin' | 'ip'; value: string },
  now: number,
) {
  const { limit } = RATE_LIMIT_POLICIES[policy]
  for (let i = 0; i < limit; i += 1) {
    await consumeRateLimit(ctx as never, policy, subject, now)
  }
}

async function seedPasswordUser(
  db: FakeDb,
  input: { userId: string; email: string; password: string; sessionToken: string },
) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId: input.userId,
    email: input.email,
    emailNorm: input.email,
    displayName: 'Athlete',
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_password_credentials', {
    userId: input.userId,
    passwordHash: await hashPassword(input.password),
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId: input.userId,
    tokenHash: await hashToken(input.sessionToken),
    createdAt: now,
    expiresAt: now + 120_000,
  })
}

describe('Convex rate-limit keys', () => {
  it('never embeds raw PII, emails, tokens, or IPs in the stored key hash', async () => {
    const email = 'Known.User+tag@Example.COM'
    const token = 'reset-token-super-secret'
    const ip = '203.0.113.77'
    const password = 'hunter2-password'

    const emailKey = await hashRateLimitKey('signInEmail', 'email', email)
    const tokenKey = await hashRateLimitKey('passwordResetConsume', 'token', token)
    const ipKey = await hashRateLimitKey('signInEmail', 'ip', ip)

    for (const key of [emailKey, tokenKey, ipKey]) {
      expect(key).not.toMatch(/@/)
      expect(key.toLowerCase()).not.toContain('example.com')
      expect(key).not.toContain(email)
      expect(key.toLowerCase()).not.toContain(email.toLowerCase())
      expect(key).not.toContain(token)
      expect(key).not.toContain(ip)
      expect(key).not.toContain('203.0.113')
      expect(key).not.toContain(password)
    }

    const again = await hashRateLimitKey('signInEmail', 'email', 'known.user+tag@example.com')
    expect(again).toBe(emailKey)
    expect(await hashRateLimitKey('signInEmail', 'email', 'other@example.com')).not.toBe(emailKey)
    expect(RATE_LIMIT_USER_MESSAGE).toMatch(/trop de tentatives/i)
    expect(RATE_LIMIT_USER_MESSAGE.toLowerCase()).not.toContain('email')
    expect(RATE_LIMIT_USER_MESSAGE).not.toMatch(/stack|token|@/i)
  })
})

describe('Convex rate-limit windows', () => {
  it('blocks a deterministic burst and recovers after the window', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const now = 1_700_000_000_000
    const subject = { kind: 'email' as const, value: 'burst@example.com' }
    const logs: unknown[] = []
    const spy = vi.spyOn(console, 'info').mockImplementation((...args) => {
      logs.push(args)
    })

    await fillPolicy(ctx, 'signInEmail', subject, now)
    await expect(consumeRateLimit(ctx as never, 'signInEmail', subject, now)).rejects.toThrow(
      RATE_LIMITED_ERROR,
    )
    expect(JSON.stringify(logs)).not.toContain('burst@example.com')
    expect(JSON.stringify(logs)).not.toMatch(/@/)

    await expect(
      consumeRateLimit(
        ctx as never,
        'signInEmail',
        subject,
        now + RATE_LIMIT_POLICIES.signInEmail.windowMs,
      ),
    ).resolves.toBeUndefined()

    spy.mockRestore()
  })
})

describe('Password reset enumeration parity', () => {
  it('returns the same surface for known vs unknown emails, including throttle', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const now = Date.now()
    await db.insert('auth_users', {
      userId: 'user-known',
      email: 'known@example.com',
      emailNorm: 'known@example.com',
      displayName: 'Known',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })

    const known = await requestPasswordResetForEmail(ctx as never, { email: 'Known@Example.com' })
    const unknown = await requestPasswordResetForEmail(ctx as never, {
      email: 'missing@example.com',
    })
    expect(known).toEqual({ accepted: true })
    expect(unknown).toEqual(known)

    await fillPolicy(
      ctx,
      'passwordResetRequest',
      { kind: 'email', value: 'known@example.com' },
      Date.now(),
    )
    await fillPolicy(
      ctx,
      'passwordResetRequest',
      { kind: 'email', value: 'missing@example.com' },
      Date.now(),
    )

    const knownThrottle = requestPasswordResetForEmail(ctx as never, {
      email: 'known@example.com',
    })
    const unknownThrottle = requestPasswordResetForEmail(ctx as never, {
      email: 'missing@example.com',
    })
    await expect(knownThrottle).rejects.toThrow(RATE_LIMITED_ERROR)
    await expect(unknownThrottle).rejects.toThrow(RATE_LIMITED_ERROR)
  })
})

describe('Sensitive mutation wiring', () => {
  it('throttles sign-in before password verification after an email burst', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedPasswordUser(db, {
      userId: 'user-a',
      email: 'a@example.com',
      password: 'password-a',
      sessionToken: 'session-a',
    })
    await fillPolicy(
      ctx,
      'signInEmail',
      { kind: 'email', value: 'a@example.com' },
      Date.now(),
    )

    await expect(
      signInWithPasswordForEmail(ctx as never, { email: 'a@example.com', password: 'password-a' }),
    ).rejects.toThrow(RATE_LIMITED_ERROR)
  })

  it('throttles reset consume, avatar upload URL, and account deletion', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    await seedPasswordUser(db, {
      userId: 'user-a',
      email: 'a@example.com',
      password: 'password-a',
      sessionToken: 'session-a',
    })

    await fillPolicy(
      ctx,
      'passwordResetConsume',
      { kind: 'token', value: await hashToken('token-a') },
      Date.now(),
    )
    await expect(
      consumePasswordResetToken(ctx as never, 'token-a', 'new-password-123'),
    ).rejects.toThrow(RATE_LIMITED_ERROR)

    await fillPolicy(
      ctx,
      'avatarUploadUrl',
      { kind: 'userId', value: 'user-a' },
      Date.now(),
    )
    await expect(generateAvatarUploadUrlForSession(ctx as never, 'session-a')).rejects.toThrow(
      RATE_LIMITED_ERROR,
    )

    await fillPolicy(
      ctx,
      'deleteAccount',
      { kind: 'userId', value: 'user-a' },
      Date.now(),
    )
    await expect(
      deleteAccountAndUserData(ctx as never, { sessionToken: 'session-a', password: 'password-a' }),
    ).rejects.toThrow(RATE_LIMITED_ERROR)
    expect(db.table('auth_users')).toHaveLength(1)
  })
})
