/**
 * Confirmation e-mail Convex par code à 6 chiffres (B9-01).
 * - Validité 10 min, 5 tentatives max puis nouveau code requis
 * - Flag emailConfirmedAt posé UNIQUEMENT ici (ou via Google)
 * - Envoi via transactionalMailer (env abstrait — pas de provider hardcodé)
 */
import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireSessionUser } from './lib/auth'
import { hashToken } from './lib/authCrypto'
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from './lib/transactionalMailer'

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
export const EMAIL_CODE_MAX_ATTEMPTS = 5

/** Exported for B9-01 format tests (always 6 digits, zero-padded). */
export function generateSixDigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return String(n).padStart(6, '0')
}

export async function hashEmailCode(userId: string, code: string): Promise<string> {
  return hashToken(`${userId}:${code.trim()}`)
}

export const getEmailConfirmationState = query({
  args: { sessionToken: v.string() },
  returns: v.object({
    email: v.string(),
    emailConfirmed: v.boolean(),
    mailerConfigured: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    return {
      email: user.email,
      emailConfirmed: user.emailConfirmed,
      mailerConfigured: isTransactionalEmailConfigured(),
    }
  },
})

export const getActiveCodeMeta = internalQuery({
  args: { userId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id('auth_email_verification_codes'),
      codeHash: v.string(),
      expiresAt: v.number(),
      attempts: v.number(),
      consumedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('auth_email_verification_codes')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .order('desc')
      .first()
    if (!row || row.consumedAt != null) return null
    return {
      _id: row._id,
      codeHash: row.codeHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      consumedAt: row.consumedAt,
    }
  },
})

/** Testable store — wraps the DB writes used by the internal mutation. */
export async function storeEmailCodeForUser(
  ctx: { db: MutationCtx['db'] },
  args: { userId: string; codeHash: string; expiresAt: number; now: number },
): Promise<null> {
  const existing = await ctx.db
    .query('auth_email_verification_codes')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
    .collect()
  for (const row of existing) {
    if (row.consumedAt == null) {
      await ctx.db.patch(row._id, { consumedAt: args.now })
    }
  }
  await ctx.db.insert('auth_email_verification_codes', {
    userId: args.userId,
    codeHash: args.codeHash,
    expiresAt: args.expiresAt,
    attempts: 0,
    createdAt: args.now,
  })
  return null
}

export const storeEmailCode = internalMutation({
  args: {
    userId: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => storeEmailCodeForUser(ctx, args),
})

/** Testable attempt recorder — sets emailConfirmedAt only on success. */
export async function recordEmailCodeAttempt(
  ctx: { db: MutationCtx['db'] },
  args: {
    codeId: Id<'auth_email_verification_codes'>
    success: boolean
    now: number
  },
): Promise<{ attempts: number; blocked: boolean; confirmed: boolean }> {
  const row = await ctx.db.get(args.codeId)
  if (!row) throw new Error('EMAIL_CODE_INVALID')
  if (row.consumedAt != null) throw new Error('EMAIL_CODE_INVALID')
  if (row.expiresAt <= args.now) throw new Error('EMAIL_CODE_EXPIRED')
  if (row.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    return { attempts: row.attempts, blocked: true, confirmed: false }
  }

  if (!args.success) {
    const attempts = row.attempts + 1
    await ctx.db.patch(row._id, { attempts })
    return {
      attempts,
      blocked: attempts >= EMAIL_CODE_MAX_ATTEMPTS,
      confirmed: false,
    }
  }

  await ctx.db.patch(row._id, {
    attempts: row.attempts + 1,
    consumedAt: args.now,
  })
  const user = await ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', row.userId))
    .first()
  if (!user) throw new Error('EMAIL_CODE_INVALID')
  await ctx.db.patch(user._id, {
    emailConfirmedAt: args.now,
    updatedAt: args.now,
  })
  return { attempts: row.attempts + 1, blocked: false, confirmed: true }
}

export const recordCodeAttempt = internalMutation({
  args: {
    codeId: v.id('auth_email_verification_codes'),
    success: v.boolean(),
    now: v.number(),
  },
  returns: v.object({
    attempts: v.number(),
    blocked: v.boolean(),
    confirmed: v.boolean(),
  }),
  handler: async (ctx, args) => recordEmailCodeAttempt(ctx, args),
})

/** Google-verified email only (exception B9-01). */
export const markEmailConfirmedViaGoogle = internalMutation({
  args: { userId: v.string(), now: v.optional(v.number()) },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const user = await ctx.db
      .query('auth_users')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId.trim()))
      .first()
    if (!user || user.deletedAt) throw new Error('AUTH_USER_MISSING')
    await ctx.db.patch(user._id, { emailConfirmedAt: now, updatedAt: now })
    return { ok: true as const }
  },
})

/** B9 migration : retire les flags confirmed posés sans vérification. */
export async function clearAllEmailConfirmedFlags(
  ctx: { db: MutationCtx['db'] },
): Promise<{ cleared: number }> {
  const users = await ctx.db.query('auth_users').collect()
  let cleared = 0
  for (const user of users) {
    if (user.emailConfirmedAt != null) {
      await ctx.db.patch(user._id, { emailConfirmedAt: undefined, updatedAt: Date.now() })
      cleared += 1
    }
  }
  return { cleared }
}

export const resetAllEmailConfirmedFlags = internalMutation({
  args: {},
  returns: v.object({ cleared: v.number() }),
  handler: async (ctx) => clearAllEmailConfirmedFlags(ctx),
})

export const requestEmailVerificationCode = action({
  args: { sessionToken: v.string() },
  returns: v.object({
    ok: v.literal(true),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args): Promise<{ ok: true; expiresAt: number }> => {
    if (!isTransactionalEmailConfigured()) {
      throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED')
    }
    const session: { userId: string; email: string } | null = await ctx.runQuery(
      api.auth.getSession,
      { sessionToken: args.sessionToken },
    )
    if (!session?.userId || !session.email) throw new Error('ACCOUNT_LINK_UNAUTHORIZED')

    const now = Date.now()
    const code = generateSixDigitCode()
    const codeHash = await hashEmailCode(session.userId, code)
    const expiresAt = now + EMAIL_CODE_TTL_MS
    await ctx.runMutation(internal.emailVerification.storeEmailCode, {
      userId: session.userId,
      codeHash,
      expiresAt,
      now,
    })

    const sent = await sendTransactionalEmail({
      toEmail: session.email,
      subject: 'Ranked Gym — Code de confirmation',
      text: `Ton code Ranked Gym : ${code}\nValable 10 minutes.`,
      html: `<p>Ton code Ranked Gym : <strong>${code}</strong></p><p>Valable 10 minutes.</p>`,
    })
    if (!sent.ok) {
      if (sent.code === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
        throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED')
      }
      throw new Error('EMAIL_SEND_FAILED')
    }
    return { ok: true as const, expiresAt }
  },
})

export const verifyEmailVerificationCode = action({
  args: {
    sessionToken: v.string(),
    code: v.string(),
  },
  returns: v.object({
    ok: v.literal(true),
    emailConfirmed: v.literal(true),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; emailConfirmed: true }> => {
    const session: { userId: string } | null = await ctx.runQuery(api.auth.getSession, {
      sessionToken: args.sessionToken,
    })
    if (!session?.userId) throw new Error('ACCOUNT_LINK_UNAUTHORIZED')

    const meta = await ctx.runQuery(internal.emailVerification.getActiveCodeMeta, {
      userId: session.userId,
    })
    if (!meta) throw new Error('EMAIL_CODE_INVALID')
    const now = Date.now()
    if (meta.expiresAt <= now) throw new Error('EMAIL_CODE_EXPIRED')
    if (meta.attempts >= EMAIL_CODE_MAX_ATTEMPTS) throw new Error('EMAIL_CODE_BLOCKED')

    const expected = await hashEmailCode(session.userId, args.code)
    const success = expected === meta.codeHash
    const outcome = await ctx.runMutation(internal.emailVerification.recordCodeAttempt, {
      codeId: meta._id,
      success,
      now,
    })
    if (outcome.blocked && !outcome.confirmed) throw new Error('EMAIL_CODE_BLOCKED')
    if (!outcome.confirmed) throw new Error('EMAIL_CODE_INVALID')
    return { ok: true as const, emailConfirmed: true as const }
  },
})

/** Test helper — vérifie les règles sans I/O mail. */
export async function evaluateCodeAttempt(args: {
  storedHash: string
  candidateHash: string
  expiresAt: number
  attempts: number
  now: number
}): Promise<'ok' | 'expired' | 'blocked' | 'invalid'> {
  if (args.expiresAt <= args.now) return 'expired'
  if (args.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return 'blocked'
  if (args.storedHash !== args.candidateHash) {
    return args.attempts + 1 >= EMAIL_CODE_MAX_ATTEMPTS ? 'blocked' : 'invalid'
  }
  return 'ok'
}

// Keep mutation export for schema discoverability of public surface used by clients that prefer mutations.
export const _noopEmailVerificationProbe = mutation({
  args: {},
  returns: v.null(),
  handler: async () => null,
})
