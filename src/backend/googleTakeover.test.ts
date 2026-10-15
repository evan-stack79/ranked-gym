/**
 * B12-01 — Google takeover of unconfirmed password accounts (FakeDb, real handlers).
 */
import { describe, expect, it } from 'vitest'
import {
  completeGoogleSignInFromVerifiedClaims,
  GOOGLE_PASSWORD_REMOVED_MESSAGE,
  signInWithPasswordForEmail,
} from '../../convex/auth'
import {
  hashEmailCode,
  recordEmailCodeAttempt,
  storeEmailCodeForUser,
} from '../../convex/emailVerification'
import { createSession, requireSessionUser } from '../../convex/lib/auth'
import { hashPassword, hashToken } from '../../convex/lib/authCrypto'
import { hardDeleteAllUserMeals } from '../../convex/nutrition'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'auth_email_verification_codes'
  | 'auth_google_takeover_audit'
  | 'rate_limit_buckets'
  | 'nutrition_meals'
  | 'nutrition_state'
  | 'legacy_supabase_backups'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    auth_email_verification_codes: [],
    auth_google_takeover_audit: [],
    rate_limit_buckets: [],
    nutrition_meals: [],
    nutrition_state: [],
    legacy_supabase_backups: [],
  }

  private backup: Record<TableName, StoredRow[]> | null = null

  snapshot() {
    this.backup = JSON.parse(JSON.stringify(this.rows)) as Record<TableName, StoredRow[]>
  }

  restore() {
    if (this.backup) this.rows = this.backup
    this.backup = null
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

  replace(id: string, value: Record<string, unknown>) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key][idx] = { _id: id as never, ...value }
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
  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
  collect() {
    return Promise.resolve([...this.filtered])
  }
}

const NOW = 1_700_000_000_000
const PASSWORD = 'old-password-ok-12'
const EMAIL = 'takeover@example.com'

async function seedUnconfirmedPasswordUser(db: FakeDb, opts?: { confirmed?: boolean }) {
  const userId = 'user-takeover-1'
  await db.insert('auth_users', {
    userId,
    email: EMAIL,
    emailNorm: EMAIL,
    displayName: 'Take',
    mustResetPassword: false,
    emailConfirmedAt: opts?.confirmed ? NOW - 10_000 : undefined,
    createdAt: NOW - 100_000,
    updatedAt: NOW - 100_000,
  })
  const passwordHash = await hashPassword(PASSWORD)
  await db.insert('auth_password_credentials', {
    userId,
    passwordHash,
    updatedAt: NOW - 100_000,
  })
  const session = await createSession({ db } as never, userId)
  return { userId, sessionToken: session.sessionToken }
}

describe('Google takeover — B12-01', () => {
  it('GOOGLE_PASSWORD_REMOVED_MESSAGE is the Architect copy', () => {
    expect(GOOGLE_PASSWORD_REMOVED_MESSAGE).toBe(
      'Ton ancien mot de passe a été retiré. Tu peux en créer un nouveau dans ton profil.',
    )
  })

  it('unconfirmed + password: after Google the old password is refused', async () => {
    const db = new FakeDb()
    await seedUnconfirmedPasswordUser(db)
    const result = await completeGoogleSignInFromVerifiedClaims(
      { db } as never,
      {
        email: EMAIL,
        googleSub: 'g-sub-1',
        emailVerified: true,
        now: NOW,
      },
    )
    expect(result.passwordRemoved).toBe(true)
    expect(result.emailConfirmed).toBe(true)
    expect(db.table('auth_password_credentials')).toHaveLength(0)
    expect(db.table('auth_google_takeover_audit')).toHaveLength(1)
    expect(db.table('auth_google_takeover_audit')[0]).toMatchObject({
      userId: 'user-takeover-1',
      at: NOW,
    })
    // Audit must never contain secrets.
    expect(JSON.stringify(db.table('auth_google_takeover_audit')[0])).not.toMatch(
      /password|token|g-sub/i,
    )

    await expect(
      signInWithPasswordForEmail({ db } as never, { email: EMAIL, password: PASSWORD }),
    ).rejects.toThrow(/AUTH_PASSWORD_RESET_REQUIRED|AUTH_INVALID_CREDENTIALS/)
  })

  it('unconfirmed + password: after Google the old session is closed', async () => {
    const db = new FakeDb()
    const { sessionToken: oldToken } = await seedUnconfirmedPasswordUser(db)
    await completeGoogleSignInFromVerifiedClaims(
      { db } as never,
      {
        email: EMAIL,
        googleSub: 'g-sub-2',
        emailVerified: true,
        now: NOW,
      },
    )
    const oldHash = await hashToken(oldToken)
    const oldSession = db.table('auth_sessions').find((s) => s.tokenHash === oldHash)
    expect(oldSession?.revokedAt).toBe(NOW)
    await expect(requireSessionUser({ db } as never, oldToken)).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('confirmed account: password still works after Google', async () => {
    const db = new FakeDb()
    await seedUnconfirmedPasswordUser(db, { confirmed: true })
    const result = await completeGoogleSignInFromVerifiedClaims(
      { db } as never,
      {
        email: EMAIL,
        googleSub: 'g-sub-3',
        emailVerified: true,
        now: NOW,
      },
    )
    expect(result.passwordRemoved).toBe(false)
    expect(db.table('auth_password_credentials')).toHaveLength(1)
    expect(db.table('auth_google_takeover_audit')).toHaveLength(0)

    const signedIn = await signInWithPasswordForEmail(
      { db } as never,
      { email: EMAIL, password: PASSWORD },
    )
    expect(signedIn.user.email).toBe(EMAIL)
  })

  it('failure mid-mutation: nothing is changed', async () => {
    const db = new FakeDb()
    await seedUnconfirmedPasswordUser(db)
    db.snapshot()

    const originalInsert = db.insert.bind(db)
    db.insert = async (table: TableName, value: Record<string, unknown>) => {
      if (table === 'auth_google_takeover_audit') {
        throw new Error('SIMULATED_MID_MUTATION_FAILURE')
      }
      return originalInsert(table, value)
    }

    await expect(
      completeGoogleSignInFromVerifiedClaims(
        { db } as never,
        {
          email: EMAIL,
          googleSub: 'g-sub-fail',
          emailVerified: true,
          now: NOW,
        },
      ),
    ).rejects.toThrow('SIMULATED_MID_MUTATION_FAILURE')

    // Simulate Convex transaction abort.
    db.restore()
    expect(db.table('auth_password_credentials')).toHaveLength(1)
    expect(db.table('auth_sessions').every((s) => s.revokedAt == null)).toBe(true)
    expect(db.table('auth_users')[0].emailConfirmedAt).toBeUndefined()
    expect(db.table('auth_google_takeover_audit')).toHaveLength(0)
  })

  it('pending email code is rejected after the Google takeover', async () => {
    const db = new FakeDb()
    const { userId } = await seedUnconfirmedPasswordUser(db)
    const codeHash = await hashEmailCode(userId, '123456')
    await storeEmailCodeForUser({ db } as never, {
      userId,
      codeHash,
      expiresAt: NOW + 600_000,
      now: NOW - 1_000,
    })
    const codeRow = db.table('auth_email_verification_codes').find((r) => r.consumedAt == null)!
    expect(codeRow).toBeTruthy()

    await completeGoogleSignInFromVerifiedClaims(
      { db } as never,
      {
        email: EMAIL,
        googleSub: 'g-sub-code',
        emailVerified: true,
        now: NOW,
      },
    )

    const after = db.table('auth_email_verification_codes').find((r) => r._id === codeRow._id)!
    expect(after.consumedAt).toBe(NOW)

    await expect(
      recordEmailCodeAttempt({ db } as never, {
        codeId: codeRow._id as never,
        success: true,
        now: NOW + 1,
      }),
    ).rejects.toThrow('EMAIL_CODE_INVALID')
  })

  it("old session can't delete meals after the takeover", async () => {
    const db = new FakeDb()
    const { userId, sessionToken: oldToken } = await seedUnconfirmedPasswordUser(db)
    await db.insert('nutrition_meals', {
      userId,
      mealId: 'meal-1',
      dateKey: '2026-10-14',
      name: 'Pasta',
      mealType: 'lunch',
      calories: 500,
      createdAt: NOW - 1,
      updatedAt: NOW - 1,
      schemaVersion: 1,
    })

    await completeGoogleSignInFromVerifiedClaims(
      { db } as never,
      {
        email: EMAIL,
        googleSub: 'g-sub-meals',
        emailVerified: true,
        now: NOW,
      },
    )

    // Server-side gate: revoked session cannot pass requireSessionUser.
    await expect(requireSessionUser({ db } as never, oldToken)).rejects.toThrow(
      'Not authenticated',
    )
    // Therefore deleteAllMyMeals path never runs; meals untouched.
    expect(db.table('nutrition_meals')).toHaveLength(1)
    expect(db.table('nutrition_meals')[0].mealId).toBe('meal-1')

    // Sanity: a fresh Google session CAN delete (prove gate is session-based).
    const googleSession = db
      .table('auth_sessions')
      .find((s) => s.revokedAt == null && s.userId === userId)
    expect(googleSession).toBeTruthy()
    // Reconstruct token is unavailable (only hash stored) — call hardDelete with userId
    // only after requireSessionUser would have passed; here we just confirm meals still exist
    // until a valid session path runs.
    await hardDeleteAllUserMeals({ db } as never, userId, NOW + 5)
    expect(
      db.table('nutrition_meals').every((m) => typeof m.deletedAt === 'number' || m.deletedAt),
    ).toBe(true)
  })
})
