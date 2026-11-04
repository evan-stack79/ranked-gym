/**
 * Partner rewards wallet / boutique (ARCHI_REWARDS_PARTENAIRES §5).
 * Separate from Ranked Force/Discipline. No plan branching. No point purchase. No RNG attribution.
 */
import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireSessionUser } from './lib/auth'
import { createOpaqueToken } from './lib/authCrypto'
import {
  assertNoForbiddenProFields,
  catalogItemIsAvailable,
  computeCreditGrant,
  rateForCreditReason,
  REWARDS_ECONOMY_SEED,
  utcDateString,
  type RewardsCreditReason,
} from './lib/rewardsEconomy'

type SessionCtx = QueryCtx | MutationCtx

const categoryValidator = v.union(
  v.literal('RP-CAT-01'),
  v.literal('RP-CAT-02'),
  v.literal('RP-CAT-03'),
  v.literal('RP-CAT-04'),
  v.literal('RP-CAT-05'),
)

const creditReasonValidator = v.union(
  v.literal('discipline_session'),
  v.literal('week_objective'),
)

async function getActiveCycle(ctx: SessionCtx): Promise<Doc<'rankedCycle'> | null> {
  return ctx.db
    .query('rankedCycle')
    .withIndex('by_status', (q) => q.eq('status', 'active'))
    .first()
}

export async function getActiveEconomyConfig(
  ctx: SessionCtx,
): Promise<Doc<'rewardsEconomyConfig'> | null> {
  const rows = await ctx.db.query('rewardsEconomyConfig').withIndex('by_activeFrom').collect()
  if (rows.length === 0) return null
  rows.sort((a, b) => b.activeFrom - a.activeFrom)
  return rows[0] ?? null
}

export async function ensureEconomyConfigSeed(
  ctx: MutationCtx,
  now: number,
): Promise<Doc<'rewardsEconomyConfig'>> {
  const existing = await getActiveEconomyConfig(ctx)
  if (existing) return existing
  const id = await ctx.db.insert('rewardsEconomyConfig', {
    ptsPerValidatedSession: REWARDS_ECONOMY_SEED.ptsPerValidatedSession,
    ptsPerWeekObjective: REWARDS_ECONOMY_SEED.ptsPerWeekObjective,
    dailyCap: REWARDS_ECONOMY_SEED.dailyCap,
    seasonCap: REWARDS_ECONOMY_SEED.seasonCap,
    codeTtlMs: REWARDS_ECONOMY_SEED.codeTtlMs,
    activeFrom: now,
  })
  const row = await ctx.db.get(id)
  if (!row) throw new Error('REWARDS_ECONOMY_SEED_FAILED')
  return row
}

async function findLedgerByIdempotency(
  ctx: SessionCtx,
  userId: string,
  reason: RewardsCreditReason,
  refId: string,
): Promise<Doc<'rewardsLedger'> | null> {
  const rows = await ctx.db
    .query('rewardsLedger')
    .withIndex('by_user_reason_ref', (q) =>
      q.eq('userId', userId).eq('reason', reason).eq('refId', refId),
    )
    .collect()
  return rows[0] ?? null
}

export async function ensureWalletForCycle(
  ctx: MutationCtx,
  userId: string,
  cycleId: Id<'rankedCycle'>,
  now: number,
): Promise<Doc<'rewardsWallet'>> {
  const existing = await ctx.db
    .query('rewardsWallet')
    .withIndex('by_user_cycle', (q) => q.eq('userId', userId).eq('cycleId', cycleId))
    .first()
  if (existing) return existing
  const id = await ctx.db.insert('rewardsWallet', {
    userId,
    cycleId,
    balance: 0,
    earnedToday: 0,
    earnedTodayDate: utcDateString(now),
    earnedThisCycle: 0,
    updatedAt: now,
  })
  const row = await ctx.db.get(id)
  if (!row) throw new Error('REWARDS_WALLET_CREATE_FAILED')
  return row
}

function refreshDailyCounters(
  wallet: Doc<'rewardsWallet'>,
  todayUtc: string,
): { earnedToday: number; earnedTodayDate: string } {
  if (wallet.earnedTodayDate === todayUtc) {
    return { earnedToday: wallet.earnedToday, earnedTodayDate: wallet.earnedTodayDate }
  }
  return { earnedToday: 0, earnedTodayDate: todayUtc }
}

export type CreditFromDisciplineResult =
  | {
      ok: true
      granted: number
      duplicate?: boolean
      balance: number
      earnedToday: number
      earnedThisCycle: number
      noopReason?: 'cap' | 'no_cycle' | 'no_config'
    }
  | { ok: false; error: string }

/**
 * Server-only credit. Never reads subscription plan. Idempotent on (userId, reason, refId).
 */
export async function creditFromDisciplineCore(
  ctx: MutationCtx,
  input: {
    userId: string
    reason: RewardsCreditReason
    refId: string
    now?: number
  },
): Promise<CreditFromDisciplineResult> {
  const now = input.now ?? Date.now()
  const refId = input.refId.trim()
  if (!refId) return { ok: false, error: 'REWARDS_REF_REQUIRED' }

  const prior = await findLedgerByIdempotency(ctx, input.userId, input.reason, refId)
  if (prior) {
    const cycle = await getActiveCycle(ctx)
    const wallet = cycle
      ? await ctx.db
          .query('rewardsWallet')
          .withIndex('by_user_cycle', (q) =>
            q.eq('userId', input.userId).eq('cycleId', cycle._id),
          )
          .first()
      : null
    return {
      ok: true,
      granted: 0,
      duplicate: true,
      balance: wallet?.balance ?? 0,
      earnedToday: wallet?.earnedToday ?? 0,
      earnedThisCycle: wallet?.earnedThisCycle ?? 0,
    }
  }

  const cycle = await getActiveCycle(ctx)
  if (!cycle) {
    return {
      ok: true,
      granted: 0,
      balance: 0,
      earnedToday: 0,
      earnedThisCycle: 0,
      noopReason: 'no_cycle',
    }
  }

  const config = await ensureEconomyConfigSeed(ctx, now)
  const wallet = await ensureWalletForCycle(ctx, input.userId, cycle._id, now)
  const todayUtc = utcDateString(now)
  const daily = refreshDailyCounters(wallet, todayUtc)
  const rate = rateForCreditReason(config, input.reason)
  const grant = computeCreditGrant({
    rate,
    earnedToday: daily.earnedToday,
    earnedTodayDate: daily.earnedTodayDate,
    todayUtc,
    earnedThisCycle: wallet.earnedThisCycle,
    dailyCap: config.dailyCap,
    seasonCap: config.seasonCap,
  })

  if (grant <= 0) {
    return {
      ok: true,
      granted: 0,
      balance: wallet.balance,
      earnedToday: daily.earnedToday,
      earnedThisCycle: wallet.earnedThisCycle,
      noopReason: 'cap',
    }
  }

  const balanceAfter = wallet.balance + grant
  const earnedToday = daily.earnedToday + grant
  const earnedThisCycle = wallet.earnedThisCycle + grant

  await ctx.db.patch(wallet._id, {
    balance: balanceAfter,
    earnedToday,
    earnedTodayDate: todayUtc,
    earnedThisCycle,
    updatedAt: now,
  })

  await ctx.db.insert('rewardsLedger', {
    userId: input.userId,
    cycleId: cycle._id,
    delta: grant,
    reason: input.reason,
    refId,
    createdAt: now,
    balanceAfter,
  })

  return {
    ok: true,
    granted: grant,
    balance: balanceAfter,
    earnedToday,
    earnedThisCycle,
  }
}

export type RedeemItemResult =
  | { ok: true; code: string; redemptionId: Id<'rewardsRedemptionCode'>; costPoints: number }
  | { ok: false; error: string }

export async function redeemItemCore(
  ctx: MutationCtx,
  input: { userId: string; itemId: Id<'rewardsCatalogItem'>; now?: number },
): Promise<RedeemItemResult> {
  const now = input.now ?? Date.now()
  assertNoForbiddenProFields(input as unknown as Record<string, unknown>)

  const cycle = await getActiveCycle(ctx)
  if (!cycle) return { ok: false, error: 'REWARDS_NO_ACTIVE_CYCLE' }

  const config = await ensureEconomyConfigSeed(ctx, now)
  const item = await ctx.db.get(input.itemId)
  if (!item || !catalogItemIsAvailable(item, now)) {
    return { ok: false, error: 'REWARDS_ITEM_UNAVAILABLE' }
  }
  if (item.costPoints <= 0) return { ok: false, error: 'REWARDS_ITEM_INVALID_COST' }

  const partner = await ctx.db.get(item.partnerId)
  if (!partner || !partner.active) return { ok: false, error: 'REWARDS_PARTNER_INACTIVE' }

  const wallet = await ensureWalletForCycle(ctx, input.userId, cycle._id, now)
  if (wallet.balance < item.costPoints) {
    return { ok: false, error: 'REWARDS_INSUFFICIENT_BALANCE' }
  }

  // Re-read stock under same transaction (Convex serializes mutations per doc).
  const freshItem = await ctx.db.get(input.itemId)
  if (!freshItem || freshItem.stockLogical <= 0 || !catalogItemIsAvailable(freshItem, now)) {
    return { ok: false, error: 'REWARDS_ITEM_UNAVAILABLE' }
  }

  const balanceAfter = wallet.balance - freshItem.costPoints
  await ctx.db.patch(wallet._id, {
    balance: balanceAfter,
    updatedAt: now,
  })
  await ctx.db.patch(freshItem._id, {
    stockLogical: freshItem.stockLogical - 1,
  })

  let code = ''
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = `RG-${createOpaqueToken().slice(0, 16).toUpperCase()}`
    const clash = await ctx.db
      .query('rewardsRedemptionCode')
      .withIndex('by_code', (q) => q.eq('code', candidate))
      .first()
    if (!clash) {
      code = candidate
      break
    }
  }
  if (!code) return { ok: false, error: 'REWARDS_CODE_EXHAUSTED' }

  const redemptionId = await ctx.db.insert('rewardsRedemptionCode', {
    code,
    userId: input.userId,
    itemId: freshItem._id,
    costPoints: freshItem.costPoints,
    status: 'created',
    cycleId: cycle._id,
    createdAt: now,
    expiresAt: now + config.codeTtlMs,
  })

  await ctx.db.insert('rewardsLedger', {
    userId: input.userId,
    cycleId: cycle._id,
    delta: -freshItem.costPoints,
    reason: 'redeem',
    refId: String(redemptionId),
    createdAt: now,
    balanceAfter,
  })

  return { ok: true, code, redemptionId, costPoints: freshItem.costPoints }
}

export type MarkConsumedResult =
  | { ok: true; status: 'consumed' }
  | { ok: false; error: string }

export async function markConsumedCore(
  ctx: MutationCtx,
  input: { code: string; now?: number },
): Promise<MarkConsumedResult> {
  const now = input.now ?? Date.now()
  const row = await ctx.db
    .query('rewardsRedemptionCode')
    .withIndex('by_code', (q) => q.eq('code', input.code.trim()))
    .first()
  if (!row) return { ok: false, error: 'REWARDS_CODE_NOT_FOUND' }
  if (row.status === 'consumed') return { ok: false, error: 'REWARDS_CODE_ALREADY_CONSUMED' }
  if (row.status === 'invalidated' || row.status === 'partner_refused') {
    return { ok: false, error: 'REWARDS_CODE_INVALID' }
  }
  if (row.status === 'expired' || row.expiresAt <= now) {
    if (row.status !== 'expired') {
      await ctx.db.patch(row._id, { status: 'expired' })
    }
    return { ok: false, error: 'REWARDS_CODE_EXPIRED' }
  }
  if (row.status !== 'created' && row.status !== 'shown') {
    return { ok: false, error: 'REWARDS_CODE_NOT_CONSUMABLE' }
  }
  await ctx.db.patch(row._id, { status: 'consumed', consumedAt: now })
  return { ok: true, status: 'consumed' }
}

export type PartnerRefuseResult =
  | { ok: true; recredited: number; balance: number }
  | { ok: false; error: string }

/**
 * RP-14 — recredit even if seasonCap; do NOT bump earnedThisCycle.
 */
export async function partnerRefuseCore(
  ctx: MutationCtx,
  input: { code: string; reason: string; now?: number },
): Promise<PartnerRefuseResult> {
  const now = input.now ?? Date.now()
  const row = await ctx.db
    .query('rewardsRedemptionCode')
    .withIndex('by_code', (q) => q.eq('code', input.code.trim()))
    .first()
  if (!row) return { ok: false, error: 'REWARDS_CODE_NOT_FOUND' }
  if (row.status !== 'created' && row.status !== 'shown') {
    return { ok: false, error: 'REWARDS_CODE_NOT_REFUSABLE' }
  }
  if (row.expiresAt <= now) {
    await ctx.db.patch(row._id, { status: 'expired' })
    return { ok: false, error: 'REWARDS_CODE_EXPIRED' }
  }

  const wallet = await ensureWalletForCycle(ctx, row.userId, row.cycleId, now)
  const balanceAfter = wallet.balance + row.costPoints
  await ctx.db.patch(wallet._id, {
    balance: balanceAfter,
    updatedAt: now,
  })

  const ledgerId = await ctx.db.insert('rewardsLedger', {
    userId: row.userId,
    cycleId: row.cycleId,
    delta: row.costPoints,
    reason: 'partner_refuse_recredit',
    refId: String(row._id),
    createdAt: now,
    balanceAfter,
  })

  await ctx.db.patch(row._id, {
    status: 'partner_refused',
    partnerRefuseAt: now,
    partnerRefuseReason: input.reason.trim().slice(0, 500) || 'partner_refuse',
    recreditLedgerId: ledgerId,
  })
  // Then invalidate (terminal).
  await ctx.db.patch(row._id, { status: 'invalidated' })

  return { ok: true, recredited: row.costPoints, balance: balanceAfter }
}

export type OnCycleCloseResult = {
  ok: true
  walletsReset: number
  codesUntouched: true
}

/**
 * Soft reset season wallets. Never touches redemption codes or Force/Discipline scores.
 */
export async function onCycleCloseCore(
  ctx: MutationCtx,
  input: { cycleId: Id<'rankedCycle'>; now?: number },
): Promise<OnCycleCloseResult> {
  const now = input.now ?? Date.now()
  const wallets = await ctx.db
    .query('rewardsWallet')
    .withIndex('by_cycleId', (q) => q.eq('cycleId', input.cycleId))
    .collect()

  let walletsReset = 0
  for (const wallet of wallets) {
    if (wallet.balance === 0 && wallet.earnedThisCycle === 0) {
      await ctx.db.patch(wallet._id, {
        earnedToday: 0,
        earnedTodayDate: utcDateString(now),
        updatedAt: now,
      })
      walletsReset += 1
      continue
    }
    const balanceAfter = 0
    if (wallet.balance !== 0) {
      await ctx.db.insert('rewardsLedger', {
        userId: wallet.userId,
        cycleId: wallet.cycleId,
        delta: -wallet.balance,
        reason: 'season_reset',
        refId: `season_reset:${String(input.cycleId)}:${wallet.userId}`,
        createdAt: now,
        balanceAfter,
      })
    }
    await ctx.db.patch(wallet._id, {
      balance: 0,
      earnedThisCycle: 0,
      earnedToday: 0,
      earnedTodayDate: utcDateString(now),
      updatedAt: now,
    })
    walletsReset += 1
  }

  return { ok: true, walletsReset, codesUntouched: true }
}

export async function markCodeShownCore(
  ctx: MutationCtx,
  input: { userId: string; redemptionId: Id<'rewardsRedemptionCode'>; now?: number },
): Promise<{ ok: true; status: string; code: string } | { ok: false; error: string }> {
  const now = input.now ?? Date.now()
  const row = await ctx.db.get(input.redemptionId)
  if (!row || row.userId !== input.userId) {
    return { ok: false, error: 'REWARDS_CODE_NOT_FOUND' }
  }
  if (row.status === 'created') {
    await ctx.db.patch(row._id, { status: 'shown', shownAt: now })
    return { ok: true, status: 'shown', code: row.code }
  }
  return { ok: true, status: row.status, code: row.code }
}

/** Dev/seed only — ≥3 categories among RP-CAT-01…05. Identical free/Pro feed. */
export async function seedDevCatalogCore(
  ctx: MutationCtx,
  input: { now?: number; force?: boolean } = {},
): Promise<{ ok: true; partners: number; items: number; skipped?: boolean }> {
  const now = input.now ?? Date.now()
  await ensureEconomyConfigSeed(ctx, now)

  const existingPartners = await ctx.db.query('rewardsPartner').collect()
  if (existingPartners.length > 0 && !input.force) {
    const items = await ctx.db.query('rewardsCatalogItem').collect()
    return { ok: true, partners: existingPartners.length, items: items.length, skipped: true }
  }

  const partnersSpec = [
    { slug: 'cafe-ranked', name: 'Café Ranked' },
    { slug: 'fuel-bar', name: 'Fuel Bar' },
    { slug: 'recover-lab', name: 'Recover Lab' },
    { slug: 'salle-ouverte', name: 'Salle Ouverte' },
  ] as const

  const partnerIds: Id<'rewardsPartner'>[] = []
  for (const p of partnersSpec) {
    const existing = await ctx.db
      .query('rewardsPartner')
      .withIndex('by_slug', (q) => q.eq('slug', p.slug))
      .first()
    if (existing) {
      partnerIds.push(existing._id)
      continue
    }
    const id = await ctx.db.insert('rewardsPartner', {
      slug: p.slug,
      name: p.name,
      active: true,
    })
    partnerIds.push(id)
  }

  const catalog: Array<{
    partnerIdx: number
    categoryId: 'RP-CAT-01' | 'RP-CAT-02' | 'RP-CAT-03' | 'RP-CAT-04' | 'RP-CAT-05'
    title: string
    costPoints: number
    stockLogical: number
    sortOrder: number
  }> = [
    {
      partnerIdx: 0,
      categoryId: 'RP-CAT-01',
      title: 'Café offert',
      costPoints: 150,
      stockLogical: 500,
      sortOrder: 10,
    },
    {
      partnerIdx: 1,
      categoryId: 'RP-CAT-02',
      title: 'Barre protéinée',
      costPoints: 100,
      stockLogical: 500,
      sortOrder: 20,
    },
    {
      partnerIdx: 2,
      categoryId: 'RP-CAT-03',
      title: 'Sachet recovery',
      costPoints: 250,
      stockLogical: 200,
      sortOrder: 30,
    },
    {
      partnerIdx: 3,
      categoryId: 'RP-CAT-04',
      title: 'Séance découverte',
      costPoints: 300,
      stockLogical: 100,
      sortOrder: 40,
    },
  ]

  let itemsCreated = 0
  for (const entry of catalog) {
    const partnerId = partnerIds[entry.partnerIdx]
    if (!partnerId) continue
    const dup = await ctx.db
      .query('rewardsCatalogItem')
      .withIndex('by_partnerId', (q) => q.eq('partnerId', partnerId))
      .collect()
    if (dup.some((d) => d.title === entry.title)) continue
    await ctx.db.insert('rewardsCatalogItem', {
      partnerId,
      categoryId: entry.categoryId,
      title: entry.title,
      costPoints: entry.costPoints,
      stockLogical: entry.stockLogical,
      active: true,
      availableFrom: now - 1000,
      sortOrder: entry.sortOrder,
    })
    itemsCreated += 1
  }

  const partners = await ctx.db.query('rewardsPartner').collect()
  const items = await ctx.db.query('rewardsCatalogItem').collect()
  return { ok: true, partners: partners.length, items: items.length || itemsCreated }
}

// ─── Public / internal Convex API ────────────────────────────────────────────

/** Internal — called from ranked.onSessionCompleted / week objective hooks. */
export const creditFromDiscipline = internalMutation({
  args: {
    userId: v.string(),
    reason: creditReasonValidator,
    refId: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => creditFromDisciplineCore(ctx, args),
})

export const onCycleClose = internalMutation({
  args: {
    cycleId: v.id('rankedCycle'),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => onCycleCloseCore(ctx, args),
})

export const listCatalog = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    const items = await ctx.db.query('rewardsCatalogItem').collect()
    const partners = await ctx.db.query('rewardsPartner').collect()
    const partnerById = new Map(partners.map((p) => [String(p._id), p]))

    // No plan branch — identical feed free/Pro (RP-09 / CA-RP6 / CA-RP9).
    const feed = items
      .filter((item) => catalogItemIsAvailable(item, now))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      .map((item) => {
        const partner = partnerById.get(String(item.partnerId))
        return {
          itemId: item._id,
          title: item.title,
          categoryId: item.categoryId,
          costPoints: item.costPoints,
          stockLogical: item.stockLogical,
          availableFrom: item.availableFrom,
          availableTo: item.availableTo ?? null,
          partner: partner
            ? { partnerId: partner._id, slug: partner.slug, name: partner.name }
            : null,
        }
      })
      .filter((row) => row.partner != null)

    return { ok: true as const, items: feed }
  },
})

export const getWallet = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const cycle = await getActiveCycle(ctx)
    const config = await getActiveEconomyConfig(ctx)
    const caps = {
      dailyCap: config?.dailyCap ?? REWARDS_ECONOMY_SEED.dailyCap,
      seasonCap: config?.seasonCap ?? REWARDS_ECONOMY_SEED.seasonCap,
      ptsPerValidatedSession:
        config?.ptsPerValidatedSession ?? REWARDS_ECONOMY_SEED.ptsPerValidatedSession,
      ptsPerWeekObjective:
        config?.ptsPerWeekObjective ?? REWARDS_ECONOMY_SEED.ptsPerWeekObjective,
    }
    if (!cycle) {
      return {
        ok: true as const,
        wallet: null,
        caps,
        cycleId: null,
      }
    }
    const wallet = await ctx.db
      .query('rewardsWallet')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user.userId).eq('cycleId', cycle._id))
      .first()
    const todayUtc = utcDateString(Date.now())
    const earnedToday =
      wallet && wallet.earnedTodayDate === todayUtc ? wallet.earnedToday : 0
    return {
      ok: true as const,
      cycleId: cycle._id,
      wallet: wallet
        ? {
            balance: wallet.balance,
            earnedToday,
            earnedThisCycle: wallet.earnedThisCycle,
            earnedTodayDate: todayUtc,
          }
        : {
            balance: 0,
            earnedToday: 0,
            earnedThisCycle: 0,
            earnedTodayDate: todayUtc,
          },
      caps,
    }
  },
})

export const redeemItem = mutation({
  args: {
    sessionToken: v.string(),
    itemId: v.id('rewardsCatalogItem'),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    return redeemItemCore(ctx, { userId: user.userId, itemId: args.itemId })
  },
})

export const markCodeShown = mutation({
  args: {
    sessionToken: v.string(),
    redemptionId: v.id('rewardsRedemptionCode'),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    return markCodeShownCore(ctx, {
      userId: user.userId,
      redemptionId: args.redemptionId,
    })
  },
})

export const listMyCodes = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const rows = await ctx.db
      .query('rewardsRedemptionCode')
      .withIndex('by_user_created', (q) => q.eq('userId', user.userId))
      .collect()
    rows.sort((a, b) => b.createdAt - a.createdAt)
    const out = []
    for (const row of rows) {
      const item = await ctx.db.get(row.itemId)
      out.push({
        redemptionId: row._id,
        code: row.status === 'created' || row.status === 'shown' ? row.code : null,
        status: row.status,
        costPoints: row.costPoints,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        itemTitle: item?.title ?? 'Cadeau',
        categoryId: item?.categoryId ?? null,
      })
    }
    return { ok: true as const, codes: out }
  },
})

/** Support / partner backoffice — admin session. */
export const markConsumed = mutation({
  args: {
    sessionToken: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    if (user.role !== 'admin') {
      return { ok: false as const, error: 'REWARDS_ADMIN_REQUIRED' }
    }
    return markConsumedCore(ctx, { code: args.code })
  },
})

export const partnerRefuse = mutation({
  args: {
    sessionToken: v.string(),
    code: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    if (user.role !== 'admin') {
      return { ok: false as const, error: 'REWARDS_ADMIN_REQUIRED' }
    }
    return partnerRefuseCore(ctx, { code: args.code, reason: args.reason })
  },
})

/** Internal helpers for tests / support tooling without admin UI. */
export const markConsumedInternal = internalMutation({
  args: { code: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => markConsumedCore(ctx, args),
})

export const partnerRefuseInternal = internalMutation({
  args: {
    code: v.string(),
    reason: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => partnerRefuseCore(ctx, args),
})

export const seedDevCatalog = mutation({
  args: {
    sessionToken: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    if (user.role !== 'admin') {
      return { ok: false as const, error: 'REWARDS_ADMIN_REQUIRED' }
    }
    return seedDevCatalogCore(ctx, { force: args.force })
  },
})

export const seedDevCatalogInternal = internalMutation({
  args: { force: v.optional(v.boolean()), now: v.optional(v.number()) },
  handler: async (ctx, args) => seedDevCatalogCore(ctx, args),
})

// Keep category validator referenced for schema alignment / future args.
void categoryValidator
