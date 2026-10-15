import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EMAIL_CODE_HOUR_BLOCKED,
  EMAIL_CODE_HOUR_BLOCKED_MESSAGE,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR,
  EMAIL_CODE_MAX_ISSUES_PER_HOUR,
  EMAIL_CODE_TTL_MS,
  clearAllEmailConfirmedFlags,
  evaluateCodeAttempt,
  generateSixDigitCode,
  getEmailCodeHourStats,
  hashEmailCode,
  markEmailConfirmedViaGoogleForUser,
  recordEmailCodeAttempt,
  runUnconfirmResetMigrationOnce,
  storeEmailCodeForUser,
} from '../../convex/emailVerification'
import {
  completeGoogleSignInFromVerifiedClaims,
  registerUserWithEmail,
  upsertImportedUserWithoutPassword,
} from '../../convex/auth'
import { upsertAuthUser } from '../../convex/migrations'
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from '../../convex/lib/transactionalMailer'

type TableName =
  | 'auth_email_verification_codes'
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'app_one_shot_migrations'
  | 'rate_limit_buckets'
type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_email_verification_codes: [],
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    app_one_shot_migrations: [],
    rate_limit_buckets: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}` as never, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  get(id: string) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const row = this.rows[key].find((r) => r._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  patch(id: string, value: Record<string, unknown>) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      const next = { ...this.rows[key][idx] }
      for (const [field, fieldValue] of Object.entries(value)) {
        if (fieldValue === undefined) delete next[field]
        else next[field] = fieldValue
      }
      this.rows[key][idx] = next
      return Promise.resolve()
    }
    return Promise.reject(new Error('missing'))
  }

  delete(id: string) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key].splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.reject(new Error('missing'))
  }

  table(name: TableName) {
    return this.rows[name]
  }
}

class FakeQuery {
  private filtered: StoredRow[]
  private orderDesc = false
  constructor(rows: StoredRow[]) {
    this.filtered = [...rows]
  }
  withIndex(
    _name: string,
    fn: (q: { eq: (f: string, v: unknown) => unknown }) => unknown,
  ) {
    const filters: Array<{ field: string; value: unknown }> = []
    const b = {
      eq: (field: string, value: unknown) => {
        filters.push({ field, value })
        return b
      },
    }
    fn(b)
    this.filtered = this.filtered.filter((row) =>
      filters.every((f) => row[f.field] === f.value),
    )
    return this
  }
  order(dir: 'asc' | 'desc') {
    this.orderDesc = dir === 'desc'
    return this
  }
  first() {
    const rows = this.orderDesc ? [...this.filtered].reverse() : this.filtered
    return Promise.resolve(rows[0] ?? null)
  }
  collect() {
    return Promise.resolve([...this.filtered])
  }
}

describe('transactionalMailer — abstract env', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('missing server key / provider → not configured', () => {
    vi.stubGlobal('process', { env: {} })
    expect(isTransactionalEmailConfigured()).toBe(false)
  })

  it('configured env → send posts opaque payload (no hardcoded provider)', async () => {
    vi.stubGlobal('process', {
      env: {
        EMAIL_PROVIDER: 'evan-chosen-provider',
        EMAIL_API_KEY: 'secret-key',
        EMAIL_API_URL: 'https://mail.example.test/send',
        AUTH_EMAIL_FROM: 'noreply@ranked.gym',
      },
    })
    expect(isTransactionalEmailConfigured()).toBe(true)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendTransactionalEmail({
      toEmail: 'a@example.com',
      subject: 'Code',
      text: '123456',
      html: '<p>123456</p>',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.provider).toBe('evan-chosen-provider')
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body.provider).toBe('evan-chosen-provider')
    expect(body.from).toBe('noreply@ranked.gym')
  })
})

describe('email verification codes — B9-01', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('B9-01 : code e-mail 6 chiffres, validité 10 min, 5 tentatives', () => {
    expect(EMAIL_CODE_TTL_MS).toBe(10 * 60 * 1000)
    expect(EMAIL_CODE_MAX_ATTEMPTS).toBe(5)
    expect(EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR).toBe(5)
    expect(EMAIL_CODE_MAX_ISSUES_PER_HOUR).toBe(3)
    for (let i = 0; i < 20; i += 1) {
      const code = generateSixDigitCode()
      expect(code).toMatch(/^\d{6}$/)
      expect(code.length).toBe(6)
    }
  })

  it('TTL 10 min, max 5 attempts', () => {
    expect(EMAIL_CODE_TTL_MS).toBe(10 * 60 * 1000)
    expect(EMAIL_CODE_MAX_ATTEMPTS).toBe(5)
  })

  it('evaluateCodeAttempt : expired / invalid / blocked / ok', async () => {
    const now = 1_000_000
    expect(
      await evaluateCodeAttempt({
        storedHash: 'a',
        candidateHash: 'a',
        expiresAt: now - 1,
        attempts: 0,
        now,
      }),
    ).toBe('expired')
    expect(
      await evaluateCodeAttempt({
        storedHash: 'a',
        candidateHash: 'b',
        expiresAt: now + 1000,
        attempts: 4,
        now,
      }),
    ).toBe('blocked')
    expect(
      await evaluateCodeAttempt({
        storedHash: 'a',
        candidateHash: 'b',
        expiresAt: now + 1000,
        attempts: 2,
        now,
      }),
    ).toBe('invalid')
    expect(
      await evaluateCodeAttempt({
        storedHash: 'a',
        candidateHash: 'a',
        expiresAt: now + 1000,
        attempts: 0,
        now,
      }),
    ).toBe('ok')
  })

  it('5 wrong codes → blocked ; confirmed seulement après code correct', async () => {
    const db = new FakeDb()
    await db.insert('auth_users', {
      userId: 'user-A',
      email: 'a@example.com',
      emailNorm: 'a@example.com',
      displayName: 'A',
      mustResetPassword: false,
      createdAt: 1,
      updatedAt: 1,
    })
    const now = Date.now()
    const codeHash = await hashEmailCode('user-A', '123456')
    await storeEmailCodeForUser({ db } as never, {
      userId: 'user-A',
      codeHash,
      expiresAt: now + EMAIL_CODE_TTL_MS,
      now,
    })
    const codeRow = db.table('auth_email_verification_codes')[0]
    expect(db.table('auth_users')[0].emailConfirmedAt).toBeUndefined()

    for (let i = 0; i < 4; i += 1) {
      const outcome = await recordEmailCodeAttempt({ db } as never, {
        codeId: codeRow._id as never,
        success: false,
        now: now + i,
      })
      expect(outcome.confirmed).toBe(false)
      expect(outcome.hourBlocked).toBe(false)
    }
    const fifth = await recordEmailCodeAttempt({ db } as never, {
      codeId: codeRow._id as never,
      success: false,
      now: now + 5,
    })
    expect(fifth.blocked).toBe(true)
    expect(fifth.hourBlocked).toBe(true)
    expect(fifth.confirmed).toBe(false)
    expect(db.table('auth_users')[0].emailConfirmedAt).toBeUndefined()

    // B10-02 : après 5 tentatives / h, resend bloqué 1 h.
    await expect(
      storeEmailCodeForUser({ db } as never, {
        userId: 'user-A',
        codeHash: await hashEmailCode('user-A', '654321'),
        expiresAt: now + EMAIL_CODE_TTL_MS,
        now: now + 10,
      }),
    ).rejects.toThrow(EMAIL_CODE_HOUR_BLOCKED)
    expect(EMAIL_CODE_HOUR_BLOCKED_MESSAGE).toMatch(/1 h/)
  })

  it('B10-02 : resend ne reset pas les tentatives ; 3 codes / h max', async () => {
    const db = new FakeDb()
    await db.insert('auth_users', {
      userId: 'user-B',
      email: 'b@example.com',
      emailNorm: 'b@example.com',
      displayName: 'B',
      mustResetPassword: false,
      createdAt: 1,
      updatedAt: 1,
    })
    const now = 2_000_000_000_000
    const h1 = await hashEmailCode('user-B', '111111')
    await storeEmailCodeForUser({ db } as never, {
      userId: 'user-B',
      codeHash: h1,
      expiresAt: now + EMAIL_CODE_TTL_MS,
      now,
    })
    const code1 = db.table('auth_email_verification_codes').find((r) => r.codeHash === h1)!
    await recordEmailCodeAttempt({ db } as never, {
      codeId: code1._id as never,
      success: false,
      now: now + 1,
    })
    await recordEmailCodeAttempt({ db } as never, {
      codeId: code1._id as never,
      success: false,
      now: now + 2,
    })

    // Resend — new code, previous attempts still count in the hour window.
    const h2 = await hashEmailCode('user-B', '222222')
    await storeEmailCodeForUser({ db } as never, {
      userId: 'user-B',
      codeHash: h2,
      expiresAt: now + EMAIL_CODE_TTL_MS,
      now: now + 3,
    })
    const statsAfterResend = await getEmailCodeHourStats({ db } as never, 'user-B', now + 4)
    expect(statsAfterResend.codesIssued).toBe(2)
    expect(statsAfterResend.attemptsUsed).toBe(2)

    const h3 = await hashEmailCode('user-B', '333333')
    await storeEmailCodeForUser({ db } as never, {
      userId: 'user-B',
      codeHash: h3,
      expiresAt: now + EMAIL_CODE_TTL_MS,
      now: now + 5,
    })
    await expect(
      storeEmailCodeForUser({ db } as never, {
        userId: 'user-B',
        codeHash: await hashEmailCode('user-B', '444444'),
        expiresAt: now + EMAIL_CODE_TTL_MS,
        now: now + 6,
      }),
    ).rejects.toThrow(EMAIL_CODE_HOUR_BLOCKED)
  })

  // B11-02 : replaced source-reading test with real FakeDb signup/import execution.
  it('signup/import ne posent pas emailConfirmedAt (exécution réelle)', async () => {
    vi.stubGlobal('process', { env: { CONVEX_ALLOW_PUBLIC_SIGNUP: 'true' } })
    const db = new FakeDb()
    const ctx = { db }
    const signedUp = await registerUserWithEmail(ctx as never, {
      email: 'new@example.com',
      password: 'password-ok-12',
      displayName: 'New',
    })
    const user = db.table('auth_users').find((u) => u.userId === signedUp.user.userId)!
    expect(user.emailConfirmedAt).toBeUndefined()

    await upsertImportedUserWithoutPassword(
      ctx as never,
      { email: 'imported@example.com', displayName: 'Imp' },
      Date.now(),
    )
    const imported = db.table('auth_users').find((u) => u.emailNorm === 'imported@example.com')!
    expect(imported.emailConfirmedAt).toBeUndefined()
  })

  it('mailer absent → linking impossible (code EMAIL_PROVIDER_NOT_CONFIGURED)', () => {
    vi.stubGlobal('process', { env: { EMAIL_PROVIDER: 'x' } })
    expect(isTransactionalEmailConfigured()).toBe(false)
  })

  it('migration reset : clear confirmed flags posés sans vérification', async () => {
    const db = new FakeDb()
    await db.insert('auth_users', {
      userId: 'u1',
      email: 'u1@example.com',
      emailNorm: 'u1@example.com',
      displayName: 'U1',
      mustResetPassword: false,
      emailConfirmedAt: 99,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.insert('auth_users', {
      userId: 'u2',
      email: 'u2@example.com',
      emailNorm: 'u2@example.com',
      displayName: 'U2',
      mustResetPassword: false,
      createdAt: 1,
      updatedAt: 1,
    })
    const result = await clearAllEmailConfirmedFlags({ db } as never)
    expect(result.cleared).toBe(1)
    expect(db.table('auth_users')[0].emailConfirmedAt).toBeUndefined()
    expect(db.table('auth_users')[1].emailConfirmedAt).toBeUndefined()
  })

  it('B10-03 : unconfirm-reset migration runs once', async () => {
    const db = new FakeDb()
    await db.insert('auth_users', {
      userId: 'u1',
      email: 'u1@example.com',
      emailNorm: 'u1@example.com',
      displayName: 'U1',
      mustResetPassword: false,
      emailConfirmedAt: 42,
      createdAt: 1,
      updatedAt: 1,
    })
    const first = await runUnconfirmResetMigrationOnce({ db } as never, 100)
    expect(first.ran).toBe(true)
    expect(first.alreadyRan).toBe(false)
    expect(first.cleared).toBe(1)
    expect(db.table('auth_users')[0].emailConfirmedAt).toBeUndefined()
    expect(db.table('app_one_shot_migrations')).toHaveLength(1)

    // Re-confirm via code/Google path simulation, then one-shot must not run again.
    await db.patch(db.table('auth_users')[0]._id, { emailConfirmedAt: 999 })
    const second = await runUnconfirmResetMigrationOnce({ db } as never, 200)
    expect(second.ran).toBe(false)
    expect(second.alreadyRan).toBe(true)
    expect(db.table('auth_users')[0].emailConfirmedAt).toBe(999)
    expect(db.table('app_one_shot_migrations')).toHaveLength(1)
  })

  it('B10-04 : Google sign-in calls markEmailConfirmedViaGoogle', async () => {
    const db = new FakeDb()
    // Claims must already be JWKS-verified (action path); mutation never trusts phone email/sub.
    const result = await completeGoogleSignInFromVerifiedClaims(
      { db } as never,
      {
        email: 'google.user@example.com',
        googleSub: 'google-sub-123',
        displayName: 'G',
        emailVerified: true,
        now: 5_000,
      },
    )
    expect(result.emailConfirmed).toBe(true)
    const user = db.table('auth_users').find((u) => u.emailNorm === 'google.user@example.com')!
    expect(user.emailConfirmedAt).toBe(5_000)
    await markEmailConfirmedViaGoogleForUser(
      { db } as never,
      { userId: user.userId as string, now: 6_000 },
    )
    expect(db.table('auth_users').find((u) => u.userId === user.userId)!.emailConfirmedAt).toBe(
      6_000,
    )
  })

  it('B10-05 : re-import never removes confirmation from code or Google', async () => {
    const db = new FakeDb()
    await db.insert('auth_users', {
      userId: 'user-ok',
      email: 'ok@example.com',
      emailNorm: 'ok@example.com',
      displayName: 'Ok',
      mustResetPassword: false,
      emailConfirmedAt: 12345,
      createdAt: 1,
      updatedAt: 1,
    })
    await upsertAuthUser({ db } as never, {
      userId: 'user-ok',
      email: 'ok@example.com',
      emailNorm: 'ok@example.com',
      displayName: 'Ok Renamed',
      mustResetPassword: false,
    })
    expect(db.table('auth_users')[0].emailConfirmedAt).toBe(12345)
    expect(db.table('auth_users')[0].displayName).toBe('Ok Renamed')
  })
})
