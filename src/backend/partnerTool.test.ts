import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertAdminConfirmed,
  assertPartnerOwnsItem,
  isPartnerCaisseRole,
  partnerCanManageStaff,
  type PartnerSessionAccount,
} from '../../convex/lib/partnerAuth'
import {
  getPartnerToolAllowedOrigins,
  isPartnerToolOriginAllowed,
  partnerToolCorsHeaders,
  PARTNER_TOOL_ORIGIN_PLACEHOLDER,
} from '../../convex/lib/partnerCors'
import {
  markConsumedCore,
  partnerLookupCodeCore,
  partnerMarkConsumedGuarded,
  partnerRefuseCore,
  partnerRefuseGuarded,
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
  | 'rewardsPartnerAccount'
  | 'rewardsPartnerSession'
  | 'rewardsPartnerActionLog'
  | 'auth_sessions'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {
    rankedCycle: [],
    rewardsWallet: [],
    rewardsLedger: [],
    rewardsPartner: [],
    rewardsCatalogItem: [],
    rewardsRedemptionCode: [],
    rewardsEconomyConfig: [],
    rewardsPartnerAccount: [],
    rewardsPartnerSession: [],
    rewardsPartnerActionLog: [],
    auth_sessions: [],
  }

  insert(table: TableName | string, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    if (!this.rows[table]) this.rows[table] = []
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName | string) {
    return new FakeQuery(this.rows[table] ?? [])
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
    return this.rows[name] ?? []
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
  return (await db.insert('rankedCycle', {
    startsAt: now - 1000,
    endsAt: now + 7 * 86_400_000,
    status: 'active',
  })) as Id<'rankedCycle'>
}

function accountOf(
  partnerId: Id<'rewardsPartner'>,
  role: PartnerSessionAccount['role'],
  accountId = 'rewardsPartnerAccount:1' as Id<'rewardsPartnerAccount'>,
): PartnerSessionAccount {
  return {
    accountId,
    email: `${role}@partner.test`,
    partnerId,
    role,
    sessionId: 'rewardsPartnerSession:1' as Id<'rewardsPartnerSession'>,
  }
}

async function redeemFixture(db: FakeDb, now: number) {
  const cycleId = await seedCycle(db, now)
  await seedDevCatalogCore(ctxOf(db), { now })
  const item = db.table('rewardsCatalogItem').find((r) => r.costPoints === 100)!
  const partnerId = item.partnerId as Id<'rewardsPartner'>
  await db.insert('rewardsWallet', {
    userId: 'player-1',
    cycleId,
    balance: 200,
    earnedToday: 0,
    earnedTodayDate: '2026-11-04',
    earnedThisCycle: 200,
    updatedAt: now,
  })
  const redeemed = await redeemItemCore(ctxOf(db), {
    userId: 'player-1',
    itemId: item._id as Id<'rewardsCatalogItem'>,
    now,
  })
  if (!redeemed.ok) throw new Error('redeem failed')
  return { cycleId, partnerId, code: redeemed.code, item }
}

describe('partner tool guards (CA-OP*)', () => {
  it('role helpers recognize caisse roles only', () => {
    expect(isPartnerCaisseRole('partner_staff')).toBe(true)
    expect(isPartnerCaisseRole('partner_admin')).toBe(true)
    expect(isPartnerCaisseRole('rg_admin')).toBe(true)
    expect(isPartnerCaisseRole('user')).toBe(false)
    expect(isPartnerCaisseRole('admin')).toBe(false)
    expect(partnerCanManageStaff('partner_admin')).toBe(true)
    expect(partnerCanManageStaff('partner_staff')).toBe(false)
  })

  it('CA-OP8: rg_admin without adminConfirmed is rejected', () => {
    const acct = accountOf('rewardsPartner:1' as Id<'rewardsPartner'>, 'rg_admin')
    expect(assertAdminConfirmed(acct, undefined)).toEqual({
      ok: false,
      error: 'PARTNER_ADMIN_CONFIRM_REQUIRED',
    })
    expect(assertAdminConfirmed(acct, false)).toEqual({
      ok: false,
      error: 'PARTNER_ADMIN_CONFIRM_REQUIRED',
    })
    expect(assertAdminConfirmed(acct, true)).toEqual({ ok: true })
    const staff = accountOf('rewardsPartner:1' as Id<'rewardsPartner'>, 'partner_staff')
    expect(assertAdminConfirmed(staff, undefined)).toEqual({ ok: true })
  })

  it('staff cannot act on another partner item', () => {
    const acct = accountOf('rewardsPartner:A' as Id<'rewardsPartner'>, 'partner_staff')
    expect(assertPartnerOwnsItem(acct, 'rewardsPartner:B' as Id<'rewardsPartner'>)).toEqual({
      ok: false,
      error: 'PARTNER_ITEM_FORBIDDEN',
    })
    expect(assertPartnerOwnsItem(acct, 'rewardsPartner:A' as Id<'rewardsPartner'>)).toEqual({
      ok: true,
    })
    const admin = accountOf('rewardsPartner:A' as Id<'rewardsPartner'>, 'rg_admin')
    expect(assertPartnerOwnsItem(admin, 'rewardsPartner:B' as Id<'rewardsPartner'>)).toEqual({
      ok: true,
    })
  })

  it('lookup is read-only (does not consume) and hides wallet/€ fields', async () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    const db = new FakeDb()
    const { partnerId, code } = await redeemFixture(db, now)
    const acct = accountOf(partnerId, 'partner_staff')
    const looked = await partnerLookupCodeCore(ctxOf(db), {
      account: acct,
      code,
      now,
      log: true,
    })
    expect(looked.ok).toBe(true)
    if (!looked.ok) return
    expect(looked.actionable).toBe(true)
    expect(looked.itemTitle.length).toBeGreaterThan(0)
    expect(looked).not.toHaveProperty('balance')
    expect(looked).not.toHaveProperty('force')
    expect(looked).not.toHaveProperty('discipline')
    expect(looked).not.toHaveProperty('euros')
    expect(JSON.stringify(looked)).not.toMatch(/€|Force|Discipline/)
    expect(db.table('rewardsRedemptionCode')[0]?.status).toBe('created')
    expect(db.table('rewardsPartnerActionLog')[0]?.action).toBe('lookup')
    expect(db.table('rewardsPartnerActionLog')[0]?.result).toBe('ok')
  })

  it('CA-OP2: markConsumed once; second call clear error + log', async () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    const db = new FakeDb()
    const { partnerId, code } = await redeemFixture(db, now)
    const acct = accountOf(partnerId, 'partner_staff')
    const first = await partnerMarkConsumedGuarded(ctxOf(db), { account: acct, code, now })
    expect(first).toEqual({ ok: true, status: 'consumed' })
    const second = await partnerMarkConsumedGuarded(ctxOf(db), {
      account: acct,
      code,
      now: now + 1,
    })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error).toBe('REWARDS_CODE_ALREADY_CONSUMED')
    const logs = db.table('rewardsPartnerActionLog').filter((r) => r.action === 'consume')
    expect(logs).toHaveLength(2)
    expect(logs[1]?.result).toBe('denied')
  })

  it('CA-OP3: partnerRefuse recredits without bumping earnedThisCycle', async () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    const db = new FakeDb()
    const { partnerId, code } = await redeemFixture(db, now)
    // Simulate season cap already maxed.
    db.table('rewardsWallet')[0]!.earnedThisCycle = 1200
    const before = db.table('rewardsWallet')[0]!.balance as number
    const acct = accountOf(partnerId, 'partner_admin')
    const refused = await partnerRefuseGuarded(ctxOf(db), {
      account: acct,
      code,
      reason: 'rupture_rayon',
      now: now + 5,
    })
    expect(refused.ok).toBe(true)
    if (!refused.ok) return
    expect(refused.recredited).toBe(100)
    expect(db.table('rewardsWallet')[0]?.balance).toBe(before + 100)
    expect(db.table('rewardsWallet')[0]?.earnedThisCycle).toBe(1200)
    expect(db.table('rewardsRedemptionCode')[0]?.status).toBe('invalidated')
    expect(
      db.table('rewardsLedger').some((r) => r.reason === 'partner_refuse_recredit'),
    ).toBe(true)
    expect(db.table('rewardsPartnerActionLog').some((r) => r.action === 'refuse')).toBe(true)
  })

  it('CA-OP8 guarded path: rg_admin without flag denied; with flag ok', async () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    const db = new FakeDb()
    const { partnerId, code } = await redeemFixture(db, now)
    const acct = accountOf(partnerId, 'rg_admin')
    const denied = await partnerMarkConsumedGuarded(ctxOf(db), {
      account: acct,
      code,
      adminConfirmed: false,
      now,
    })
    expect(denied).toEqual({ ok: false, error: 'PARTNER_ADMIN_CONFIRM_REQUIRED' })
    expect(db.table('rewardsRedemptionCode')[0]?.status).toBe('created')

    const ok = await partnerMarkConsumedGuarded(ctxOf(db), {
      account: acct,
      code,
      adminConfirmed: true,
      now: now + 1,
    })
    expect(ok).toEqual({ ok: true, status: 'consumed' })
    const log = db
      .table('rewardsPartnerActionLog')
      .find((r) => r.action === 'consume' && r.result === 'ok')
    expect(log?.adminConfirmed).toBe(true)
  })

  it('cross-partner staff denied on consume/refuse/lookup', async () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    const db = new FakeDb()
    const { code } = await redeemFixture(db, now)
    const otherPartner = (await db.insert('rewardsPartner', {
      slug: 'other-brand',
      name: 'Other',
      active: true,
    })) as Id<'rewardsPartner'>
    const acct = accountOf(otherPartner, 'partner_staff')
    const looked = await partnerLookupCodeCore(ctxOf(db), { account: acct, code, now, log: true })
    expect(looked).toEqual({ ok: false, error: 'PARTNER_ITEM_FORBIDDEN' })
    const consumed = await partnerMarkConsumedGuarded(ctxOf(db), { account: acct, code, now })
    expect(consumed).toEqual({ ok: false, error: 'PARTNER_ITEM_FORBIDDEN' })
    const refused = await partnerRefuseGuarded(ctxOf(db), { account: acct, code, now })
    expect(refused).toEqual({ ok: false, error: 'PARTNER_ITEM_FORBIDDEN' })
  })

  it('markConsumedCore idempotence still holds at core layer', async () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    const db = new FakeDb()
    const { code } = await redeemFixture(db, now)
    expect(await markConsumedCore(ctxOf(db), { code, now })).toEqual({
      ok: true,
      status: 'consumed',
    })
    expect((await markConsumedCore(ctxOf(db), { code, now: now + 1 })).ok).toBe(false)
  })

  it('CA-OP4: player rewardsService never wires markConsumed / partnerRefuse', () => {
    const svc = readFileSync(resolve('src/services/rewardsService.ts'), 'utf8')
    expect(svc).not.toMatch(/markConsumed/)
    expect(svc).not.toMatch(/partnerRefuse/)
    expect(svc).not.toMatch(/partnerLookupCode/)
  })

  it('public markConsumed / partnerRefuse require partnerSessionToken (not joueur sessionToken)', () => {
    const raw = readFileSync(resolve('convex/rewards.ts'), 'utf8')
    const authLib = readFileSync(resolve('convex/lib/partnerAuth.ts'), 'utf8')
    expect(raw).toMatch(/partnerSessionToken/)
    expect(raw).toMatch(/PARTNER_PLAYER_AUTH_REJECTED/)
    expect(raw).toMatch(/assertAdminConfirmed/)
    expect(authLib).toMatch(/PARTNER_ADMIN_CONFIRM_REQUIRED/)
    // Old player-admin sessionToken path removed from public partner mutations.
    const markBlock = raw.slice(raw.indexOf('export const markConsumed = mutation'))
    const markArgs = markBlock.slice(0, markBlock.indexOf('handler:'))
    expect(markArgs).toContain('partnerSessionToken')
    expect(markArgs).not.toMatch(/\bsessionToken:\s*v\.string\(\)/)
  })
})

describe('partner CORS prep (OP-d)', () => {
  it('placeholder origin configured; marketing-like origin not auto-allowed unless listed', () => {
    const allowed = getPartnerToolAllowedOrigins()
    expect(allowed).toContain(PARTNER_TOOL_ORIGIN_PLACEHOLDER)
    expect(isPartnerToolOriginAllowed(PARTNER_TOOL_ORIGIN_PLACEHOLDER)).toBe(true)
    expect(isPartnerToolOriginAllowed('https://ranked-gym.com')).toBe(false)
    expect(isPartnerToolOriginAllowed('https://www.rankedgym.fr')).toBe(false)
    const headers = partnerToolCorsHeaders(PARTNER_TOOL_ORIGIN_PLACEHOLDER)
    expect(headers['Access-Control-Allow-Origin']).toBe(PARTNER_TOOL_ORIGIN_PLACEHOLDER)
    const denied = partnerToolCorsHeaders('https://ranked-gym.com')
    expect(denied['Access-Control-Allow-Origin']).toBeUndefined()
  })
})

describe('partnerRefuseCore still credits active season (M1 regression)', () => {
  it('prior-cycle refuse still works under guarded path', async () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    const db = new FakeDb()
    const oldCycleId = (await db.insert('rankedCycle', {
      startsAt: now - 60 * 86_400_000,
      endsAt: now - 1000,
      status: 'closed',
    })) as Id<'rankedCycle'>
    const activeCycleId = (await db.insert('rankedCycle', {
      startsAt: now - 500,
      endsAt: now + 40 * 86_400_000,
      status: 'active',
    })) as Id<'rankedCycle'>
    await seedDevCatalogCore(ctxOf(db), { now })
    const item = db.table('rewardsCatalogItem').find((r) => r.costPoints === 100)!
    const partnerId = item.partnerId as Id<'rewardsPartner'>
    await db.insert('rewardsWallet', {
      userId: 'u1',
      cycleId: activeCycleId,
      balance: 0,
      earnedToday: 0,
      earnedTodayDate: '2026-11-04',
      earnedThisCycle: 0,
      updatedAt: now,
    })
    const code = 'RG-PRIOR-OP-TEST01'
    await db.insert('rewardsRedemptionCode', {
      code,
      userId: 'u1',
      itemId: item._id,
      costPoints: 100,
      status: 'shown',
      cycleId: oldCycleId,
      createdAt: now - 10_000,
      expiresAt: now + 20 * 86_400_000,
      shownAt: now - 9000,
    })
    const core = await partnerRefuseCore(ctxOf(db), { code, reason: 'qa', now: now + 1 })
    expect(core.ok).toBe(true)
    if (!core.ok) return
    expect(core.recreditCycleId).toBe(activeCycleId)
    expect(core.priorCycleCode).toBe(true)

    // Fresh code for guarded path (same item/partner)
    const code2 = 'RG-PRIOR-OP-TEST02'
    await db.insert('rewardsRedemptionCode', {
      code: code2,
      userId: 'u1',
      itemId: item._id,
      costPoints: 100,
      status: 'shown',
      cycleId: oldCycleId,
      createdAt: now - 10_000,
      expiresAt: now + 20 * 86_400_000,
    })
    const guarded = await partnerRefuseGuarded(ctxOf(db), {
      account: accountOf(partnerId, 'partner_staff'),
      code: code2,
      reason: 'qa2',
      now: now + 2,
    })
    expect(guarded.ok).toBe(true)
  })
})
