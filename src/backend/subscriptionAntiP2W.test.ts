import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { creditFromDisciplineCore } from '../../convex/rewards'
import { forceScoreFromBreakdown, disciplineScore } from '../../convex/lib/rankedScience'
import { applyVerifiedStateCore } from '../../convex/lib/subscriptionApply'
import { loadProStatusForUser } from '../../convex/lib/subscriptionAccess'
import { REWARDS_ECONOMY_SEED, REWARDS_FORBIDDEN_PRO_FIELDS } from '../../convex/lib/rewardsEconomy'

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
    if (!this.rows[table]) this.rows[table] = []
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
    throw new Error(`Row not found: ${id}`)
  }
}

class FakeQuery {
  private filtered: StoredRow[]
  constructor(rows: StoredRow[]) {
    this.filtered = [...rows]
  }
  withIndex(_name: string, fn?: (q: FakeIndex) => FakeIndex) {
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
    this.rows = this.rows.filter((row) => row[field] === value)
    return this
  }
}

function ctxOf(db: FakeDb) {
  return { db } as never
}

describe('RK-03 / CA-PRO1/2 — Pro n’impacte pas scores ni earn', () => {
  it('Force / Discipline pure science ignore tout plan', () => {
    const breakdown = {
      squat: 100,
      bench: 80,
      deadlift: 120,
      barbell_row: 70,
      ohp: 50,
    }
    expect(forceScoreFromBreakdown(breakdown)).toEqual(forceScoreFromBreakdown(breakdown))
    expect(disciplineScore(3, 2)).toEqual(disciplineScore(3, 2))
  })

  it('même crédit wallet free vs Pro (même séance)', async () => {
    process.env.SUBSCRIPTION_DEPLOY_ENV = 'test'
    const now = Date.parse('2026-11-08T12:00:00.000Z')
    const dbFree = new FakeDb()
    const dbPro = new FakeDb()
    for (const db of [dbFree, dbPro]) {
      await db.insert('rankedCycle', {
        startsAt: now - 1000,
        endsAt: now + 7 * 86_400_000,
        status: 'active',
      })
    }

    await applyVerifiedStateCore(ctxOf(dbPro), {
      userId: 'user-pro',
      source: 'apple',
      environment: 'local_test',
      storeChainKey: 'chain-pro',
      productId: 'ranked.pro.solo.monthly',
      billingPeriod: 'month',
      status: 'active',
      periodEndsAt: now + 86400000,
      autoRenew: true,
      isTrial: false,
      billingRetry: false,
      actor: 'test',
      payloadHash: 't',
    })

    expect((await loadProStatusForUser(ctxOf(dbFree), 'user-free', now)).active).toBe(false)
    expect((await loadProStatusForUser(ctxOf(dbPro), 'user-pro', now)).active).toBe(true)

    const free = await creditFromDisciplineCore(ctxOf(dbFree), {
      userId: 'user-free',
      reason: 'discipline_session',
      refId: 'session-1',
      now,
    })
    const pro = await creditFromDisciplineCore(ctxOf(dbPro), {
      userId: 'user-pro',
      reason: 'discipline_session',
      refId: 'session-1',
      now,
    })
    expect(free.ok && free.granted).toBe(REWARDS_ECONOMY_SEED.ptsPerValidatedSession)
    expect(pro.ok && pro.granted).toBe(REWARDS_ECONOMY_SEED.ptsPerValidatedSession)
  })

  it('rewards.ts / ranked.ts n’utilisent pas le statut Pro pour scoring', () => {
    const rewards = readFileSync(resolve(__dirname, '../../convex/rewards.ts'), 'utf8')
    const ranked = readFileSync(resolve(__dirname, '../../convex/ranked.ts'), 'utf8')
    const rewardsCode = rewards.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const rankedCode = ranked.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(rewardsCode).not.toMatch(/subscriptionAccess|requirePro|getProStatus|hasActivePro/)
    expect(rankedCode).not.toMatch(/subscriptionAccess|requirePro|getProStatus|hasActivePro/)
    for (const field of REWARDS_FORBIDDEN_PRO_FIELDS) {
      expect(rewardsCode).not.toMatch(new RegExp(`\\b${field}\\b`))
    }
  })

  it('refuse le partage familial (v0)', async () => {
    process.env.SUBSCRIPTION_DEPLOY_ENV = 'test'
    const db = new FakeDb()
    await expect(
      applyVerifiedStateCore(ctxOf(db), {
        userId: 'u1',
        source: 'apple',
        environment: 'local_test',
        storeChainKey: 'fam',
        productId: 'ranked.pro.solo.monthly',
        billingPeriod: 'month',
        status: 'active',
        periodEndsAt: Date.now() + 86400000,
        autoRenew: true,
        isTrial: false,
        billingRetry: false,
        familyShared: true,
        actor: 'test',
        payloadHash: 'f',
      }),
    ).rejects.toThrow(/FAMILY_SHARING_DISABLED/)
  })

  it('LICENCES_TIERS documente Capgo MPL-2.0 @ 8.9.6', () => {
    const lic = readFileSync(resolve(__dirname, '../../LICENCES_TIERS.md'), 'utf8')
    expect(lic).toMatch(/@capgo\/native-purchases/)
    expect(lic).toMatch(/MPL-2\.0/)
    expect(lic).toMatch(/8\.9\.6/)
    expect(lic).toMatch(/9\.1\.0/)
  })
})
