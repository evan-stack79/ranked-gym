import { describe, expect, it } from 'vitest'
import { applyVerifiedStateCore } from '../../convex/lib/subscriptionApply'
import { loadProStatusForUser, chainGrantsAccess } from '../../convex/lib/subscriptionAccess'
import { normalizeAppleTransaction } from '../../convex/lib/appleJws'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {
    subscriptions: [],
    subscriptionAccess: [],
    subscriptionEvents: [],
  }
  insert(table: string, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table]!.push(row)
    return Promise.resolve(row._id)
  }
  query(table: string) {
    return new FakeQuery(this.rows[table] ?? [])
  }
  get(id: string) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((c) => c._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }
  patch(id: string, patch: Record<string, unknown>) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((c) => c._id === id)
      if (!row) continue
      Object.assign(row, patch)
      return Promise.resolve()
    }
    throw new Error(`missing ${id}`)
  }
}

class FakeQuery {
  private filtered: StoredRow[]
  constructor(rows: StoredRow[]) {
    this.filtered = rows
  }
  withIndex(_n: string, fn?: (q: FakeIndex) => FakeIndex) {
    if (!fn) return this
    const idx = new FakeIndex(this.filtered)
    fn(idx)
    this.filtered = idx.rows
    return this
  }
  collect() {
    return Promise.resolve([...this.filtered])
  }
  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
}

class FakeIndex {
  rows: StoredRow[]
  constructor(rows: StoredRow[]) {
    this.rows = [...rows]
  }
  eq(field: string, value: unknown) {
    this.rows = this.rows.filter((r) => r[field] === value)
    return this
  }
}

function ctxOf(db: FakeDb) {
  return { db } as never
}

describe('applyVerifiedState + Apple normalize', () => {
  it('active trial from verified local payload grants Pro until trialEndsAt', async () => {
    process.env.SUBSCRIPTION_DEPLOY_ENV = 'test'
    const now = Date.parse('2026-11-08T12:00:00.000Z')
    const ends = now + 14 * 86400000
    const db = new FakeDb()
    await applyVerifiedStateCore(
      ctxOf(db),
      {
        userId: 'u1',
        source: 'apple',
        environment: 'local_test',
        storeChainKey: 'orig-1',
        latestTransactionId: 'tx-1',
        productId: 'ranked.pro.solo.monthly',
        billingPeriod: 'month',
        status: 'trial',
        periodEndsAt: ends,
        trialEndsAt: ends,
        autoRenew: true,
        isTrial: true,
        billingRetry: false,
        actor: 'test',
        payloadHash: 'p',
      },
      now,
    )
    const status = await loadProStatusForUser(ctxOf(db), 'u1', now)
    expect(status.active).toBe(true)
    expect(status.state).toBe('trial')
    expect(status.accessUntil).toBe(ends)
  })

  it('refuses chain steal across users', async () => {
    process.env.SUBSCRIPTION_DEPLOY_ENV = 'test'
    const now = Date.now()
    const db = new FakeDb()
    await applyVerifiedStateCore(ctxOf(db), {
      userId: 'owner',
      source: 'apple',
      environment: 'local_test',
      storeChainKey: 'shared-chain',
      productId: 'ranked.pro.solo.monthly',
      billingPeriod: 'month',
      status: 'active',
      periodEndsAt: now + 86400000,
      autoRenew: true,
      isTrial: false,
      billingRetry: false,
      actor: 't',
      payloadHash: 'a',
    })
    await expect(
      applyVerifiedStateCore(ctxOf(db), {
        userId: 'thief',
        source: 'apple',
        environment: 'local_test',
        storeChainKey: 'shared-chain',
        productId: 'ranked.pro.solo.monthly',
        billingPeriod: 'month',
        status: 'active',
        periodEndsAt: now + 86400000,
        autoRenew: true,
        isTrial: false,
        billingRetry: false,
        actor: 't',
        payloadHash: 'b',
      }),
    ).rejects.toThrow(/CHAIN_OWNED_BY_OTHER_USER/)
  })

  it('normalizeAppleTransaction maps trial + rejects unknown product', () => {
    const now = Date.now()
    const n = normalizeAppleTransaction({
      claims: {
        transactionId: 't1',
        originalTransactionId: 'o1',
        productId: 'ranked.pro.solo.yearly',
        bundleId: 'com.rankedgym.app',
        environment: 'Sandbox',
        expiresDate: now + 86400000,
        offerType: 1,
        inAppOwnershipType: 'PURCHASED',
      },
      now,
      expectedBundleId: 'com.rankedgym.app',
    })
    expect(n.billingPeriod).toBe('year')
    expect(n.status).toBe('trial')
    expect(n.environment).toBe('sandbox')

    expect(() =>
      normalizeAppleTransaction({
        claims: {
          transactionId: 't1',
          originalTransactionId: 'o1',
          productId: 'ranked.pro.duo.yearly',
          expiresDate: now + 1000,
        },
        now,
      }),
    ).toThrow(/APPLE_PRODUCT_NOT_ALLOWED|Produit non autorisé/)
  })

  it('grace grants access only until graceEndsAt', () => {
    const now = 1_000_000
    expect(
      chainGrantsAccess('grace', now, now + 10, null, now + 5, false),
    ).toBe(true)
    expect(
      chainGrantsAccess('grace', now + 6, now + 10, null, now + 5, false),
    ).toBe(false)
  })
})
