/**
 * Partner tool accounts / invites / sessions (OP-a).
 * Joueur Convex auth ≠ compte partenaire — pas de SSO.
 */
import { v } from 'convex/values'
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import {
  assertPasswordPolicy,
  createOpaqueToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from './lib/authCrypto'
import {
  createPartnerSession,
  PARTNER_INVITE_TTL_MS,
  partnerCanManageStaff,
  publicPartnerAccount,
  requirePartnerSession,
  revokeAllPartnerAccountSessions,
  revokePartnerSessionByToken,
} from './lib/partnerAuth'
import { consumeRateLimit } from './lib/rateLimit'

const roleInviteValidator = v.union(v.literal('partner_staff'), v.literal('partner_admin'))
const roleAllValidator = v.union(
  v.literal('partner_staff'),
  v.literal('partner_admin'),
  v.literal('rg_admin'),
)

async function findAccountByEmail(ctx: MutationCtx, email: string) {
  return ctx.db
    .query('rewardsPartnerAccount')
    .withIndex('by_email', (q) => q.eq('email', email))
    .first()
}

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email)
    await consumeRateLimit(ctx, 'signInEmail', { kind: 'email', value: email })
    const account = await findAccountByEmail(ctx, email)
    if (!account || !account.active) {
      return { ok: false as const, error: 'PARTNER_INVALID_CREDENTIALS' }
    }
    const ok = await verifyPassword(args.password, account.passwordHash)
    if (!ok) {
      return { ok: false as const, error: 'PARTNER_INVALID_CREDENTIALS' }
    }
    const now = Date.now()
    const session = await createPartnerSession(ctx, account._id, now)
    await ctx.db.patch(account._id, { lastLoginAt: now })
    return {
      ok: true as const,
      partnerSessionToken: session.partnerSessionToken,
      expiresAt: session.expiresAt,
      account: publicPartnerAccount(account),
    }
  },
})

export const logout = mutation({
  args: { partnerSessionToken: v.string() },
  handler: async (ctx, args) => {
    const revoked = await revokePartnerSessionByToken(ctx, args.partnerSessionToken)
    return { ok: true as const, revoked }
  },
})

export const me = query({
  args: { partnerSessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const session = await requirePartnerSession(ctx, args.partnerSessionToken, {
        touch: false,
      })
      const account = await ctx.db.get(session.accountId)
      if (!account) return { ok: false as const, error: 'PARTNER_AUTH_REQUIRED' }
      const partner = await ctx.db.get(session.partnerId)
      return {
        ok: true as const,
        account: publicPartnerAccount(account),
        partner: partner
          ? { partnerId: partner._id, name: partner.name, slug: partner.slug, active: partner.active }
          : null,
      }
    } catch {
      return { ok: false as const, error: 'PARTNER_AUTH_REQUIRED' }
    }
  },
})

/** One-shot invite → set password (OP-A01). Never invites rg_admin. */
export const acceptInvite = mutation({
  args: {
    token: v.string(),
    password: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      assertPasswordPolicy(args.password, 8)
    } catch {
      return { ok: false as const, error: 'PARTNER_PASSWORD_POLICY' }
    }
    const now = Date.now()
    const tokenHash = await hashToken(args.token.trim())
    const invite = await ctx.db
      .query('rewardsPartnerInvite')
      .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
      .first()
    if (!invite || invite.usedAt || invite.expiresAt <= now) {
      return { ok: false as const, error: 'PARTNER_INVITE_INVALID' }
    }
    const email = normalizeEmail(args.email ?? invite.email ?? '')
    if (!email) return { ok: false as const, error: 'PARTNER_EMAIL_REQUIRED' }
    if (invite.email && normalizeEmail(invite.email) !== email) {
      return { ok: false as const, error: 'PARTNER_INVITE_EMAIL_MISMATCH' }
    }
    const existing = await findAccountByEmail(ctx, email)
    if (existing) return { ok: false as const, error: 'PARTNER_EMAIL_TAKEN' }

    const partner = await ctx.db.get(invite.partnerId)
    if (!partner || !partner.active) {
      return { ok: false as const, error: 'PARTNER_INACTIVE' }
    }

    const passwordHash = await hashPassword(args.password)
    const accountId = await ctx.db.insert('rewardsPartnerAccount', {
      email,
      passwordHash,
      partnerId: invite.partnerId,
      role: invite.role,
      active: true,
      createdAt: now,
      lastLoginAt: now,
    })
    await ctx.db.patch(invite._id, { usedAt: now })
    const session = await createPartnerSession(ctx, accountId, now)
    const account = await ctx.db.get(accountId)
    return {
      ok: true as const,
      partnerSessionToken: session.partnerSessionToken,
      expiresAt: session.expiresAt,
      account: account ? publicPartnerAccount(account) : null,
    }
  },
})

/** partner_admin: create invite for partner_staff of same partnerId only. */
export const createInvite = mutation({
  args: {
    partnerSessionToken: v.string(),
    email: v.optional(v.string()),
    role: roleInviteValidator,
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await requirePartnerSession(ctx, args.partnerSessionToken)
    if (!partnerCanManageStaff(session.role)) {
      return { ok: false as const, error: 'PARTNER_ADMIN_REQUIRED' }
    }
    if (args.role === 'partner_admin' && session.role !== 'rg_admin' && session.role !== 'partner_admin') {
      return { ok: false as const, error: 'PARTNER_ADMIN_REQUIRED' }
    }
    // partner_admin may only invite staff for own partner; never rg_admin (validator blocks).
    if (session.role === 'partner_admin' && args.role !== 'partner_staff' && args.role !== 'partner_admin') {
      return { ok: false as const, error: 'PARTNER_ROLE_FORBIDDEN' }
    }
    const now = Date.now()
    const rawToken = createOpaqueToken()
    const tokenHash = await hashToken(rawToken)
    const ttl = Math.min(
      Math.max(args.ttlMs ?? PARTNER_INVITE_TTL_MS, 60_000),
      30 * 24 * 60 * 60 * 1000,
    )
    const inviteId = await ctx.db.insert('rewardsPartnerInvite', {
      tokenHash,
      partnerId: session.partnerId,
      role: args.role,
      email: args.email ? normalizeEmail(args.email) : undefined,
      expiresAt: now + ttl,
      createdAt: now,
      createdByAccountId: session.accountId,
    })
    return {
      ok: true as const,
      inviteId,
      token: rawToken,
      expiresAt: now + ttl,
    }
  },
})

/** partner_admin: list staff of own partnerId. */
export const listStaff = query({
  args: { partnerSessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const session = await requirePartnerSession(ctx, args.partnerSessionToken, {
        touch: false,
      })
      if (!partnerCanManageStaff(session.role)) {
        return { ok: false as const, error: 'PARTNER_ADMIN_REQUIRED' }
      }
      const rows = await ctx.db
        .query('rewardsPartnerAccount')
        .withIndex('by_partnerId', (q) => q.eq('partnerId', session.partnerId))
        .collect()
      const staff = rows
        .filter((r) => r.role === 'partner_staff' || r.role === 'partner_admin')
        .map(publicPartnerAccount)
      return { ok: true as const, staff }
    } catch {
      return { ok: false as const, error: 'PARTNER_AUTH_REQUIRED' }
    }
  },
})

/** partner_admin: deactivate partner_staff of same partnerId. */
export const setStaffActive = mutation({
  args: {
    partnerSessionToken: v.string(),
    accountId: v.id('rewardsPartnerAccount'),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requirePartnerSession(ctx, args.partnerSessionToken)
    if (session.role !== 'partner_admin' && session.role !== 'rg_admin') {
      return { ok: false as const, error: 'PARTNER_ADMIN_REQUIRED' }
    }
    const target = await ctx.db.get(args.accountId)
    if (!target) return { ok: false as const, error: 'PARTNER_ACCOUNT_NOT_FOUND' }
    if (session.role === 'partner_admin' && String(target.partnerId) !== String(session.partnerId)) {
      return { ok: false as const, error: 'PARTNER_ITEM_FORBIDDEN' }
    }
    if (target.role === 'rg_admin' && session.role !== 'rg_admin') {
      return { ok: false as const, error: 'PARTNER_ROLE_FORBIDDEN' }
    }
    if (session.role === 'partner_admin' && target.role !== 'partner_staff') {
      // partner_admin may only manage partner_staff of their brand
      return { ok: false as const, error: 'PARTNER_ROLE_FORBIDDEN' }
    }
    await ctx.db.patch(target._id, { active: args.active })
    if (!args.active) {
      await revokeAllPartnerAccountSessions(ctx, target._id)
    }
    return { ok: true as const, accountId: target._id, active: args.active }
  },
})

/**
 * Manual rg_admin creation only (Studio / Evan) — never auto-signup / mass invite.
 * Internal: call from dashboard / scripts; not exposed to partner-tool UI.
 */
export const createRgAdminInternal = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
    partnerId: v.id('rewardsPartner'),
  },
  handler: async (ctx, args) => {
    assertPasswordPolicy(args.password, 8)
    const email = normalizeEmail(args.email)
    const existing = await findAccountByEmail(ctx, email)
    if (existing) throw new Error('PARTNER_EMAIL_TAKEN')
    const partner = await ctx.db.get(args.partnerId)
    if (!partner) throw new Error('PARTNER_NOT_FOUND')
    const now = Date.now()
    const passwordHash = await hashPassword(args.password)
    const accountId = await ctx.db.insert('rewardsPartnerAccount', {
      email,
      passwordHash,
      partnerId: args.partnerId,
      role: 'rg_admin',
      active: true,
      createdAt: now,
    })
    return { accountId }
  },
})

/** Test / support seed: create any partner role without invite (internal only). */
export const seedPartnerAccountInternal = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
    partnerId: v.id('rewardsPartner'),
    role: roleAllValidator,
  },
  handler: async (ctx, args) => {
    assertPasswordPolicy(args.password, 8)
    if (args.role === 'rg_admin') {
      // still allowed via internal — mirrors createRgAdminInternal
    }
    const email = normalizeEmail(args.email)
    const existing = await findAccountByEmail(ctx, email)
    if (existing) return { ok: false as const, error: 'PARTNER_EMAIL_TAKEN', accountId: existing._id }
    const now = Date.now()
    const passwordHash = await hashPassword(args.password)
    const accountId: Id<'rewardsPartnerAccount'> = await ctx.db.insert('rewardsPartnerAccount', {
      email,
      passwordHash,
      partnerId: args.partnerId,
      role: args.role,
      active: true,
      createdAt: now,
    })
    return { ok: true as const, accountId }
  },
})
