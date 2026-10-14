import { describe, expect, it } from 'vitest'
import { isAccountLinkValid, upsertAccountLink } from '../../convex/accountLinks'

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

describe('auth_account_links — Convex ↔ Supabase', () => {
  it('lien A→supabaseA : B ne match pas', async () => {
    const db = new FakeDb()
    const ctx = { db }
    await upsertAccountLink(ctx as never, 'user-A', 'supabase-A')
    expect(await isAccountLinkValid(ctx as never, 'user-A', 'supabase-A')).toBe(true)
    expect(await isAccountLinkValid(ctx as never, 'user-A', 'supabase-B')).toBe(false)
    expect(await isAccountLinkValid(ctx as never, 'user-B', 'supabase-B')).toBe(false)
  })

  it('pas de lien → invalid', async () => {
    const db = new FakeDb()
    const ctx = { db }
    expect(await isAccountLinkValid(ctx as never, 'user-A', 'supabase-A')).toBe(false)
  })
})
