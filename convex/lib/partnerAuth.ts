/**
 * Partner-tool auth (ARCHI_OUTIL_PARTENAIRE §3) — distinct from player Convex sessions.
 * Session: absolute 8h · idle 30 min. No joueur SSO.
 */
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { createOpaqueToken, hashToken } from './authCrypto'

type SessionCtx = QueryCtx | MutationCtx

export const PARTNER_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000
export const PARTNER_SESSION_IDLE_MS = 30 * 60 * 1000
export const PARTNER_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type PartnerRole = 'partner_staff' | 'partner_admin' | 'rg_admin'

export type PartnerSessionAccount = {
  accountId: Id<'rewardsPartnerAccount'>
  email: string
  partnerId: Id<'rewardsPartner'>
  role: PartnerRole
  sessionId: Id<'rewardsPartnerSession'>
}

export function isPartnerCaisseRole(role: string): role is PartnerRole {
  return role === 'partner_staff' || role === 'partner_admin' || role === 'rg_admin'
}

export function partnerCanManageStaff(role: PartnerRole): boolean {
  return role === 'partner_admin' || role === 'rg_admin'
}

/** ARCHI §3.2.5 — partner_admin CRUD partner_staff only; rg_admin may invite staff|admin. */
export function canCreatePartnerInvite(
  actorRole: PartnerRole,
  inviteRole: 'partner_staff' | 'partner_admin',
): boolean {
  if (actorRole === 'rg_admin') return true
  if (actorRole === 'partner_admin') return inviteRole === 'partner_staff'
  return false
}

/**
 * Resolve a valid partner session. Touches lastActiveAt on mutations (idle sliding).
 * Returns null if missing / revoked / absolute expired / idle expired.
 */
export async function resolvePartnerSession(
  ctx: SessionCtx,
  partnerSessionToken: string,
  opts?: { touch?: boolean; now?: number },
): Promise<PartnerSessionAccount | null> {
  const raw = partnerSessionToken.trim()
  if (!raw) return null
  const now = opts?.now ?? Date.now()
  const tokenHash = await hashToken(raw)
  const session = await ctx.db
    .query('rewardsPartnerSession')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .first()
  if (!session || session.revokedAt) return null
  if (session.expiresAt <= now) return null
  if (now - session.lastActiveAt > PARTNER_SESSION_IDLE_MS) return null

  const account = await ctx.db.get(session.accountId)
  if (!account || !account.active) return null
  if (!isPartnerCaisseRole(account.role)) return null

  // m2 — marque désactivée → session invalide (pas d’accès caisse).
  const partner = await ctx.db.get(account.partnerId)
  if (!partner || !partner.active) return null

  if (opts?.touch && 'patch' in ctx.db) {
    await ctx.db.patch(session._id, { lastActiveAt: now })
  }

  return {
    accountId: account._id,
    email: account.email,
    partnerId: account.partnerId,
    role: account.role,
    sessionId: session._id,
  }
}

export async function requirePartnerSession(
  ctx: SessionCtx,
  partnerSessionToken: string,
  opts?: { touch?: boolean; now?: number },
): Promise<PartnerSessionAccount> {
  const session = await resolvePartnerSession(ctx, partnerSessionToken, {
    touch: opts?.touch ?? true,
    now: opts?.now,
  })
  if (!session) {
    throw new Error('PARTNER_AUTH_REQUIRED')
  }
  return session
}

/**
 * Explicit reject for player app sessions on partner caisse endpoints (CA-OP4 / OP-F06).
 * Returns true when the token hashes to a live player auth_sessions row.
 */
export async function isPlayerAppSessionToken(
  ctx: SessionCtx,
  token: string,
): Promise<boolean> {
  const raw = token.trim()
  if (!raw) return false
  const tokenHash = await hashToken(raw)
  const now = Date.now()
  const session = await ctx.db
    .query('auth_sessions')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .first()
  if (!session || session.revokedAt || session.expiresAt <= now) return false
  return true
}

export async function createPartnerSession(
  ctx: MutationCtx,
  accountId: Id<'rewardsPartnerAccount'>,
  now = Date.now(),
): Promise<{ partnerSessionToken: string; expiresAt: number }> {
  const partnerSessionToken = createOpaqueToken()
  const tokenHash = await hashToken(partnerSessionToken)
  const expiresAt = now + PARTNER_SESSION_ABSOLUTE_MS
  await ctx.db.insert('rewardsPartnerSession', {
    accountId,
    tokenHash,
    createdAt: now,
    expiresAt,
    lastActiveAt: now,
  })
  return { partnerSessionToken, expiresAt }
}

export async function revokePartnerSessionByToken(
  ctx: MutationCtx,
  partnerSessionToken: string,
  now = Date.now(),
): Promise<boolean> {
  const tokenHash = await hashToken(partnerSessionToken.trim())
  const existing = await ctx.db
    .query('rewardsPartnerSession')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .first()
  if (!existing || existing.revokedAt) return false
  await ctx.db.patch(existing._id, { revokedAt: now })
  return true
}

export async function revokeAllPartnerAccountSessions(
  ctx: MutationCtx,
  accountId: Id<'rewardsPartnerAccount'>,
  now = Date.now(),
): Promise<number> {
  const sessions = await ctx.db
    .query('rewardsPartnerSession')
    .withIndex('by_accountId', (q) => q.eq('accountId', accountId))
    .collect()
  let revoked = 0
  for (const session of sessions) {
    if (!session.revokedAt) {
      revoked += 1
      await ctx.db.patch(session._id, { revokedAt: now })
    }
  }
  return revoked
}

/**
 * Staff/admin may only act on codes whose catalog item.partnerId matches account.partnerId.
 * rg_admin may act on any partner.
 */
export function assertPartnerOwnsItem(
  account: PartnerSessionAccount,
  itemPartnerId: Id<'rewardsPartner'>,
): { ok: true } | { ok: false; error: 'PARTNER_ITEM_FORBIDDEN' } {
  if (account.role === 'rg_admin') return { ok: true }
  if (String(account.partnerId) !== String(itemPartnerId)) {
    return { ok: false, error: 'PARTNER_ITEM_FORBIDDEN' }
  }
  return { ok: true }
}

/**
 * CA-OP8 — rg_admin must pass adminConfirmed: true on consume/refuse.
 */
export function assertAdminConfirmed(
  account: PartnerSessionAccount,
  adminConfirmed: boolean | undefined,
): { ok: true } | { ok: false; error: 'PARTNER_ADMIN_CONFIRM_REQUIRED' } {
  if (account.role !== 'rg_admin') return { ok: true }
  if (adminConfirmed === true) return { ok: true }
  return { ok: false, error: 'PARTNER_ADMIN_CONFIRM_REQUIRED' }
}

export async function appendPartnerActionLog(
  ctx: MutationCtx,
  input: {
    partnerId: Id<'rewardsPartner'>
    accountId: Id<'rewardsPartnerAccount'>
    role: string
    code: string
    redemptionId?: Id<'rewardsRedemptionCode'>
    action: 'lookup' | 'consume' | 'refuse'
    result: 'ok' | 'denied' | 'error'
    errorCode?: string
    reason?: string
    adminConfirmed?: boolean
    createdAt?: number
    ipHash?: string
  },
): Promise<Id<'rewardsPartnerActionLog'>> {
  return ctx.db.insert('rewardsPartnerActionLog', {
    partnerId: input.partnerId,
    accountId: input.accountId,
    role: input.role,
    code: input.code,
    redemptionId: input.redemptionId,
    action: input.action,
    result: input.result,
    errorCode: input.errorCode,
    reason: input.reason,
    adminConfirmed: input.adminConfirmed,
    createdAt: input.createdAt ?? Date.now(),
    ipHash: input.ipHash,
  })
}

export function publicPartnerAccount(account: Doc<'rewardsPartnerAccount'>) {
  return {
    accountId: account._id,
    email: account.email,
    partnerId: account.partnerId,
    role: account.role,
    active: account.active,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt,
  }
}
