/**
 * Lien ownerUserId (Convex) ↔ supabaseUserId.
 * Création serveur uniquement : le téléphone n’envoie jamais un user id / email Supabase,
 * seulement un access token vérifié via Auth getUser.
 * Lien immuable ; emails doivent matcher et être confirmés des deux côtés.
 */
import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireSessionUser } from './lib/auth'
import { normalizeEmail } from './lib/authCrypto'

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function readSupabaseConfig(): { url: string; key: string } | null {
  const url = (readEnv('MIGRATION_SUPABASE_URL') || readEnv('SUPABASE_URL') || '').trim()
  // Prefer anon for Auth getUser. Service-role is a server-only fallback (never VITE_*).
  const key = (
    readEnv('SUPABASE_ANON_KEY') ||
    readEnv('MIGRATION_SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ||
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

export async function findLinkBySupabaseUserId(
  ctx: QueryCtx | MutationCtx,
  supabaseUserId: string,
) {
  return ctx.db
    .query('auth_account_links')
    .withIndex('by_supabaseUserId', (q) => q.eq('supabaseUserId', supabaseUserId))
    .first()
}

/**
 * Crée un lien immuable. Idempotent si même couple.
 * Refuse si owner déjà lié à un autre Supabase, ou si ce Supabase est déjà lié ailleurs.
 */
export async function createImmutableAccountLink(
  ctx: MutationCtx,
  ownerUserId: string,
  supabaseUserId: string,
  now = Date.now(),
): Promise<{ created: boolean; ownerUserId: string; supabaseUserId: string }> {
  const owner = ownerUserId.trim()
  const supabaseId = supabaseUserId.trim()
  if (!owner || !supabaseId) throw new Error('ACCOUNT_LINK_INVALID')

  const byOwner = await findLinkByOwner(ctx, owner)
  if (byOwner) {
    if (byOwner.supabaseUserId === supabaseId) {
      return { created: false, ownerUserId: owner, supabaseUserId: supabaseId }
    }
    throw new Error('ACCOUNT_LINK_IMMUTABLE')
  }

  const bySupabase = await findLinkBySupabaseUserId(ctx, supabaseId)
  if (bySupabase) {
    if (bySupabase.ownerUserId === owner) {
      return { created: false, ownerUserId: owner, supabaseUserId: supabaseId }
    }
    throw new Error('ACCOUNT_LINK_ALREADY_TAKEN')
  }

  await ctx.db.insert('auth_account_links', {
    ownerUserId: owner,
    supabaseUserId: supabaseId,
    linkedAt: now,
    updatedAt: now,
  })
  return { created: true, ownerUserId: owner, supabaseUserId: supabaseId }
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

export type ResolvedSupabaseAuthUser = {
  id: string
  email: string
  emailConfirmed: boolean
}

export async function resolveSupabaseAuthUserFromAccessToken(
  accessToken: string,
): Promise<ResolvedSupabaseAuthUser | null> {
  const config = readSupabaseConfig()
  if (!config) return null
  const token = accessToken.trim()
  if (!token) return null
  let response: Response
  try {
    response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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
  const row = body as {
    id?: unknown
    email?: unknown
    email_confirmed_at?: unknown
    confirmed_at?: unknown
  }
  const id = typeof row.id === 'string' && row.id.length > 0 ? row.id : null
  if (!id) return null
  const email = typeof row.email === 'string' ? row.email.trim() : ''
  const confirmedRaw = row.email_confirmed_at ?? row.confirmed_at
  const emailConfirmed =
    (typeof confirmedRaw === 'string' && confirmedRaw.length > 0) ||
    (typeof confirmedRaw === 'number' && confirmedRaw > 0)
  return { id, email, emailConfirmed }
}

/** Lecture interne — jamais exposée au téléphone avec un ownerUserId arbitraire. */
export const getLinkByOwner = internalQuery({
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

/** Profil email Convex pour la création de lien (serveur only). */
export const getOwnerEmailProfile = internalQuery({
  args: { ownerUserId: v.string() },
  returns: v.union(
    v.object({
      ownerUserId: v.string(),
      email: v.string(),
      emailConfirmed: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('auth_users')
      .withIndex('by_userId', (q) => q.eq('userId', args.ownerUserId.trim()))
      .first()
    if (!user || user.deletedAt) return null
    return {
      ownerUserId: user.userId,
      email: user.email,
      emailConfirmed: typeof user.emailConfirmedAt === 'number' && user.emailConfirmedAt > 0,
    }
  },
})

/** Stockage après vérification serveur du token (action) ou migration. */
export const storeVerifiedLink = internalMutation({
  args: {
    ownerUserId: v.string(),
    supabaseUserId: v.string(),
  },
  returns: v.object({
    created: v.boolean(),
    ownerUserId: v.string(),
    supabaseUserId: v.string(),
  }),
  handler: async (ctx, args) => {
    return createImmutableAccountLink(ctx, args.ownerUserId, args.supabaseUserId)
  },
})

/** L’utilisateur ne lit que son propre lien (session). */
export const getMyLink = query({
  args: { sessionToken: v.string() },
  returns: v.union(
    v.object({
      ownerUserId: v.string(),
      supabaseUserId: v.string(),
      linkedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const link = await findLinkByOwner(ctx, user.userId)
    if (!link) return null
    return {
      ownerUserId: link.ownerUserId,
      supabaseUserId: link.supabaseUserId,
      linkedAt: link.linkedAt,
    }
  },
})

/** Logique action — testable sans wrapper Convex. */
export async function runLinkSupabaseAccount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { runQuery: (...args: any[]) => Promise<any>; runMutation: (...args: any[]) => Promise<any> },
  args: { sessionToken: string; supabaseAccessToken: string },
): Promise<{
  ok: true
  created: boolean
  ownerUserId: string
  supabaseUserId: string
}> {
  const session: { userId: string; email?: string } | null = await ctx.runQuery(
    api.auth.getSession,
    { sessionToken: args.sessionToken },
  )
  if (!session?.userId) throw new Error('ACCOUNT_LINK_UNAUTHORIZED')

  const ownerProfile: {
    ownerUserId: string
    email: string
    emailConfirmed: boolean
  } | null = await ctx.runQuery(internal.accountLinks.getOwnerEmailProfile, {
    ownerUserId: session.userId,
  })
  if (!ownerProfile) throw new Error('ACCOUNT_LINK_UNAUTHORIZED')

  const supabaseUser = await resolveSupabaseAuthUserFromAccessToken(args.supabaseAccessToken)
  if (!supabaseUser) throw new Error('ACCOUNT_LINK_SUPABASE_UNRESOLVED')

  if (!ownerProfile.emailConfirmed || !supabaseUser.emailConfirmed) {
    throw new Error('ACCOUNT_LINK_EMAIL_UNCONFIRMED')
  }

  const convexEmail = normalizeEmail(ownerProfile.email)
  const supabaseEmail = normalizeEmail(supabaseUser.email)
  if (!convexEmail || !supabaseEmail || convexEmail !== supabaseEmail) {
    throw new Error('ACCOUNT_LINK_EMAIL_MISMATCH')
  }

  const stored: { created: boolean; ownerUserId: string; supabaseUserId: string } =
    await ctx.runMutation(internal.accountLinks.storeVerifiedLink, {
      ownerUserId: session.userId,
      supabaseUserId: supabaseUser.id,
    })
  return {
    ok: true as const,
    created: stored.created,
    ownerUserId: stored.ownerUserId,
    supabaseUserId: stored.supabaseUserId,
  }
}

/**
 * Lie le compte Convex de session au Supabase du access token.
 * Emails lus serveur ; doivent matcher et être confirmés.
 */
export const linkSupabaseAccount = action({
  args: {
    sessionToken: v.string(),
    supabaseAccessToken: v.string(),
  },
  returns: v.object({
    ok: v.literal(true),
    created: v.boolean(),
    ownerUserId: v.string(),
    supabaseUserId: v.string(),
  }),
  handler: async (ctx, args) => runLinkSupabaseAccount(ctx, args),
})

/**
 * Avant erase : lien requis. Si un access token Supabase téléphone est fourni,
 * il doit correspondre exactement au supabaseUserId du lien (legacy / reconnect).
 */
export async function runAssertLinkForErase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { runQuery: (...args: any[]) => Promise<any> },
  args: { sessionToken: string; supabaseAccessToken?: string },
): Promise<{ ok: true; ownerUserId: string; supabaseUserId: string }> {
  const session: { userId: string } | null = await ctx.runQuery(api.auth.getSession, {
    sessionToken: args.sessionToken,
  })
  if (!session?.userId) throw new Error('ACCOUNT_LINK_MISMATCH')

  const link: {
    ownerUserId: string
    supabaseUserId: string
    linkedAt: number
  } | null = await ctx.runQuery(internal.accountLinks.getLinkByOwner, {
    ownerUserId: session.userId,
  })
  if (!link?.supabaseUserId) throw new Error('ACCOUNT_LINK_MISSING')

  const phoneToken = args.supabaseAccessToken?.trim()
  if (phoneToken) {
    const supabaseUser = await resolveSupabaseAuthUserFromAccessToken(phoneToken)
    if (!supabaseUser || supabaseUser.id !== link.supabaseUserId) {
      throw new Error('ACCOUNT_LINK_MISMATCH')
    }
  }

  return {
    ok: true as const,
    ownerUserId: link.ownerUserId,
    supabaseUserId: link.supabaseUserId,
  }
}

export const assertLinkForErase = action({
  args: {
    sessionToken: v.string(),
    supabaseAccessToken: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.literal(true),
    ownerUserId: v.string(),
    supabaseUserId: v.string(),
  }),
  handler: async (ctx, args) => runAssertLinkForErase(ctx, args),
})
