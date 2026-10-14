import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createImmutableAccountLink,
  findLinkByOwner,
  isAccountLinkValid,
  runLinkSupabaseAccount,
} from '../../convex/accountLinks'

type TableName = 'auth_account_links'
type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = { auth_account_links: [] }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  patch(id: string, value: Record<string, unknown>) {
    const idx = this.rows.auth_account_links.findIndex((row) => row._id === id)
    if (idx === -1) return Promise.reject(new Error('missing'))
    this.rows.auth_account_links[idx] = { ...this.rows.auth_account_links[idx], ...value }
    return Promise.resolve()
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
}

describe('auth_account_links — B7', () => {
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

  it('idempotent si même couple', async () => {
    const db = new FakeDb()
    const ctx = { db }
    const first = await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-A')
    const second = await createImmutableAccountLink(ctx as never, 'user-A', 'supabase-A')
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(db.table('auth_account_links')).toHaveLength(1)
  })

  it('API : lecture propre seulement ; pas de storeLink public ; token only', () => {
    expect(source).not.toMatch(/export const getLinkForOwner\s*=\s*query/)
    expect(source).toMatch(/export const getMyLink\s*=\s*query/)
    expect(source).toMatch(/requireSessionUser/)
    expect(source).not.toMatch(/export const storeLink\s*=\s*mutation/)
    expect(source).toMatch(/export const storeVerifiedLink\s*=\s*internalMutation/)
    expect(source).toMatch(/supabaseAccessToken/)
    expect(source).not.toMatch(/assertLinkForErase/)
  })

  it('B7-01 : migration auth_users crée le lien', () => {
    expect(migrationSource).toContain('createImmutableAccountLink')
    expect(migrationSource).toContain("args.entityType === 'auth_users'")
  })

  it('B7-03 : purge Supabase utilise l’id du lien, pas l’id Convex', () => {
    expect(purgeSource).toContain('internal.accountLinks.getLinkByOwner')
    expect(purgeSource).toContain('link.supabaseUserId')
    expect(purgeSource).toContain('resolvedUserId: supabaseUserId')
    expect(purgeSource).toContain('ACCOUNT_LINK_MISSING')
    // Ne doit plus purger avec session.userId (Convex) comme user_id Supabase
    const handlerIdx = purgeSource.indexOf('export const purgeSupabaseMealCopies')
    const handler = purgeSource.slice(handlerIdx)
    expect(handler).toContain('const supabaseUserId: string = link.supabaseUserId')
    expect(handler).not.toMatch(/restSelectSingle\(\s*config,\s*'nutrition',\s*userId/)
  })
})

describe('runLinkSupabaseAccount — token', () => {
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

  it('token fake → refuse, rien créé', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const runMutation = vi.fn()
    const runQuery = vi.fn().mockResolvedValue({ userId: 'user-A' })

    await expect(
      runLinkSupabaseAccount(
        { runQuery, runMutation },
        { sessionToken: 'sess', supabaseAccessToken: 'fake-token' },
      ),
    ).rejects.toThrow('ACCOUNT_LINK_SUPABASE_UNRESOLVED')
    expect(runMutation).not.toHaveBeenCalled()
  })

  it('token d’un Supabase déjà lié ailleurs → refuse', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'supabase-shared' }),
    }) as unknown as typeof fetch

    const runQuery = vi.fn().mockResolvedValue({ userId: 'user-B' })
    const runMutation = vi.fn().mockRejectedValue(new Error('ACCOUNT_LINK_ALREADY_TAKEN'))

    await expect(
      runLinkSupabaseAccount(
        { runQuery, runMutation },
        { sessionToken: 'sess-b', supabaseAccessToken: 'token-of-shared' },
      ),
    ).rejects.toThrow('ACCOUNT_LINK_ALREADY_TAKEN')
  })

  it('token valide → storeVerifiedLink avec id résolu serveur', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'supabase-A' }),
    }) as unknown as typeof fetch

    const runQuery = vi.fn().mockResolvedValue({ userId: 'user-A' })
    const runMutation = vi.fn().mockResolvedValue({
      created: true,
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
    })

    const result = await runLinkSupabaseAccount(
      { runQuery, runMutation },
      { sessionToken: 'sess', supabaseAccessToken: 'good-token' },
    )
    expect(result).toEqual({
      ok: true,
      created: true,
      ownerUserId: 'user-A',
      supabaseUserId: 'supabase-A',
    })
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      { ownerUserId: 'user-A', supabaseUserId: 'supabase-A' },
    )
    // Le téléphone n’a pas fourni supabaseUserId dans les args
    expect(globalThis.fetch).toHaveBeenCalled()
  })
})
