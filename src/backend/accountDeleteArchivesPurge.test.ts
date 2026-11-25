import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_DELETE_ARCHIVE_PURGE_BATCH,
  ACCOUNT_DELETE_ARCHIVE_TABLES,
  purgeExpiredAccountDeleteArchivesBatch,
} from '../../convex/accountDeleteArchives'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {
    account_delete_subscription_archive: [],
    account_delete_rewards_redemption_archive: [],
    account_delete_age_majority_archive: [],
    account_delete_google_takeover_archive: [],
  }

  private ensure(table: string): StoredRow[] {
    if (!this.rows[table]) this.rows[table] = []
    return this.rows[table]
  }

  insert(table: string, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.ensure(table).push(row)
    return Promise.resolve(row._id)
  }

  query(table: string) {
    return new FakeQuery(this.ensure(table))
  }

  delete(id: string) {
    for (const key of Object.keys(this.rows)) {
      const idx = this.rows[key]!.findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key]!.splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  table(name: string): StoredRow[] {
    return this.ensure(name)
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
      eq: (field: string, value: unknown) => unknown
      lte: (field: string, value: unknown) => unknown
    }) => unknown,
  ) {
    let lteField: string | null = null
    let lteValue: unknown = null
    const rangeBuilder = {
      eq: (field: string, value: unknown) => {
        this.filtered = this.filtered.filter((row) => row[field] === value)
        return rangeBuilder
      },
      lte: (field: string, value: unknown) => {
        lteField = field
        lteValue = value
        return rangeBuilder
      },
    }
    fn(rangeBuilder)
    if (lteField != null) {
      const field = lteField
      const max = Number(lteValue)
      this.filtered = this.filtered
        .filter((row) => Number(row[field]) <= max)
        .sort((a, b) => Number(a[field]) - Number(b[field]))
    }
    return this
  }
  take(limit: number) {
    return Promise.resolve(this.filtered.slice(0, limit))
  }
}

describe('account delete archive retainUntil purge', () => {
  it('lists the four Juriste archive tables', () => {
    expect(ACCOUNT_DELETE_ARCHIVE_TABLES).toHaveLength(4)
    expect(ACCOUNT_DELETE_ARCHIVE_PURGE_BATCH).toBe(100)
  })

  it('deletes rows with retainUntil <= now, keeps future rows', async () => {
    const db = new FakeDb()
    const now = 1_700_000_000_000
    await db.insert('account_delete_subscription_archive', {
      archiveId: 'a1',
      archivedAt: now - 10,
      retainUntil: now - 1,
    })
    await db.insert('account_delete_subscription_archive', {
      archiveId: 'a2',
      archivedAt: now - 10,
      retainUntil: now + 60_000,
    })
    await db.insert('account_delete_rewards_redemption_archive', {
      archiveId: 'a1',
      code: 'X',
      redeemedAt: now - 5,
      partner: 'p',
      points: 10,
      archivedAt: now - 10,
      retainUntil: now,
    })
    await db.insert('account_delete_age_majority_archive', {
      archiveId: 'a1',
      at: now - 5,
      result: '15+ oui',
      archivedAt: now - 10,
      retainUntil: now + 1,
    })
    await db.insert('account_delete_google_takeover_archive', {
      archiveId: 'a1',
      at: now - 5,
      archivedAt: now - 10,
      retainUntil: now - 100,
    })

    const first = await purgeExpiredAccountDeleteArchivesBatch({ db } as never, now, 100)
    expect(first.deleted).toBe(3)
    expect(first.byTable.account_delete_subscription_archive).toBe(1)
    expect(first.byTable.account_delete_rewards_redemption_archive).toBe(1)
    expect(first.byTable.account_delete_google_takeover_archive).toBe(1)
    expect(first.byTable.account_delete_age_majority_archive).toBe(0)
    expect(db.table('account_delete_subscription_archive')).toHaveLength(1)
    expect(db.table('account_delete_subscription_archive')[0]?.archiveId).toBe('a2')
    expect(db.table('account_delete_age_majority_archive')).toHaveLength(1)

    // Idempotent: second pass deletes nothing for the same now
    const second = await purgeExpiredAccountDeleteArchivesBatch({ db } as never, now, 100)
    expect(second.deleted).toBe(0)
    expect(second.hasMore).toBe(false)
  })

  it('batches and reports hasMore when more than limit expire', async () => {
    const db = new FakeDb()
    const now = 2_000_000_000_000
    for (let i = 0; i < 5; i++) {
      await db.insert('account_delete_subscription_archive', {
        archiveId: `b${i}`,
        archivedAt: now - 10,
        retainUntil: now - i,
      })
    }
    const result = await purgeExpiredAccountDeleteArchivesBatch({ db } as never, now, 2)
    expect(result.deleted).toBe(2)
    expect(result.hasMore).toBe(true)
    expect(db.table('account_delete_subscription_archive')).toHaveLength(3)

    const again = await purgeExpiredAccountDeleteArchivesBatch({ db } as never, now, 2)
    expect(again.deleted).toBe(2)
    expect(db.table('account_delete_subscription_archive')).toHaveLength(1)
  })
})
