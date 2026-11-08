/**
 * Matrice CA-PRO1…28 — fait / partiel / non fait (testable hors stores).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PRO_L05_CHECKBOX_TEXT,
  PRO_L05B_MONTHLY,
  PRO_YEARLY_PRICE_LINE,
  proD02EngagementText,
} from '../../shared/subscriptions/legalCopy'
import { PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY, PRO_FAMILY_SHARING_ENABLED } from '../../shared/subscriptions/constants'
import { evaluatePurchaseAgeGate } from '../../shared/subscriptions/age'
import { applyVerifiedStateCore } from '../../convex/lib/subscriptionApply'
import { loadProStatusForUser } from '../../convex/lib/subscriptionAccess'
import { creditFromDisciplineCore } from '../../convex/rewards'
import { REWARDS_ECONOMY_SEED } from '../../convex/lib/rewardsEconomy'

type StoredRow = Record<string, unknown> & { _id: string }
class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {
    subscriptions: [],
    subscriptionAccess: [],
    subscriptionEvents: [],
    rewardsWallet: [],
    rewardsLedger: [],
    rewardsEconomyConfig: [],
    rankedCycle: [],
  }
  insert(table: string, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    ;(this.rows[table] ??= []).push(row)
    return Promise.resolve(row._id)
  }
  query(table: string) {
    return new FakeQuery(this.rows[table] ?? [])
  }
  get(id: string) {
    for (const rows of Object.values(this.rows)) {
      const hit = rows.find((r) => r._id === id)
      if (hit) return Promise.resolve(hit)
    }
    return Promise.resolve(null)
  }
  patch(id: string, patch: Record<string, unknown>) {
    for (const rows of Object.values(this.rows)) {
      const hit = rows.find((r) => r._id === id)
      if (!hit) continue
      Object.assign(hit, patch)
      return Promise.resolve()
    }
    throw new Error(id)
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
  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
  collect() {
    return Promise.resolve([...this.filtered])
  }
}
class FakeIndex {
  rows: StoredRow[]
  constructor(rows: StoredRow[]) {
    this.rows = [...rows]
  }
  eq(f: string, v: unknown) {
    this.rows = this.rows.filter((r) => r[f] === v)
    return this
  }
}
const ctxOf = (db: FakeDb) => ({ db }) as never

describe('Matrice CA-PRO (testable sans comptes stores)', () => {
  it('CA-PRO1: même crédit free/Pro', async () => {
    process.env.SUBSCRIPTION_DEPLOY_ENV = 'test'
    const now = Date.parse('2026-11-08T12:00:00Z')
    const dbF = new FakeDb()
    const dbP = new FakeDb()
    for (const db of [dbF, dbP]) {
      await db.insert('rankedCycle', {
        startsAt: now - 1,
        endsAt: now + 86400000,
        status: 'active',
      })
    }
    await applyVerifiedStateCore(ctxOf(dbP), {
      userId: 'pro',
      source: 'apple',
      environment: 'local_test',
      storeChainKey: 'c',
      productId: 'ranked.pro.solo.monthly',
      billingPeriod: 'month',
      status: 'active',
      periodEndsAt: now + 86400000,
      autoRenew: true,
      isTrial: false,
      billingRetry: false,
      actor: 't',
      payloadHash: 'p',
    })
    const a = await creditFromDisciplineCore(ctxOf(dbF), {
      userId: 'free',
      reason: 'discipline_session',
      refId: 's1',
      now,
    })
    const b = await creditFromDisciplineCore(ctxOf(dbP), {
      userId: 'pro',
      reason: 'discipline_session',
      refId: 's1',
      now,
    })
    expect(a.ok && a.granted).toBe(REWARDS_ECONOMY_SEED.ptsPerValidatedSession)
    expect(b.ok && b.granted).toBe(a.ok && a.granted)
  })

  it('CA-PRO4: pas de mutation publique setPro*', () => {
    const src = readFileSync(resolve(__dirname, '../../convex/subscriptions.ts'), 'utf8')
    expect(src).not.toMatch(/export const setPro\w*\s*=\s*mutation/)
    expect(src).toMatch(/recordPurchaseConsent = preparePurchase/)
  })

  it('CA-PRO14/23: textes L05 / L05b + case non précochée dans UI', () => {
    expect(PRO_L05_CHECKBOX_TEXT.length).toBeGreaterThan(40)
    expect(PRO_L05B_MONTHLY).toContain('14 jours')
    const ui = readFileSync(resolve(__dirname, '../components/pro/ProScreen.tsx'), 'utf8')
    expect(ui).toMatch(/checked=\{consent\}/)
    expect(ui).toMatch(/disabled=\{!consent/)
    expect(ui).not.toMatch(/useState\(true\)/)
  })

  it('CA-PRO17: <15 bloqué', () => {
    const g = evaluatePurchaseAgeGate('2015-01-01', Date.UTC(2026, 0, 1))
    expect(g.ok).toBe(false)
  })

  it('CA-PRO19/27: PRO-D02 hors paywall', () => {
    const text = proD02EngagementText(PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY)
    expect(text).toContain(PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY)
    const paywall = readFileSync(resolve(__dirname, '../components/pro/ProScreen.tsx'), 'utf8')
    expect(paywall).not.toMatch(/6\s*%/)
  })

  it('CA-PRO20: annuel 7,50', () => {
    expect(PRO_YEARLY_PRICE_LINE).toContain('7,50')
  })

  it('CA-PRO22: Duo/Squad non vendus (produits refusés)', async () => {
    process.env.SUBSCRIPTION_DEPLOY_ENV = 'test'
    const db = new FakeDb()
    await expect(
      applyVerifiedStateCore(ctxOf(db), {
        userId: 'u',
        source: 'apple',
        environment: 'local_test',
        storeChainKey: 'duo',
        productId: 'ranked.pro.duo.yearly',
        billingPeriod: 'year',
        status: 'active',
        periodEndsAt: Date.now() + 1000,
        autoRenew: true,
        isTrial: false,
        billingRetry: false,
        actor: 't',
        payloadHash: 'x',
      }),
    ).rejects.toThrow()
  })

  it('family sharing disabled flag', () => {
    expect(PRO_FAMILY_SHARING_ENABLED).toBe(false)
  })

  it('CA-PRO6/7 grâce : grace status requires graceEndsAt', async () => {
    process.env.SUBSCRIPTION_DEPLOY_ENV = 'test'
    const now = Date.now()
    const db = new FakeDb()
    await applyVerifiedStateCore(ctxOf(db), {
      userId: 'u',
      source: 'apple',
      environment: 'local_test',
      storeChainKey: 'g',
      productId: 'ranked.pro.solo.monthly',
      billingPeriod: 'month',
      status: 'grace',
      periodEndsAt: now - 1000,
      graceEndsAt: now + 16 * 86400000,
      autoRenew: true,
      isTrial: false,
      billingRetry: true,
      actor: 't',
      payloadHash: 'g',
    })
    expect((await loadProStatusForUser(ctxOf(db), 'u', now)).active).toBe(true)
    expect((await loadProStatusForUser(ctxOf(db), 'u', now + 17 * 86400000)).active).toBe(false)
  })

  it('StoreKit local + Capgo exact version présents (AB-a)', () => {
    const storekit = readFileSync(resolve(__dirname, '../../ios/RankedPro.storekit'), 'utf8')
    expect(storekit).toContain('ranked.pro.solo.monthly')
    expect(storekit).toContain('"familyShareable" : false')
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.dependencies['@capgo/native-purchases']).toBe('8.9.6')
  })
})
