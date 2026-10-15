import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_GOOGLE_DISABLED,
  AUTH_GOOGLE_TOKEN_INVALID,
  assertGoogleIdTokenClaims,
  clearGoogleJwksCache,
  fetchGoogleJwksCached,
  generateTestGoogleKeyPair,
  isGoogleSignInConfigured,
  isGoogleSignInEnabled,
  mintTestGoogleIdToken,
  requireGoogleSignInReady,
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
    bypassJwksCache: true,
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

function baseClaims(nowSec: number, overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: OUR_CLIENT_ID,
    exp: nowSec + 3600,
    iat: nowSec,
    email: 'user@example.com',
    email_verified: true,
    sub: 'google-sub-1',
    ...overrides,
  }
}

describe('Google ID token sign-in — B11-01', () => {
  beforeEach(() => {
    clearGoogleJwksCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearGoogleJwksCache()
  })

  it('fail-closed when Google client id env is not configured', () => {
    vi.stubGlobal('process', { env: { CONVEX_GOOGLE_SIGNIN_ENABLED: 'true' } })
    expect(isGoogleSignInConfigured()).toBe(false)
    expect(() => requireGoogleSignInReady()).toThrow(AUTH_GOOGLE_DISABLED)
  })

  it('fail-closed unless CONVEX_GOOGLE_SIGNIN_ENABLED=true even with client id', () => {
    vi.stubGlobal('process', {
      env: { GOOGLE_CLIENT_ID: OUR_CLIENT_ID },
    })
    expect(isGoogleSignInEnabled()).toBe(false)
    expect(isGoogleSignInConfigured()).toBe(false)
    expect(() => requireGoogleSignInReady()).toThrow(AUTH_GOOGLE_DISABLED)
    vi.stubGlobal('process', {
      env: {
        GOOGLE_CLIENT_ID: OUR_CLIENT_ID,
        CONVEX_GOOGLE_SIGNIN_ENABLED: 'true',
      },
    })
    expect(isGoogleSignInConfigured()).toBe(true)
    expect(requireGoogleSignInReady()).toBe(OUR_CLIENT_ID)
  })

  it('missing client id leads to a throw', async () => {
    await expect(
      verifyGoogleIdToken('a.b.c', { clientId: '' }),
    ).rejects.toThrow(AUTH_GOOGLE_DISABLED)
    vi.stubGlobal('process', { env: { CONVEX_GOOGLE_SIGNIN_ENABLED: 'true' } })
    expect(() => requireGoogleSignInReady()).toThrow(AUTH_GOOGLE_DISABLED)
  })

  it('bad signature => refused, no session', async () => {
    const db = new FakeDb()
    const signer = await generateTestGoogleKeyPair()
    const other = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey: signer.privateKey,
      publicJwk: signer.publicJwk,
      claims: baseClaims(nowSec),
    })
    // Verify against a different public key → signature fails.
    await expect(
      attemptGoogleSignIn(db, idToken, {
        clientId: OUR_CLIENT_ID,
        nowMs,
        fetchJwks: async () => ({ keys: [other.publicJwk] }),
      }),
    ).rejects.toThrow(AUTH_GOOGLE_TOKEN_INVALID)
    expect(db.table('auth_sessions')).toHaveLength(0)
    expect(db.table('auth_users')).toHaveLength(0)
  })

  it('wrong aud => refused, no session', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: baseClaims(nowSec, {
        iss: 'accounts.google.com',
        aud: 'other-app-client-id.apps.googleusercontent.com',
        sub: 'google-sub-2',
      }),
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

  it('expired token => refused, no session', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: baseClaims(nowSec, {
        exp: nowSec - 60,
        iat: nowSec - 120,
      }),
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

  it('email_verified false => refused, no session', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: baseClaims(nowSec, {
        email_verified: false,
        sub: 'google-sub-3',
      }),
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

  it('valid token works when enabled', async () => {
    vi.stubGlobal('process', {
      env: {
        GOOGLE_CLIENT_ID: OUR_CLIENT_ID,
        CONVEX_GOOGLE_SIGNIN_ENABLED: 'true',
      },
    })
    expect(requireGoogleSignInReady()).toBe(OUR_CLIENT_ID)

    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: baseClaims(nowSec, {
        email: 'google.user@example.com',
        sub: 'google-sub-ok',
        name: 'G User',
      }),
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

  it('B10-04 : valid Google ID token marks email confirmed via Google', async () => {
    const db = new FakeDb()
    const { privateKey, publicJwk } = await generateTestGoogleKeyPair()
    const nowMs = 1_700_000_000_000
    const nowSec = Math.floor(nowMs / 1000)
    const idToken = await mintTestGoogleIdToken({
      privateKey,
      publicJwk,
      claims: baseClaims(nowSec, {
        email: 'google.user@example.com',
        sub: 'google-sub-ok',
        name: 'G User',
      }),
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
  })

  it('assertGoogleIdTokenClaims refuses wrong iss', () => {
    expect(() =>
      assertGoogleIdTokenClaims(
        {
          iss: 'https://evil.example',
          aud: OUR_CLIENT_ID,
          exp: Math.floor(Date.now() / 1000) + 60,
          iat: Math.floor(Date.now() / 1000),
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

  it('JWKS cache reuses keys within TTL', async () => {
    let fetches = 0
    const { publicJwk } = await generateTestGoogleKeyPair()
    const fetchJwks = async () => {
      fetches += 1
      return { keys: [publicJwk] }
    }
    const t0 = 1_000_000
    await fetchGoogleJwksCached(t0, fetchJwks)
    await fetchGoogleJwksCached(t0 + 1_000, fetchJwks)
    expect(fetches).toBe(1)
    await fetchGoogleJwksCached(t0 + 60 * 60 * 1000 + 1, fetchJwks)
    expect(fetches).toBe(2)
  })
})
