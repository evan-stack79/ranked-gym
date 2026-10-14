import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createImmutableAccountLink,
  findLinkByOwner,
  isAccountLinkValid,
  runAssertLinkForErase,
  runLinkSupabaseAccount,
} from '../../convex/accountLinks'
import { upsertAuthUser } from '../../convex/migrations'

type TableName = 'auth_account_links' | 'auth_users'
type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_account_links: [],
    auth_users: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
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

describe('auth_account_links — B7/B8/B9', () => {
  const source = readFileSync(new URL('../../convex/accountLinks.ts', import.meta.url), 'utf8')
  const purgeSource = readFileSync(
    new URL('../../convex/purgeSupabaseMeals.ts', import.meta.url),
    'utf8',
  )
  const migrationSource = readFileSync(
    new URL('../../convex/migrations.ts', import.meta.url),
    'utf8',
  )

  it('lien A→supabaseA : B ne match pas', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-A')
    expect(await isAccountLinkValid(ctx as never, 'user-A', 'supabase-A')).toBe(true)
    expect(await isAccountLinkValid(ctx as never, 'user-A', 'supabase-B')).toBe(false)
    expect(await isAccountLinkValid(ctx as never, 'user-B', 'supabase-B')).toBe(false)
  })

  it('pas de lien → invalid', async () => {
    const db = new FakeDb()
    const ctx = { db }
    expect(await isAccountLinkValid(ctx as never, 'user-A', 'supabase-A')).toBe(false)
  })

  it('B7-02 : lien immuable + déjà pris', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-shared')
    await expect(
      createImmutableAccountLink(ctx as never, 'user-A', 'supabase-B'),
    ).rejects.toThrow('ACCOUNT_LINK_IMMUTABLE')
    await expect(
      createImmutableAccountLink(ctx as never, 'user-B', 'supabase-shared'),
    ).rejects.toThrow('ACCOUNT_LINK_ALREADY_TAKEN')
    expect(await findLinkByOwner(ctx as never, 'user-B')).toBeNull()
  })

  it('B7-02 : lien immuable — refuse de changer le Supabase id', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-A')
    await expect(
      createImmutableAccountLink(ctx as never, 'user-A', 'supabase-B'),
    ).rejects.toThrow('ACCOUNT_LINK_IMMUTABLE')
    const link = await findLinkByOwner(ctx as never, 'user-A')
    expect(link?.supabaseUserId).toBe('supabase-A')
  })

  it('B7-02 : Supabase déjà lié à un autre Convex → refuse', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-shared')
    await expect(
      createImmutableAccountLink(ctx as never, 'user-B', 'supabase-shared'),
    ).rejects.toThrow('ACCOUNT_LINK_ALREADY_TAKEN')
    expect(await findLinkByOwner(ctx as never, 'user-B')).toBeNull()
  })

  it('idempotent / linking same account twice → created false, une seule ligne', async () => {
    const db = new FakeDb()
    const ctx = { db }
    const first = await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-A')
    const second = await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-A')
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(db.table('auth_account_links')).toHaveLength(1)
  })

  it('API : lecture propre ; store interne ; emails serveur', () => {
    expect(source).not.toMatch(/export const getLinkForOwner\s*=\s*query/)
    expect(source).toMatch(/export const getMyLink\s*=\s*query/)
    expect(source).toMatch(/export const storeVerifiedLink\s*=\s*internalMutation/)
    expect(source).toMatch(/ACCOUNT_LINK_EMAIL_MISMATCH/)
    expect(source).toMatch(/ACCOUNT_LINK_EMAIL_UNCONFIRMED/)
    expect(source).toMatch(/email_confirmed_at/)
    expect(source).toMatch(/assertLinkForErase/)
    expect(migrationSource).toContain('createImmutableAccountLink')
    expect(purgeSource).toContain('countSupabaseMealCopies')
    expect(purgeSource).toContain('purgeSupabaseMealCopiesByAccessToken')
  })

  it('B7-01 : migration auth_users crée le lien + reset confirmed (FakeDb)', async () => {
    const db = new FakeDb()
    const ctx = { db }
    // Compte déjà « confirmed » sans vérification → doit être reset.
    await db.insert('auth_users', {
      userId: 'user-mig',
      email: 'mig@example.com',
      emailNorm: 'mig@example.com',
      displayName: 'Mig',
      mustResetPassword: true,
      emailConfirmedAt: 1_700_000_000_000,
      createdAt: 1,
      updatedAt: 1,
    })
    const outcome = await upsertAuthUser(ctx as never, {
      userId: 'user-mig',
      email: 'mig@example.com',
      emailNorm: 'mig@example.com',
      displayName: 'Mig',
      mustResetPassword: true,
    })
    expect(outcome.operation).toBe('updated')
    const user = db.table('auth_users')[0]
    expect(user.emailConfirmedAt).toBeUndefined()

    // Même chemin migration : création du lien.
    await createImmutableAccountLink(ctx as never, 'user-mig', 'supabase-mig')
    const link = await findLinkByOwner(ctx as never, 'user-mig')
    expect(link?.supabaseUserId).toBe('supabase-mig')
    expect(migrationSource).toContain("args.entityType === 'auth_users'")
  })

  it('B7-03 : purge Supabase utilise l’id du lien, pas l’id Convex', () => {
    expect(purgeSource).toContain('internal.accountLinks.getLinkByOwner')
    expect(purgeSource).toContain('link.supabaseUserId')
    expect(purgeSource).toContain('resolvedUserId: supabaseUserId')
    expect(purgeSource).toContain('ACCOUNT_LINK_MISSING')
    const handlerIdx = purgeSource.indexOf('export const purgeSupabaseMealCopies')
    const handler = purgeSource.slice(handlerIdx, handlerIdx + 1200)
    expect(handler).toMatch(/supabaseUserId/)
    expect(handler).not.toMatch(/restSelectSingle\(\s*config,\s*'nutrition',\s*userId/)
  })

  it('erase targets link account — assertLinkForErase exige le lien', async () => {
    const runQuery = vi.fn().mockImplementation((_ref: unknown, args: Record<string, unknown>) => {
      if ('sessionToken' in args) return Promise.resolve({ userId: 'user-A' })
      return Promise.resolve(null)
    })
    await expect(
      runAssertLinkForErase({ runQuery }, { sessionToken: 'sess' }),
    ).rejects.toThrow('ACCOUNT_LINK_MISSING')
  })
})

describe('runLinkSupabaseAccount — token + emails', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('process', {
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key-for-auth-getuser',
      },
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
  })

  function mockCtx(opts: {
    ownerEmail: string
    ownerConfirmed: boolean
    supabaseBody: Record<string, unknown> | null
    fetchOk?: boolean
    runMutationImpl?: () => Promise<unknown>
  }) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: opts.fetchOk ?? true,
      status: opts.fetchOk === false ? 401 : 200,
      json: async () => opts.supabaseBody ?? {},
    }) as unknown as typeof fetch

    const runMutation =
      opts.runMutationImpl != null
        ? vi.fn().mockImplementation(opts.runMutationImpl)
        : vi.fn().mockResolvedValue({
            created: true,
            ownerUserId: 'user-A',
            supabaseUserId: String(opts.supabaseBody?.id ?? ''),
          })
    const runQuery = vi.fn().mockImplementation((_ref: unknown, args: Record<string, unknown>) => {
      if ('sessionToken' in args) {
        return Promise.resolve({ userId: 'user-A', email: opts.ownerEmail })
      }
      return Promise.resolve({
        ownerUserId: 'user-A',
        email: opts.ownerEmail,
        emailConfirmed: opts.ownerConfirmed,
      })
    })
    return { runQuery, runMutation }
  }

  it('token fake → refuse, rien créé', async () => {
    const ctx = mockCtx({
      ownerEmail: 'a@example.com',
      ownerConfirmed: true,
      supabaseBody: {},
      fetchOk: false,
    })
    await expect(
      runLinkSupabaseAccount(ctx, {
        sessionToken: 'sess',
        supabaseAccessToken: 'fake-token',
      }),
    ).rejects.toThrow('ACCOUNT_LINK_SUPABASE_UNRESOLVED')
    expect(ctx.runMutation).not.toHaveBeenCalled()
  })

  it('token expired / Auth 401 → refuse, rien créé', async () => {
    const ctx = mockCtx({
      ownerEmail: 'a@example.com',
      ownerConfirmed: true,
      supabaseBody: { msg: 'invalid JWT' },
      fetchOk: false,
    })
    await expect(
      runLinkSupabaseAccount(ctx, {
        sessionToken: 'sess',
        supabaseAccessToken: 'expired-token',
      }),
    ).rejects.toThrow('ACCOUNT_LINK_SUPABASE_UNRESOLVED')
    expect(ctx.runMutation).not.toHaveBeenCalled()
  })

  it('token d’un Supabase déjà lié ailleurs → refuse', async () => {
    const ctx = mockCtx({
      ownerEmail: 'same@example.com',
      ownerConfirmed: true,
      supabaseBody: {
        id: 'supabase-shared',
        email: 'same@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
      runMutationImpl: async () => {
        throw new Error('ACCOUNT_LINK_ALREADY_TAKEN')
      },
    })
    await expect(
      runLinkSupabaseAccount(ctx, {
        sessionToken: 'sess-b',
        supabaseAccessToken: 'token-of-shared',
      }),
    ).rejects.toThrow('ACCOUNT_LINK_ALREADY_TAKEN')
  })

  it('token valide → storeVerifiedLink avec id résolu serveur', async () => {
    const ctx = mockCtx({
      ownerEmail: 'same@example.com',
      ownerConfirmed: true,
      supabaseBody: {
        id: 'supabase-A',
        email: 'same@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    })
    const result = await runLinkSupabaseAccount(ctx, {
      sessionToken: 'sess',
      supabaseAccessToken: 'good-token',
    })
    expect(result).toEqual({
      ok: true,
      created: true,
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
    })
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      { ownerUserId: 'user-A', supabaseUserId: 'supabase-A' },
    )
  })

  it('token B avec email différent → refuse, rien créé', async () => {
    const ctx = mockCtx({
      ownerEmail: 'a@example.com',
      ownerConfirmed: true,
      supabaseBody: {
        id: 'supabase-B',
        email: 'b@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    })
    await expect(
      runLinkSupabaseAccount(ctx, {
        sessionToken: 'sess',
        supabaseAccessToken: 'token-b',
      }),
    ).rejects.toThrow('ACCOUNT_LINK_EMAIL_MISMATCH')
    expect(ctx.runMutation).not.toHaveBeenCalled()
  })

  it('email Supabase non confirmé → refuse', async () => {
    const ctx = mockCtx({
      ownerEmail: 'same@example.com',
      ownerConfirmed: true,
      supabaseBody: {
        id: 'supabase-A',
        email: 'same@example.com',
        email_confirmed_at: null,
      },
    })
    await expect(
      runLinkSupabaseAccount(ctx, {
        sessionToken: 'sess',
        supabaseAccessToken: 'token',
      }),
    ).rejects.toThrow('ACCOUNT_LINK_EMAIL_UNCONFIRMED')
    expect(ctx.runMutation).not.toHaveBeenCalled()
  })

  it('compte créé avec e-mail d’autrui sans code → ne peut pas linker', async () => {
    const ctx = mockCtx({
      ownerEmail: 'victim@example.com',
      ownerConfirmed: false,
      supabaseBody: {
        id: 'supabase-victim',
        email: 'victim@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    })
    await expect(
      runLinkSupabaseAccount(ctx, {
        sessionToken: 'sess',
        supabaseAccessToken: 'token',
      }),
    ).rejects.toThrow('ACCOUNT_LINK_EMAIL_UNCONFIRMED')
    expect(ctx.runMutation).not.toHaveBeenCalled()
  })

  it('email Convex non confirmé → refuse', async () => {
    const ctx = mockCtx({
      ownerEmail: 'same@example.com',
      ownerConfirmed: false,
      supabaseBody: {
        id: 'supabase-A',
        email: 'same@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    })
    await expect(
      runLinkSupabaseAccount(ctx, {
        sessionToken: 'sess',
        supabaseAccessToken: 'token',
      }),
    ).rejects.toThrow('ACCOUNT_LINK_EMAIL_UNCONFIRMED')
    expect(ctx.runMutation).not.toHaveBeenCalled()
  })

  it('emails match + confirmés → storeVerifiedLink', async () => {
    const ctx = mockCtx({
      ownerEmail: 'Same@Example.com',
      ownerConfirmed: true,
      supabaseBody: {
        id: 'supabase-A',
        email: 'same@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    })
    const result = await runLinkSupabaseAccount(ctx, {
      sessionToken: 'sess',
      supabaseAccessToken: 'good',
    })
    expect(result.supabaseUserId).toBe('supabase-A')
    expect(ctx.runMutation).toHaveBeenCalled()
  })

  it('B8-02 : comparaison email case-insensitive + trim (Evan@x.fr ==  evan@x.fr )', async () => {
    const ctx = mockCtx({
      ownerEmail: 'Evan@x.fr',
      ownerConfirmed: true,
      supabaseBody: {
        id: 'supabase-evan',
        email: ' evan@x.fr ',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      },
    })
    const result = await runLinkSupabaseAccount(ctx, {
      sessionToken: 'sess',
      supabaseAccessToken: 'good',
    })
    expect(result.ok).toBe(true)
    expect(result.supabaseUserId).toBe('supabase-evan')
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      { ownerUserId: 'user-A', supabaseUserId: 'supabase-evan' },
    )
  })
})

describe('runAssertLinkForErase — B8-01', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('process', {
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
      },
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
  })

  it('token Supabase B alors que lien = A → ACCOUNT_LINK_MISMATCH', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'supabase-B',
        email: 'b@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      }),
    }) as unknown as typeof fetch

    const runQuery = vi.fn().mockImplementation((_ref: unknown, args: Record<string, unknown>) => {
      if ('sessionToken' in args) return Promise.resolve({ userId: 'user-A' })
      return Promise.resolve({
        ownerUserId: 'user-A',
        supabaseUserId: 'supabase-A',
        linkedAt: 1,
      })
    })

    await expect(
      runAssertLinkForErase(
        { runQuery },
        { sessionToken: 'sess', supabaseAccessToken: 'token-b' },
      ),
    ).rejects.toThrow('ACCOUNT_LINK_MISMATCH')
  })

  it('sans token téléphone + lien présent → ok', async () => {
    const runQuery = vi.fn().mockImplementation((_ref: unknown, args: Record<string, unknown>) => {
      if ('sessionToken' in args) return Promise.resolve({ userId: 'user-A' })
      return Promise.resolve({
        ownerUserId: 'user-A',
        supabaseUserId: 'supabase-A',
        linkedAt: 1,
      })
    })
    const result = await runAssertLinkForErase({ runQuery }, { sessionToken: 'sess' })
    expect(result.supabaseUserId).toBe('supabase-A')
  })
})
