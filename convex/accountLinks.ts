/**
 * Lien ownerUserId (Convex / cloud app) ↔ supabaseUserId.
 * Vérifie l’identité Supabase via access token (Auth API).
 */
import { v } from 'convex/values'
import { api } from './_generated/api'
import { action, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { requireSessionUser } from './lib/auth'

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function readSupabaseConfig(): { url: string; key: string } | null {
  const url = (readEnv('MIGRATION_SUPABASE_URL') || readEnv('SUPABASE_URL') || '').trim()
  const key = (
    readEnv('MIGRATION_SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_ANON_KEY') ||
    ''
  ).trim()
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

export async function findLinkByOwner(
  ctx: QueryCtx | MutationCtx,
  ownerUserId: string,
) {
  return ctx.db
    .query('auth_account_links')
    .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', ownerUserId))
    .first()
}

export async function upsertAccountLink(
  ctx: MutationCtx,
  ownerUserId: string,
  supabaseUserId: string,
  now = Date.now(),
): Promise<void> {
  const existing = await findLinkByOwner(ctx, ownerUserId)
  if (existing) {
    await ctx.db.patch(existing._id, {
      supabaseUserId,
      updatedAt: now,
    })
    return
  }
  await ctx.db.insert('auth_account_links', {
    ownerUserId,
    supabaseUserId,
    linkedAt: now,
    updatedAt: now,
  })
}

export async function isAccountLinkValid(
  ctx: QueryCtx | MutationCtx,
  ownerUserId: string,
  supabaseUserId: string,
): Promise<boolean> {
  const link = await findLinkByOwner(ctx, ownerUserId)
  if (!link) return false
  return link.supabaseUserId === supabaseUserId
}

async function resolveSupabaseUserIdFromAccessToken(
  accessToken: string,
): Promise<string | null> {
  const config = readSupabaseConfig()
  if (!config) return null
  let response: Response
  try {
    response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.key,
        Accept: 'application/json',
      },
    })
  } catch {
    return null
  }
  if (!response.ok) return null
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return null
  }
  if (!body || typeof body !== 'object') return null
  const id = (body as { id?: unknown }).id
  return typeof id === 'string' && id.length > 0 ? id : null
}

export const getLinkForOwner = query({
  args: { ownerUserId: v.string() },
  returns: v.union(
    v.object({
      ownerUserId: v.string(),
      supabaseUserId: v.string(),
      linkedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const link = await findLinkByOwner(ctx, args.ownerUserId.trim())
    if (!link) return null
    return {
      ownerUserId: link.ownerUserId,
      supabaseUserId: link.supabaseUserId,
      linkedAt: link.linkedAt,
    }
  },
})

export const storeLink = mutation({
  args: {
    sessionToken: v.string(),
    supabaseUserId: v.string(),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const supabaseUserId = args.supabaseUserId.trim()
    if (!supabaseUserId) throw new Error('ACCOUNT_LINK_INVALID')
    await upsertAccountLink(ctx, user.userId, supabaseUserId)
    return { ok: true as const }
  },
})

/** Lie le compte Convex de session au Supabase du access token. */
export const linkSupabaseAccount = action({
  args: {
    sessionToken: v.string(),
    supabaseAccessToken: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    ownerUserId: v.string(),
    supabaseUserId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; ownerUserId: string; supabaseUserId: string }> => {
    const session: { userId: string } | null = await ctx.runQuery(api.auth.getSession, {
      sessionToken: args.sessionToken,
    })
    if (!session?.userId) throw new Error('ACCOUNT_LINK_UNAUTHORIZED')
    const supabaseUserId = await resolveSupabaseUserIdFromAccessToken(args.supabaseAccessToken)
    if (!supabaseUserId) throw new Error('ACCOUNT_LINK_SUPABASE_UNRESOLVED')
    await ctx.runMutation(api.accountLinks.storeLink, {
      sessionToken: args.sessionToken,
      supabaseUserId,
    })
    return { ok: true, ownerUserId: session.userId, supabaseUserId }
  },
})

/**
 * Vérifie le lien avant purge.
 * ownerUserId = identité app ; supabaseAccessToken résolu serveur doit matcher.
 */
export const assertLinkForErase = action({
  args: {
    ownerUserId: v.string(),
    supabaseAccessToken: v.string(),
  },
  returns: v.object({
    ok: v.literal(true),
    ownerUserId: v.string(),
    supabaseUserId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; ownerUserId: string; supabaseUserId: string }> => {
    const ownerUserId = args.ownerUserId.trim()
    if (!ownerUserId) throw new Error('ACCOUNT_LINK_MISMATCH')
    const supabaseUserId = await resolveSupabaseUserIdFromAccessToken(args.supabaseAccessToken)
    if (!supabaseUserId) throw new Error('ACCOUNT_LINK_MISMATCH')

    const link = await ctx.runQuery(api.accountLinks.getLinkForOwner, { ownerUserId })
    if (!link || link.supabaseUserId !== supabaseUserId) {
      throw new Error('ACCOUNT_LINK_MISMATCH')
    }
    return { ok: true as const, ownerUserId, supabaseUserId }
  },
})
