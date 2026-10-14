import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createImmutableAccountLink,
  findLinkByOwner,
  isAccountLinkValid,
  runAssertLinkForErase,
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

describe('auth_account_links — B8', () => {
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
  })
})

describe('runLinkSupabaseAccount — B8-02 emails', () => {
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
    supabaseBody: Record<string, unknown>
  }) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => opts.supabaseBody,
    }) as unknown as typeof fetch

    const runMutation = vi.fn().mockResolvedValue({
      created: true,
      ownerUserId: 'user-A',
      supabaseUserId: String(opts.supabaseBody.id),
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
