import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_TTL_MS,
  clearAllEmailConfirmedFlags,
  evaluateCodeAttempt,
  generateSixDigitCode,
  hashEmailCode,
  recordEmailCodeAttempt,
  storeEmailCodeForUser,
} from '../../convex/emailVerification'
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from '../../convex/lib/transactionalMailer'

type TableName = 'auth_email_verification_codes' | 'auth_users'
type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_email_verification_codes: [],
    auth_users: [],
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
  it('B9-01 : code e-mail 6 chiffres, validité 10 min, 5 tentatives', () => {
    expect(EMAIL_CODE_TTL_MS).toBe(10 * 60 * 1000)
    expect(EMAIL_CODE_MAX_ATTEMPTS).toBe(5)
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
    const codeHash = await hashEmailCode('user-A', '123456')
    const now = Date.now()
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
      expect(outcome.blocked).toBe(false)
    }
    const fifth = await recordEmailCodeAttempt({ db } as never, {
      codeId: codeRow._id as never,
      success: false,
      now: now + 5,
    })
    expect(fifth.blocked).toBe(true)
    expect(fifth.confirmed).toBe(false)
    expect(db.table('auth_users')[0].emailConfirmedAt).toBeUndefined()

    // Nouveau code requis après blocage.
    const newHash = await hashEmailCode('user-A', '654321')
    await storeEmailCodeForUser({ db } as never, {
      userId: 'user-A',
      codeHash: newHash,
      expiresAt: now + EMAIL_CODE_TTL_MS,
      now: now + 10,
    })
    const fresh = db
      .table('auth_email_verification_codes')
      .find((row) => row.consumedAt == null && row.codeHash === newHash)
    expect(fresh).toBeTruthy()
    const ok = await recordEmailCodeAttempt({ db } as never, {
      codeId: fresh!._id as never,
      success: true,
      now: now + 11,
    })
    expect(ok.confirmed).toBe(true)
    expect(db.table('auth_users')[0].emailConfirmedAt).toBe(now + 11)
  })

  it('signup/import ne posent pas emailConfirmedAt (source)', () => {
    const authSource = readFileSync(
      new URL('../../convex/auth.ts', import.meta.url),
      'utf8',
    )
    expect(authSource).toMatch(/B9-01 : jamais auto-confirmé à l’inscription/)
    expect(authSource).toMatch(/B9-01 : import sans confirmation/)
    // registerUserWithEmail / upsertImportedUserWithoutPassword must not assign emailConfirmedAt.
    const registerIdx = authSource.indexOf('export async function registerUserWithEmail')
    const registerBlock = authSource.slice(registerIdx, registerIdx + 900)
    expect(registerBlock).not.toMatch(/emailConfirmedAt:\s*now/)
  })

  it('mailer absent → linking impossible (code EMAIL_PROVIDER_NOT_CONFIGURED)', () => {
    vi.stubGlobal('process', { env: { EMAIL_PROVIDER: 'x' } }) // incomplete env
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
})
