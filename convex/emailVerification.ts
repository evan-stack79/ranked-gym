/**
 * Confirmation e-mail Convex par code à 6 chiffres.
 * B9-01 : flag emailConfirmedAt uniquement après code correct (ou Google).
 * B10-02 : 5 tentatives / h et 3 codes / h (serveur) ; resend ne reset pas les tentatives.
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
import type { Id } from './_generated/dataModel'
import { requireSessionUser } from './lib/auth'
import { hashToken } from './lib/authCrypto'
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from './lib/transactionalMailer'

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
/** @deprecated alias — 5 tentatives totales / heure (B10-02). */
export const EMAIL_CODE_MAX_ATTEMPTS = 5
export const EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR = 5
export const EMAIL_CODE_MAX_ISSUES_PER_HOUR = 3
export const EMAIL_CODE_HOUR_MS = 60 * 60 * 1000
export const EMAIL_CODE_HOUR_BLOCKED = 'EMAIL_CODE_HOUR_BLOCKED'
export const EMAIL_CODE_HOUR_BLOCKED_MESSAGE = 'Trop d’essais, réessaie dans 1 h'

/** Exported for B9-01 format tests (always 6 digits, zero-padded). */
export function generateSixDigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return String(n).padStart(6, '0')
}

export async function hashEmailCode(userId: string, code: string): Promise<string> {
  return hashToken(`${userId}:${code.trim()}`)
}

export type EmailHourStats = {
  codesIssued: number
  attemptsUsed: number
  windowStartedAt: number | null
  blockedUntil: number | null
  blocked: boolean
}

/** Stats fenêtre glissante 1 h — codes + tentatives (resend ne reset pas). */
export async function getEmailCodeHourStats(
  ctx: { db: QueryCtx['db'] | MutationCtx['db'] },
  userId: string,
  now: number,
): Promise<EmailHourStats> {
  const rows = await ctx.db
    .query('auth_email_verification_codes')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()
  const windowStart = now - EMAIL_CODE_HOUR_MS
  const inWindow = rows.filter((row) => row.createdAt > windowStart)
  const codesIssued = inWindow.length
  const attemptsUsed = inWindow.reduce((sum, row) => sum + (row.attempts ?? 0), 0)
  const windowStartedAt =
    inWindow.length > 0 ? Math.min(...inWindow.map((row) => row.createdAt)) : null
  const hitLimit =
    codesIssued >= EMAIL_CODE_MAX_ISSUES_PER_HOUR ||
    attemptsUsed >= EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR
  const blockedUntil =
    hitLimit && windowStartedAt != null ? windowStartedAt + EMAIL_CODE_HOUR_MS : null
  const blocked = blockedUntil != null && now < blockedUntil
  return { codesIssued, attemptsUsed, windowStartedAt, blockedUntil, blocked }
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

export const getHourStatsInternal = internalQuery({
  args: { userId: v.string(), now: v.number() },
  returns: v.object({
    codesIssued: v.number(),
    attemptsUsed: v.number(),
    windowStartedAt: v.union(v.number(), v.null()),
    blockedUntil: v.union(v.number(), v.null()),
    blocked: v.boolean(),
  }),
  handler: async (ctx, args) => getEmailCodeHourStats(ctx, args.userId, args.now),
})

/**
 * Testable store — resend marque l’ancien code consommé mais ne reset PAS
 * les tentatives de la fenêtre horaire (B10-02).
 */
export async function storeEmailCodeForUser(
  ctx: { db: MutationCtx['db'] },
  args: { userId: string; codeHash: string; expiresAt: number; now: number },
): Promise<null> {
  const stats = await getEmailCodeHourStats(ctx, args.userId, args.now)
  if (stats.blocked || stats.codesIssued >= EMAIL_CODE_MAX_ISSUES_PER_HOUR) {
    throw new Error(EMAIL_CODE_HOUR_BLOCKED)
  }
  if (stats.attemptsUsed >= EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR) {
    throw new Error(EMAIL_CODE_HOUR_BLOCKED)
  }

  const existing = await ctx.db
    .query('auth_email_verification_codes')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId))
    .collect()
  for (const row of existing) {
    if (row.consumedAt == null) {
      // Invalidate for verify — keep attempts for hour accounting.
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

/** Testable attempt recorder — 5 tentatives / h cumulées ; confirmed seulement si succès. */
export async function recordEmailCodeAttempt(
  ctx: { db: MutationCtx['db'] },
  args: {
    codeId: Id<'auth_email_verification_codes'>
    success: boolean
    now: number
  },
): Promise<{ attempts: number; blocked: boolean; confirmed: boolean; hourBlocked: boolean }> {
  const row = await ctx.db.get(args.codeId)
  if (!row) throw new Error('EMAIL_CODE_INVALID')
  if (row.consumedAt != null) throw new Error('EMAIL_CODE_INVALID')
  if (row.expiresAt <= args.now) throw new Error('EMAIL_CODE_EXPIRED')

  const stats = await getEmailCodeHourStats(ctx, row.userId, args.now)
  if (stats.blocked || stats.attemptsUsed >= EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR) {
    return {
      attempts: stats.attemptsUsed,
      blocked: true,
      confirmed: false,
      hourBlocked: true,
    }
  }

  if (!args.success) {
    const attempts = row.attempts + 1
    await ctx.db.patch(row._id, { attempts })
    const after = stats.attemptsUsed + 1
    const hourBlocked = after >= EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR
    return {
      attempts: after,
      blocked: hourBlocked,
      confirmed: false,
      hourBlocked,
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
  return {
    attempts: stats.attemptsUsed + 1,
    blocked: false,
    confirmed: true,
    hourBlocked: false,
  }
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
    hourBlocked: v.boolean(),
  }),
  handler: async (ctx, args) => recordEmailCodeAttempt(ctx, args),
})

/** Google-verified email only (exception B9-01 / B10-04). */
export async function markEmailConfirmedViaGoogleForUser(
  ctx: { db: MutationCtx['db'] },
  args: { userId: string; now?: number },
): Promise<{ ok: true }> {
  const now = args.now ?? Date.now()
  const user = await ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', args.userId.trim()))
    .first()
  if (!user || user.deletedAt) throw new Error('AUTH_USER_MISSING')
  await ctx.db.patch(user._id, { emailConfirmedAt: now, updatedAt: now })
  return { ok: true as const }
}

export const markEmailConfirmedViaGoogle = internalMutation({
  args: { userId: v.string(), now: v.optional(v.number()) },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => markEmailConfirmedViaGoogleForUser(ctx, args),
})

/** B9/B10 migration : retire les flags confirmed posés sans vérification. */
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

export const EMAIL_CONFIRM_UNVERIFIED_RESET_KEY = 'email_confirm_unverified_reset_v1'

/**
 * B10-03 : one-shot — clear unverified confirmed flags once, then never again.
 */
export async function runUnconfirmResetMigrationOnce(
  ctx: { db: MutationCtx['db'] },
  now = Date.now(),
): Promise<{ ran: boolean; cleared: number; alreadyRan: boolean }> {
  const existing = await ctx.db
    .query('app_one_shot_migrations')
    .withIndex('by_key', (q) => q.eq('key', EMAIL_CONFIRM_UNVERIFIED_RESET_KEY))
    .first()
  if (existing) {
    return { ran: false, cleared: existing.resultCount ?? 0, alreadyRan: true }
  }
  const { cleared } = await clearAllEmailConfirmedFlags(ctx)
  await ctx.db.insert('app_one_shot_migrations', {
    key: EMAIL_CONFIRM_UNVERIFIED_RESET_KEY,
    ranAt: now,
    resultCount: cleared,
  })
  return { ran: true, cleared, alreadyRan: false }
}

export const resetAllEmailConfirmedFlags = internalMutation({
  args: {},
  returns: v.object({
    ran: v.boolean(),
    cleared: v.number(),
    alreadyRan: v.boolean(),
  }),
  handler: async (ctx) => runUnconfirmResetMigrationOnce(ctx),
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
    const stats = await ctx.runQuery(internal.emailVerification.getHourStatsInternal, {
      userId: session.userId,
      now,
    })
    if (stats.blocked) throw new Error(EMAIL_CODE_HOUR_BLOCKED)

    const code = generateSixDigitCode()
    const codeHash = await hashEmailCode(session.userId, code)
    const expiresAt = now + EMAIL_CODE_TTL_MS
    try {
      await ctx.runMutation(internal.emailVerification.storeEmailCode, {
        userId: session.userId,
        codeHash,
        expiresAt,
        now,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes(EMAIL_CODE_HOUR_BLOCKED)) throw new Error(EMAIL_CODE_HOUR_BLOCKED)
      throw error
    }

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

    const now = Date.now()
    const stats = await ctx.runQuery(internal.emailVerification.getHourStatsInternal, {
      userId: session.userId,
      now,
    })
    if (stats.blocked) throw new Error(EMAIL_CODE_HOUR_BLOCKED)

    const meta = await ctx.runQuery(internal.emailVerification.getActiveCodeMeta, {
      userId: session.userId,
    })
    if (!meta) throw new Error('EMAIL_CODE_INVALID')
    if (meta.expiresAt <= now) throw new Error('EMAIL_CODE_EXPIRED')

    const expected = await hashEmailCode(session.userId, args.code)
    const success = expected === meta.codeHash
    const outcome = await ctx.runMutation(internal.emailVerification.recordCodeAttempt, {
      codeId: meta._id,
      success,
      now,
    })
    if (outcome.hourBlocked && !outcome.confirmed) throw new Error(EMAIL_CODE_HOUR_BLOCKED)
    if (outcome.blocked && !outcome.confirmed) throw new Error(EMAIL_CODE_HOUR_BLOCKED)
    if (!outcome.confirmed) throw new Error('EMAIL_CODE_INVALID')
    return { ok: true as const, emailConfirmed: true as const }
  },
})

/** Test helper — règles code sans I/O mail. */
export async function evaluateCodeAttempt(args: {
  storedHash: string
  candidateHash: string
  expiresAt: number
  attempts: number
  now: number
  hourAttemptsUsed?: number
}): Promise<'ok' | 'expired' | 'blocked' | 'invalid'> {
  if (args.expiresAt <= args.now) return 'expired'
  const hourUsed = args.hourAttemptsUsed ?? args.attempts
  if (hourUsed >= EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR) return 'blocked'
  if (args.storedHash !== args.candidateHash) {
    return hourUsed + 1 >= EMAIL_CODE_MAX_ATTEMPTS_PER_HOUR ? 'blocked' : 'invalid'
  }
  return 'ok'
}
