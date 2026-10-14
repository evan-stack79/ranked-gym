import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_GOOGLE_DISABLED,
  AUTH_GOOGLE_TOKEN_INVALID,
  assertGoogleIdTokenClaims,
  generateTestGoogleKeyPair,
  isGoogleSignInConfigured,
  mintTestGoogleIdToken,
  verifyGoogleIdToken,
} from '../../convex/lib/googleIdToken'
import { completeGoogleSignInFromVerifiedClaims } from '../../convex/auth'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'rate_limit_buckets'
type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
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

const OUR_CLIENT_ID = 'ranked-gym-google-client.apps.googleusercontent.com'

async function attemptGoogleSignIn(
  db: FakeDb,
  idToken: string,
  opts: {
    clientId: string
    nowMs: number
    fetchJwks: () => Promise<{ keys: Array<JsonWebKey & { kid?: string }> }>
  },
): Promise<void> {
  // Mirrors signInWithGoogle action: verify first; session only on success.
  const verified = await verifyGoogleIdToken(idToken, {
    clientId: opts.clientId,
    nowMs: opts.nowMs,
    fetchJwks: opts.fetchJwks,
  })
  await completeGoogleSignInFromVerifiedClaims(
    { db } as never,
    {
      email: verified.email,
      googleSub: verified.sub,
      displayName: verified.name,
      emailVerified: true,
      now: opts.nowMs,
    },
  )
}

describe('Google ID token sign-in — B11-01', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fail-closed when Google client id env is not configured', () => {
    vi.stubGlobal('process', { env: {} })
    expect(isGoogleSignInConfigured()).toBe(false)
  })

  it('fake token => refused, no session', async () => {
    const db = new FakeDb()
    const { publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = Date.now()
    await expect(
      attemptGoogleSignIn(db, 'not.a.jwt', {
        clientId: OUR_CLIENT_ID,
        nowMs,
        fetchJwks: async () => ({ keys: [publicJwk] }),
      }),
    ).rejects.toThrow(AUTH_GOOGLE_TOKEN_INVALID)
    expect(db.table('auth_sessions')).toHaveLength(0)
    expect(db.table('auth_users')).toHaveLength(0)
  })

  it('expired token => refused, no session', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: {
        iss: 'https://accounts.google.com',
        aud: OUR_CLIENT_ID,
        exp: nowSec - 60,
        iat: nowSec - 120,
        email: 'user@example.com',
        email_verified: true,
        sub: 'google-sub-1',
      },
    })
    await expect(
      attemptGoogleSignIn(db, idToken, {
        clientId: OUR_CLIENT_ID,
        nowMs,
        fetchJwks: async () => ({ keys: [publicJwk] }),
      }),
    ).rejects.toThrow(AUTH_GOOGLE_TOKEN_INVALID)
    expect(db.table('auth_sessions')).toHaveLength(0)
    expect(db.table('auth_users')).toHaveLength(0)
  })

  it('other-app aud => refused, no session', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: {
        iss: 'accounts.google.com',
        aud: 'other-app-client-id.apps.googleusercontent.com',
        exp: nowSec + 3600,
        iat: nowSec,
        email: 'user@example.com',
        email_verified: true,
        sub: 'google-sub-2',
      },
    })
    await expect(
      attemptGoogleSignIn(db, idToken, {
        clientId: OUR_CLIENT_ID,
        nowMs,
        fetchJwks: async () => ({ keys: [publicJwk] }),
      }),
    ).rejects.toThrow(AUTH_GOOGLE_TOKEN_INVALID)
    expect(db.table('auth_sessions')).toHaveLength(0)
    expect(db.table('auth_users')).toHaveLength(0)
  })

  it('unverified email => refused, no session', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: {
        iss: 'https://accounts.google.com',
        aud: OUR_CLIENT_ID,
        exp: nowSec + 3600,
        iat: nowSec,
        email: 'user@example.com',
        email_verified: false,
        sub: 'google-sub-3',
      },
    })
    await expect(
      attemptGoogleSignIn(db, idToken, {
        clientId: OUR_CLIENT_ID,
        nowMs,
        fetchJwks: async () => ({ keys: [publicJwk] }),
      }),
    ).rejects.toThrow(AUTH_GOOGLE_TOKEN_INVALID)
    expect(db.table('auth_sessions')).toHaveLength(0)
    expect(db.table('auth_users')).toHaveLength(0)
  })

  it('B10-04 : valid Google ID token marks email confirmed via Google', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: {
        iss: 'https://accounts.google.com',
        aud: OUR_CLIENT_ID,
        exp: nowSec + 3600,
        iat: nowSec,
        email: 'google.user@example.com',
        email_verified: true,
        sub: 'google-sub-ok',
        name: 'G User',
      },
    })
    await attemptGoogleSignIn(db, idToken, {
      clientId: OUR_CLIENT_ID,
      nowMs,
      fetchJwks: async () => ({ keys: [publicJwk] }),
    })
    expect(db.table('auth_sessions')).toHaveLength(1)
    const user = db.table('auth_users').find((u) => u.emailNorm === 'google.user@example.com')!
    expect(user.emailConfirmedAt).toBe(nowMs)
  })

  it('assertGoogleIdTokenClaims refuses wrong iss', () => {
    expect(() =>
      assertGoogleIdTokenClaims(
        {
          iss: 'https://evil.example',
          aud: OUR_CLIENT_ID,
          exp: Math.floor(Date.now() / 1000) + 60,
          email: 'a@b.c',
          email_verified: true,
          sub: 'x',
        },
        { clientId: OUR_CLIENT_ID },
      ),
    ).toThrow(AUTH_GOOGLE_TOKEN_INVALID)
  })

  it('empty client id => AUTH_GOOGLE_DISABLED on verify', async () => {
    await expect(
      verifyGoogleIdToken('a.b.c', { clientId: '' }),
    ).rejects.toThrow(AUTH_GOOGLE_DISABLED)
  })
})
