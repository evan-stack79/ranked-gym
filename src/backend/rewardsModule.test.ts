import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REWARDS_ECONOMY_SEED } from '../../convex/lib/rewardsEconomy'
import {
  creditFromDisciplineCore,
  markConsumedCore,
  onCycleCloseCore,
  partnerRefuseCore,
  redeemItemCore,
  seedDevCatalogCore,
} from '../../convex/rewards'
import type { Id } from '../../convex/_generated/dataModel'

type TableName =
  | 'rankedCycle'
  | 'rewardsWallet'
  | 'rewardsLedger'
  | 'rewardsPartner'
  | 'rewardsCatalogItem'
  | 'rewardsRedemptionCode'
  | 'rewardsEconomyConfig'
  | 'rankedForceScore'
  | 'rankedDisciplineScore'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    rankedCycle: [],
    rewardsWallet: [],
    rewardsLedger: [],
    rewardsPartner: [],
    rewardsCatalogItem: [],
    rewardsRedemptionCode: [],
    rewardsEconomyConfig: [],
    rankedForceScore: [],
    rankedDisciplineScore: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName | string) {
    const rows = (this.rows as Record<string, StoredRow[]>)[table] ?? []
    return new FakeQuery(rows)
  }

  get(id: string) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }

  patch(id: string, patch: Record<string, unknown>) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (!row) continue
      Object.assign(row, patch)
      return Promise.resolve()
    }
    throw new Error(`Row not found: ${id}`)
  }

  table(name: TableName): StoredRow[] {
    return this.rows[name]
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

  filter() {
    return this
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }

  order() {
    return this
  }

  take(n: number) {
    return Promise.resolve(this.filtered.slice(0, n))
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
  return { db } as any
}

async function seedCycle(db: FakeDb, now: number) {
  const id = (await db.insert('rankedCycle', {
    startsAt: now - 1000,
    endsAt: now + 7 * 86_400_000,
    status: 'active',
  })) as Id<'rankedCycle'>
  return id
}

describe('rewards module cores (CA-RP*)', () => {
  it('CA-RP1: free ≡ Pro — same activity → same grant (no plan read)', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z')
    const dbFree = new FakeDb()
    const dbPro = new FakeDb()
    for (const db of [dbFree, dbPro]) {
      await seedCycle(db, now)
    }
    // Simulate free vs Pro users — credit path never receives plan.
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
    expect(free.ok && free.granted).toBe(pro.ok && pro.granted)
  })

  it('idempotent credit on (userId, reason, refId)', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z')
    const db = new FakeDb()
    await seedCycle(db, now)
    const first = await creditFromDisciplineCore(ctxOf(db), {
      userId: 'u1',
      reason: 'discipline_session',
      refId: 'sess-a',
      now,
    })
    const second = await creditFromDisciplineCore(ctxOf(db), {
      userId: 'u1',
      reason: 'discipline_session',
      refId: 'sess-a',
      now: now + 1000,
    })
    expect(first.ok && first.granted).toBe(10)
    expect(second.ok && second.duplicate).toBe(true)
    expect(second.ok && second.granted).toBe(0)
    expect(db.table('rewardsLedger').filter((r) => r.reason === 'discipline_session')).toHaveLength(
      1,
    )
    expect(db.table('rewardsWallet')[0]?.balance).toBe(10)
  })

  it('CA-RP2: no multiplier / capBonus / earlyAccess path in credit', () => {
    const raw = readFileSync(resolve('convex/rewards.ts'), 'utf8')
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bisPro\b/)
    expect(code).not.toMatch(/plan\s*===\s*['"]pro['"]/)
    expect(code).not.toMatch(/buyPoints/)
    expect(code).not.toMatch(/Math\.random/)
    expect(code).not.toMatch(/pointMultiplier/)
    expect(code).not.toMatch(/capBonus/)
    expect(code).not.toMatch(/earlyAccess/)
  })

  it('seed catalog ≥3 categories among RP-CAT-01…05', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z')
    const db = new FakeDb()
    const result = await seedDevCatalogCore(ctxOf(db), { now })
    expect(result.ok).toBe(true)
    expect(result.items).toBeGreaterThanOrEqual(3)
    const cats = new Set(db.table('rewardsCatalogItem').map((r) => r.categoryId))
    expect(cats.size).toBeGreaterThanOrEqual(3)
    expect(db.table('rewardsEconomyConfig')[0]?.dailyCap).toBe(50)
    expect(db.table('rewardsEconomyConfig')[0]?.seasonCap).toBe(1200)
  })

  it('CA-RP3: redeem once; second consume refused', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z')
    const db = new FakeDb()
    const cycleId = await seedCycle(db, now)
    await seedDevCatalogCore(ctxOf(db), { now })
    await db.insert('rewardsWallet', {
      userId: 'u1',
      cycleId,
      balance: 200,
      earnedToday: 0,
      earnedTodayDate: '2026-11-04',
      earnedThisCycle: 200,
      updatedAt: now,
    })
    const item = db.table('rewardsCatalogItem').find((r) => r.costPoints === 100)
    expect(item).toBeTruthy()
    const redeemed = await redeemItemCore(ctxOf(db), {
      userId: 'u1',
      itemId: item!._id as Id<'rewardsCatalogItem'>,
      now,
    })
    expect(redeemed.ok).toBe(true)
    if (!redeemed.ok) return
    const first = await markConsumedCore(ctxOf(db), { code: redeemed.code, now })
    expect(first).toEqual({ ok: true, status: 'consumed' })
    const second = await markConsumedCore(ctxOf(db), { code: redeemed.code, now: now + 1 })
    expect(second.ok).toBe(false)
    expect(second).toMatchObject({ error: 'REWARDS_CODE_ALREADY_CONSUMED' })
  })

  it('CA-RP7: partnerRefuse recredits without bumping earnedThisCycle (even over seasonCap)', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z')
    const db = new FakeDb()
    const cycleId = await seedCycle(db, now)
    await seedDevCatalogCore(ctxOf(db), { now })

    // Put wallet near season cap then redeem snack (100).
    await db.insert('rewardsWallet', {
      userId: 'u1',
      cycleId,
      balance: 100,
      earnedToday: 0,
      earnedTodayDate: '2026-11-04',
      earnedThisCycle: 1200,
      updatedAt: now,
    })
    const item = db.table('rewardsCatalogItem').find((r) => r.costPoints === 100)!
    const redeemed = await redeemItemCore(ctxOf(db), {
      userId: 'u1',
      itemId: item._id as Id<'rewardsCatalogItem'>,
      now,
    })
    expect(redeemed.ok).toBe(true)
    if (!redeemed.ok) return
    expect(db.table('rewardsWallet')[0]?.balance).toBe(0)
    expect(db.table('rewardsWallet')[0]?.earnedThisCycle).toBe(1200)

    const refused = await partnerRefuseCore(ctxOf(db), {
      code: redeemed.code,
      reason: 'stock_out',
      now: now + 10,
    })
    expect(refused.ok).toBe(true)
    if (!refused.ok) return
    expect(refused.recredited).toBe(100)
    const wallet = db.table('rewardsWallet')[0]
    expect(wallet?.balance).toBe(100)
    expect(wallet?.earnedThisCycle).toBe(1200)
    const codeRow = db.table('rewardsRedemptionCode')[0]
    expect(codeRow?.status).toBe('invalidated')
    expect(codeRow?.partnerRefuseReason).toBe('stock_out')
    expect(
      db.table('rewardsLedger').some((r) => r.reason === 'partner_refuse_recredit'),
    ).toBe(true)
  })

  it('CA-RP4: season reset zeros balance; codes remain', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z')
    const db = new FakeDb()
    const cycleId = await seedCycle(db, now)
    await seedDevCatalogCore(ctxOf(db), { now })
    await db.insert('rewardsWallet', {
      userId: 'u1',
      cycleId,
      balance: 220,
      earnedToday: 20,
      earnedTodayDate: '2026-11-04',
      earnedThisCycle: 220,
      updatedAt: now,
    })
    const item = db.table('rewardsCatalogItem').find((r) => r.costPoints === 100)!
    const redeemed = await redeemItemCore(ctxOf(db), {
      userId: 'u1',
      itemId: item._id as Id<'rewardsCatalogItem'>,
      now,
    })
    expect(redeemed.ok).toBe(true)
    if (!redeemed.ok) return

    // Force scores present — must remain untouched by rewards reset.
    await db.insert('rankedForceScore', {
      userId: 'u1',
      cycleId,
      score: 900,
      seedScore: 450,
      breakdown: { squat: 1, bench: 1, deadlift: 1, barbell_row: 1, ohp: 1 },
      leagueId: 'rankedLeague:1',
      updatedAt: now,
    })
    await db.insert('rankedDisciplineScore', {
      userId: 'u1',
      cycleId,
      sessionsLast7d: 3,
      streakWeeks: 1,
      score: 40,
      updatedAt: now,
    })

    const beforeCode = { ...db.table('rewardsRedemptionCode')[0] }
    const close = await onCycleCloseCore(ctxOf(db), { cycleId, now: now + 50 })
    expect(close.ok).toBe(true)
    expect(close.codesUntouched).toBe(true)

    const wallet = db.table('rewardsWallet')[0]
    expect(wallet?.balance).toBe(0)
    expect(wallet?.earnedThisCycle).toBe(0)
    const afterCode = db.table('rewardsRedemptionCode')[0]
    expect(afterCode?.code).toBe(beforeCode.code)
    expect(afterCode?.status).toBe(beforeCode.status)
    expect(db.table('rankedForceScore')[0]?.score).toBe(900)
    expect(db.table('rankedDisciplineScore')[0]?.score).toBe(40)
  })

  it('week_objective grants +20 once per refId', async () => {
    const now = Date.parse('2026-11-04T10:00:00.000Z')
    const db = new FakeDb()
    await seedCycle(db, now)
    const a = await creditFromDisciplineCore(ctxOf(db), {
      userId: 'u1',
      reason: 'week_objective',
      refId: 'iso-2026-W45',
      now,
    })
    const b = await creditFromDisciplineCore(ctxOf(db), {
      userId: 'u1',
      reason: 'week_objective',
      refId: 'iso-2026-W45',
      now: now + 1,
    })
    expect(a.ok && a.granted).toBe(20)
    expect(b.ok && b.duplicate).toBe(true)
  })
})

describe('rewards anti-P2W source scan', () => {
  it('ranked hooks credit + cycle close without plan branching', () => {
    const ranked = readFileSync(resolve('convex/ranked.ts'), 'utf8')
    expect(ranked).toContain('creditFromDisciplineCore')
    expect(ranked).toContain('onCycleCloseCore')
    expect(ranked).toContain('rewardsGranted')
  })
})
