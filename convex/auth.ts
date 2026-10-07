import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import type { Id } from './_generated/dataModel'
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  internalAction,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  assertPasswordPolicy,
  createOpaqueToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  verifyPassword,
} from './lib/authCrypto'
import {
  createSession,
  requireSessionUser,
  revokeAllUserSessions,
  revokeSessionByToken,
} from './lib/auth'
import {
  getResetRedirectBaseUrl,
  getResetTokenTtlMinutes,
  isPublicSignupAllowed,
} from './lib/authConfig'
import { requireAdminCaller } from './lib/migrationAdmin'
import { consumeRateLimit } from './lib/rateLimit'
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from './lib/passwordResetMailer'

const RESET_ROUTE_PATH = '/auth/reset-password'
const RESET_LINK_PURGE_GRACE_MS = 5 * 60 * 1000
const OUTBOX_STATUS = {
  queued: 'queued',
  sending: 'sending',
  sent: 'sent',
  failed: 'failed',
  purged: 'purged',
} as const
const processPasswordResetOutboxEmailRef = makeFunctionReference<
  'action',
  { outboxId: Id<'auth_password_reset_outbox'> },
  { delivered: boolean }
>('auth:processPasswordResetOutboxEmail')
const purgePasswordResetOutboxLinkRef = makeFunctionReference<
  'mutation',
  { outboxId: Id<'auth_password_reset_outbox'> },
  null
>('auth:purgePasswordResetOutboxLink')
const beginPasswordResetOutboxAttemptRef = makeFunctionReference<
  'mutation',
  { outboxId: Id<'auth_password_reset_outbox'> },
  BeginOutboxAttemptResult
>('auth:beginPasswordResetOutboxAttempt')
const markPasswordResetOutboxSentRef = makeFunctionReference<
  'mutation',
  { outboxId: Id<'auth_password_reset_outbox'>; providerMessageId?: string },
  null
>('auth:markPasswordResetOutboxSent')
const markPasswordResetOutboxFailedRef = makeFunctionReference<
  'mutation',
  { outboxId: Id<'auth_password_reset_outbox'>; errorCode: string },
  null
>('auth:markPasswordResetOutboxFailed')
const createAdminPasswordResetLinkRef = makeFunctionReference<
  'mutation',
  {
    email: string
    redirectTo?: string
    adminSecret?: string
    sessionToken?: string
  },
  { accepted: boolean; email?: string; resetLink?: string }
>('auth:createAdminPasswordResetLink')

function toDisplayName(emailNorm: string, displayName?: string): string {
  const trimmed = displayName?.trim()
  if (trimmed) return trimmed.slice(0, 40)
  const fallback = emailNorm.split('@')[0] || 'Athlete'
  return fallback.slice(0, 40)
}

function sanitizeResetRedirectUrl(raw: string | undefined): string {
  const fallback = 'https://ranked-gym.invalid'
  if (!raw) return fallback
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return fallback
    return parsed.origin
  } catch {
    return fallback
  }
}

export function createResetLink(rawBaseUrl: string, token: string): string {
  const base = sanitizeResetRedirectUrl(rawBaseUrl)
  const url = new URL(RESET_ROUTE_PATH, `${base}/`)
  url.searchParams.set('token', token)
  return url.toString()
}

async function findUserByEmailNorm(ctx: MutationCtx, emailNorm: string) {
  return ctx.db
    .query('auth_users')
    .withIndex('by_emailNorm', (q) => q.eq('emailNorm', emailNorm))
    .first()
}

type ImportedUserInput = {
  email: string
  displayName?: string
}

type ImportOutcome = 'imported' | 'updated' | 'skippedDeleted'

async function getPasswordCredential(ctx: MutationCtx, userId: string) {
  return ctx.db
    .query('auth_password_credentials')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

async function deleteRows(
  ctx: MutationCtx,
  rows: Array<{ _id: string }>,
  deletedDocIds: Set<string>,
): Promise<void> {
  for (const row of rows) {
    await ctx.db.delete(row._id as never)
    deletedDocIds.add(String(row._id))
  }
}

/** Lot 1 SEC-DON-02 — suppression nutrition granulaire par lots. */
export const NUTRITION_DELETE_BATCH_SIZE = 500

/**
 * Tables nutrition contenant userId (hors nutrition_state déjà géré à part).
 * Toute nouvelle table user-scoped nutrition doit être ajoutée ici.
 */
export const NUTRITION_USER_CHILD_TABLES = [
  { table: 'nutrition_meals' as const, index: 'by_userId_updatedAt' as const },
  { table: 'nutrition_water_entries' as const, index: 'by_userId_updatedAt' as const },
  { table: 'nutrition_day_state' as const, index: 'by_userId_updatedAt' as const },
  { table: 'nutrition_food_catalog' as const, index: 'by_userId_lastSelectedAt' as const },
]

const continuePurgeNutritionUserDataRef = makeFunctionReference<
  'mutation',
  { userId: string },
  { done: boolean; deleted: number }
>('auth:continuePurgeNutritionUserData')

/**
 * Supprime jusqu'à NUTRITION_DELETE_BATCH_SIZE lignes par table enfant.
 * @returns true s'il reste des lignes (continuation nécessaire).
 */
export async function purgeNutritionUserDataBatch(
  ctx: MutationCtx,
  userId: string,
  deletedDocIds: Set<string>,
  batchSize: number = NUTRITION_DELETE_BATCH_SIZE,
): Promise<{ remaining: boolean; deleted: number }> {
  let deleted = 0
  let remaining = false

  const batches = [
    await ctx.db
      .query('nutrition_meals')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
      .take(batchSize),
    await ctx.db
      .query('nutrition_water_entries')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
      .take(batchSize),
    await ctx.db
      .query('nutrition_day_state')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
      .take(batchSize),
    await ctx.db
      .query('nutrition_food_catalog')
      .withIndex('by_userId_lastSelectedAt', (q) => q.eq('userId', userId))
      .take(batchSize),
  ]

  for (const rows of batches) {
    await deleteRows(ctx, rows, deletedDocIds)
    deleted += rows.length
    if (rows.length >= batchSize) {
      remaining = true
    }
  }

  return { remaining, deleted }
}

type IssuePasswordResetOptions = {
  persistOutbox?: boolean
  scheduleDelivery?: boolean
}

type SchedulerLike = {
  runAfter: MutationCtx['scheduler']['runAfter']
}

function hasScheduler(ctx: MutationCtx): ctx is MutationCtx & { scheduler: SchedulerLike } {
  const candidate = ctx as MutationCtx & { scheduler?: SchedulerLike }
  return typeof candidate.scheduler?.runAfter === 'function'
}

async function schedulePasswordResetEmailJobs(
  ctx: MutationCtx,
  outboxId: Id<'auth_password_reset_outbox'>,
  expiresAt: number,
): Promise<void> {
  if (!hasScheduler(ctx)) return
  const now = Date.now()
  const purgeDelayMs = Math.max(0, expiresAt - now + RESET_LINK_PURGE_GRACE_MS)
  await ctx.scheduler.runAfter(0, processPasswordResetOutboxEmailRef, { outboxId })
  await ctx.scheduler.runAfter(purgeDelayMs, purgePasswordResetOutboxLinkRef, {
    outboxId,
  })
}

export async function issuePasswordResetToken(
  ctx: MutationCtx,
  userId: string,
  email: string,
  emailNorm: string,
  redirectTo?: string,
  options: IssuePasswordResetOptions = {},
): Promise<{ rawToken: string; tokenHash: string; expiresAt: number }> {
  const now = Date.now()
  const rawToken = createOpaqueToken()
  const tokenHash = await hashToken(rawToken)
  const expiresAt = now + getResetTokenTtlMinutes() * 60 * 1000
  await ctx.db.insert('auth_password_reset_tokens', {
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
  })
  if (options.persistOutbox !== false) {
    const outboxId = await ctx.db.insert('auth_password_reset_outbox', {
      userId,
      email,
      emailNorm,
      tokenHash,
      resetLink: createResetLink(redirectTo || getResetRedirectBaseUrl(), rawToken),
      createdAt: now,
      expiresAt,
      attemptCount: 0,
      status: OUTBOX_STATUS.queued,
    })
    if (options.scheduleDelivery !== false) {
      try {
        await schedulePasswordResetEmailJobs(ctx, outboxId, expiresAt)
      } catch {
        await ctx.db.patch(outboxId, {
          status: OUTBOX_STATUS.failed,
          lastError: 'EMAIL_JOB_SCHEDULE_FAILED',
        })
      }
    }
  }
  return { rawToken, tokenHash, expiresAt }
}

export async function consumePasswordResetToken(
  ctx: MutationCtx,
  token: string,
  newPassword: string,
): Promise<{
  sessionToken: string
  expiresAt: number
  user: { userId: string; email: string; displayName: string }
}> {
  assertPasswordPolicy(newPassword)
  const now = Date.now()
  const tokenHash = await hashToken(token)
  await consumeRateLimit(ctx, 'passwordResetConsume', { kind: 'token', value: tokenHash })
  const reset = await ctx.db
    .query('auth_password_reset_tokens')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .first()
  if (!reset || reset.consumedAt || reset.expiresAt <= now) {
    throw new Error('AUTH_RESET_TOKEN_INVALID')
  }

  const user = await ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', reset.userId))
    .first()
  if (!user || user.deletedAt) {
    throw new Error('AUTH_RESET_TOKEN_INVALID')
  }

  const passwordHash = await hashPassword(newPassword)
  const credential = await getPasswordCredential(ctx, user.userId)
  if (credential) {
    await ctx.db.patch(credential._id, { passwordHash, updatedAt: now })
  } else {
    await ctx.db.insert('auth_password_credentials', {
      userId: user.userId,
      passwordHash,
      updatedAt: now,
    })
  }

  await ctx.db.patch(user._id, {
    mustResetPassword: false,
    updatedAt: now,
  })
  await ctx.db.patch(reset._id, { consumedAt: now })
  await revokeAllUserSessions(ctx, user.userId)
  const session = await createSession(ctx, user.userId)
  return {
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
    user: {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
    },
  }
}

export async function upsertImportedUserWithoutPassword(
  ctx: MutationCtx,
  rawUser: ImportedUserInput,
  now = Date.now(),
): Promise<ImportOutcome> {
  const emailNorm = normalizeEmail(rawUser.email)
  const existing = await findUserByEmailNorm(ctx, emailNorm)
  if (!existing) {
    await ctx.db.insert('auth_users', {
      userId: crypto.randomUUID(),
      email: emailNorm,
      emailNorm,
      displayName: toDisplayName(emailNorm, rawUser.displayName),
      mustResetPassword: true,
      createdAt: now,
      updatedAt: now,
    })
    return 'imported'
  }
  if (existing.deletedAt) {
    return 'skippedDeleted'
  }
  await ctx.db.patch(existing._id, {
    mustResetPassword: true,
    displayName: toDisplayName(emailNorm, rawUser.displayName || existing.displayName),
    updatedAt: now,
  })
  const credentials = await ctx.db
    .query('auth_password_credentials')
    .withIndex('by_userId', (q) => q.eq('userId', existing.userId))
    .collect()
  for (const credential of credentials) {
    await ctx.db.delete(credential._id)
  }
  return 'updated'
}

export async function registerUserWithEmail(
  ctx: MutationCtx,
  args: { email: string; password: string; displayName?: string },
) {
  if (!isPublicSignupAllowed()) {
    throw new Error('AUTH_SIGNUP_DISABLED')
  }
  const emailNorm = normalizeEmail(args.email)
  await consumeRateLimit(ctx, 'signUpEmail', { kind: 'email', value: emailNorm })
  const existing = await findUserByEmailNorm(ctx, emailNorm)
  if (existing) {
    throw new Error('AUTH_EMAIL_ALREADY_REGISTERED')
  }

  const now = Date.now()
  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(args.password)
  const displayName = toDisplayName(emailNorm, args.displayName)
  await ctx.db.insert('auth_users', {
    userId,
    email: emailNorm,
    emailNorm,
    displayName,
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('auth_password_credentials', {
    userId,
    passwordHash,
    updatedAt: now,
  })
  const session = await createSession(ctx, userId)
  return {
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
    mustResetPassword: false,
    user: {
      userId,
      email: emailNorm,
      displayName,
    },
  }
}

export async function deleteAccountAndUserData(
  ctx: MutationCtx,
  args: { sessionToken: string; password: string },
): Promise<{ deleted: boolean; deletedAt: number }> {
  const user = await requireSessionUser(ctx, args.sessionToken)
  await consumeRateLimit(ctx, 'deleteAccount', { kind: 'userId', value: user.userId })
  const credential = await getPasswordCredential(ctx, user.userId)
  if (!credential) {
    throw new Error('AUTH_INVALID_CREDENTIALS')
  }
  const ok = await verifyPassword(args.password, credential.passwordHash)
  if (!ok) {
    throw new Error('AUTH_INVALID_CREDENTIALS')
  }

  const now = Date.now()
  const userDoc = await ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', user.userId))
    .first()
  if (!userDoc) {
    throw new Error('AUTH_USER_NOT_FOUND')
  }

  const deletedDocIds = new Set<string>()

  // SEC-DON-02 : enfants nutrition d'abord (lots + continuation planifiée si plein).
  // auth_users n'est supprimé qu'après ce batch initial + planification fiable.
  const nutritionPurge = await purgeNutritionUserDataBatch(ctx, user.userId, deletedDocIds)
  if (nutritionPurge.remaining && hasScheduler(ctx)) {
    await ctx.scheduler.runAfter(0, continuePurgeNutritionUserDataRef, {
      userId: user.userId,
    })
  } else if (nutritionPurge.remaining) {
    // Sans scheduler (tests) : vider jusqu'à épuisement dans la même mutation.
    let guard = 0
    while (guard < 10_000) {
      const next = await purgeNutritionUserDataBatch(ctx, user.userId, deletedDocIds)
      if (!next.remaining) break
      guard += 1
    }
  }

  await deleteRows(
    ctx,
    await ctx.db.query('profiles').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('workouts_state').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('nutrition_state').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('sleep_nights')
      .withIndex('by_userId_dateKey', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('checkins')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('custom_spots')
      .withIndex('by_userId_spotId', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('active_checkins').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('aliments')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  const ownActivities = await ctx.db
    .query('activities')
    .withIndex('by_userId_createdAt', (q) => q.eq('userId', user.userId))
    .collect()
  for (const activity of ownActivities) {
    await deleteRows(
      ctx,
      await ctx.db
        .query('activity_comments')
        .withIndex('by_activityId', (q) => q.eq('activityId', activity._id))
        .collect(),
      deletedDocIds,
    )
    await deleteRows(
      ctx,
      await ctx.db
        .query('activity_reactions')
        .withIndex('by_activityId', (q) => q.eq('activityId', activity._id))
        .collect(),
      deletedDocIds,
    )
  }
  await deleteRows(ctx, ownActivities, deletedDocIds)
  await deleteRows(
    ctx,
    await ctx.db.query('activity_comments').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('activity_reactions').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('user_blocks').withIndex('by_blocker', (q) => q.eq('blockerUserId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('user_blocks').withIndex('by_blocked', (q) => q.eq('blockedUserId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('user_follows').withIndex('by_follower', (q) => q.eq('followerUserId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('user_follows').withIndex('by_followee', (q) => q.eq('followeeUserId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('ai_usage_limits')
      .withIndex('by_userId_dateOfScan', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('streak_state').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('legacy_supabase_backups')
      .withIndex('by_userId', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('auth_private_notes').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('avis_beta').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )

  const userFiles = await ctx.db
    .query('user_files')
    .withIndex('by_userId_kind', (q) => q.eq('userId', user.userId).eq('kind', 'avatar'))
    .collect()
  for (const file of userFiles) {
    await ctx.storage.delete(file.storageId)
    await ctx.db.delete(file._id)
    deletedDocIds.add(String(file._id))
  }

  deletedDocIds.add(String(userDoc._id))
  await ctx.db.delete(userDoc._id)

  await deleteRows(
    ctx,
    await ctx.db
      .query('auth_password_reset_outbox')
      .withIndex('by_userId', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('auth_password_reset_tokens')
      .withIndex('by_userId', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db
      .query('auth_password_credentials')
      .withIndex('by_userId', (q) => q.eq('userId', user.userId))
      .collect(),
    deletedDocIds,
  )
  await deleteRows(
    ctx,
    await ctx.db.query('auth_sessions').withIndex('by_userId', (q) => q.eq('userId', user.userId)).collect(),
    deletedDocIds,
  )

  const maps = await ctx.db.query('migration_entity_map').collect()
  for (const map of maps) {
    if (deletedDocIds.has(map.convexId)) {
      await ctx.db.delete(map._id)
    }
  }

  return { deleted: true, deletedAt: now }
}

export const signUpWithEmail = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
  },
  returns: v.object({
    sessionToken: v.string(),
    expiresAt: v.number(),
    mustResetPassword: v.boolean(),
    user: v.object({
      userId: v.string(),
      email: v.string(),
      displayName: v.string(),
    }),
  }),
  handler: (ctx, args) => registerUserWithEmail(ctx, args),
})

export async function signInWithPasswordForEmail(
  ctx: MutationCtx,
  args: { email: string; password: string },
) {
  const emailNorm = normalizeEmail(args.email)
  await consumeRateLimit(ctx, 'signInEmail', { kind: 'email', value: emailNorm })
  const user = await findUserByEmailNorm(ctx, emailNorm)
  if (!user || user.deletedAt) {
    throw new Error('AUTH_INVALID_CREDENTIALS')
  }
  if (user.mustResetPassword) {
    throw new Error('AUTH_PASSWORD_RESET_REQUIRED')
  }
  const credential = await getPasswordCredential(ctx, user.userId)
  if (!credential) {
    throw new Error('AUTH_PASSWORD_RESET_REQUIRED')
  }
  const ok = await verifyPassword(args.password, credential.passwordHash)
  if (!ok) {
    throw new Error('AUTH_INVALID_CREDENTIALS')
  }
  const session = await createSession(ctx, user.userId)
  return {
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
    mustResetPassword: user.mustResetPassword,
    user: {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
    },
  }
}

export const signInWithPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    sessionToken: v.string(),
    expiresAt: v.number(),
    mustResetPassword: v.boolean(),
    user: v.object({
      userId: v.string(),
      email: v.string(),
      displayName: v.string(),
    }),
  }),
  handler: (ctx, args) => signInWithPasswordForEmail(ctx, args),
})

export const signOut = mutation({
  args: {
    sessionToken: v.string(),
  },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const revoked = await revokeSessionByToken(ctx, args.sessionToken)
    return { revoked }
  },
})

export const getSession = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.union(
    v.object({
      userId: v.string(),
      email: v.string(),
      displayName: v.string(),
      mustResetPassword: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    try {
      const user = await requireSessionUser(ctx, args.sessionToken)
      return {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        mustResetPassword: user.mustResetPassword,
      }
    } catch {
      return null
    }
  },
})

export async function requestPasswordResetForEmail(
  ctx: MutationCtx,
  args: { email: string; redirectTo?: string },
): Promise<{ accepted: boolean; delivery: 'email' | 'manual' }> {
  const emailNorm = normalizeEmail(args.email)
  await consumeRateLimit(ctx, 'passwordResetRequest', { kind: 'email', value: emailNorm })
  if (!isPasswordResetEmailConfigured()) {
    return { accepted: true, delivery: 'manual' }
  }
  const user = await findUserByEmailNorm(ctx, emailNorm)
  if (user && !user.deletedAt) {
    await issuePasswordResetToken(ctx, user.userId, user.email, user.emailNorm, args.redirectTo)
  }
  return { accepted: true, delivery: 'email' }
}

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
    redirectTo: v.optional(v.string()),
  },
  returns: v.object({
    accepted: v.boolean(),
    delivery: v.union(v.literal('email'), v.literal('manual')),
  }),
  handler: (ctx, args) => requestPasswordResetForEmail(ctx, args),
})

export const consumePasswordReset = mutation({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    sessionToken: v.string(),
    expiresAt: v.number(),
    user: v.object({
      userId: v.string(),
      email: v.string(),
      displayName: v.string(),
    }),
  }),
  handler: (ctx, args) => consumePasswordResetToken(ctx, args.token, args.newPassword),
})

const outboxStatusValidator = v.union(
  v.literal(OUTBOX_STATUS.queued),
  v.literal(OUTBOX_STATUS.sending),
  v.literal(OUTBOX_STATUS.sent),
  v.literal(OUTBOX_STATUS.failed),
  v.literal(OUTBOX_STATUS.purged),
)

const outboxLifecycleMutationArgs = {
  outboxId: v.id('auth_password_reset_outbox'),
}

type BeginOutboxAttemptResult =
  | { ok: false; reason: 'missing' | 'already_processed' | 'link_unavailable' | 'expired' }
  | { ok: true; email: string; resetLink: string }

export const beginPasswordResetOutboxAttempt = internalMutation({
  args: outboxLifecycleMutationArgs,
  returns: v.union(
    v.object({
      ok: v.literal(false),
      reason: v.union(
        v.literal('missing'),
        v.literal('already_processed'),
        v.literal('link_unavailable'),
        v.literal('expired'),
      ),
    }),
    v.object({
      ok: v.literal(true),
      email: v.string(),
      resetLink: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<BeginOutboxAttemptResult> => {
    const row = await ctx.db.get(args.outboxId)
    if (!row) return { ok: false, reason: 'missing' }
    if (row.sentAt || row.status === OUTBOX_STATUS.sent || row.status === OUTBOX_STATUS.purged) {
      return { ok: false, reason: 'already_processed' }
    }
    if (!row.resetLink || row.resetLink.trim().length === 0) {
      return { ok: false, reason: 'link_unavailable' }
    }
    if (typeof row.expiresAt === 'number' && row.expiresAt <= Date.now()) {
      await ctx.db.patch(args.outboxId, {
        resetLink: '',
        status: OUTBOX_STATUS.purged,
        purgedAt: Date.now(),
      })
      return { ok: false, reason: 'expired' }
    }

    await ctx.db.patch(args.outboxId, {
      attemptCount: row.attemptCount + 1,
      lastAttemptAt: Date.now(),
      status: OUTBOX_STATUS.sending,
      lastError: undefined,
    })
    return {
      ok: true,
      email: row.email,
      resetLink: row.resetLink,
    }
  },
})

export const markPasswordResetOutboxSent = internalMutation({
  args: {
    ...outboxLifecycleMutationArgs,
    providerMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const row = await ctx.db.get(args.outboxId)
    if (!row) return null
    await ctx.db.patch(args.outboxId, {
      status: OUTBOX_STATUS.sent,
      sentAt: now,
      resetLink: '',
      purgedAt: now,
      providerMessageId: args.providerMessageId,
      lastError: undefined,
    })
    return null
  },
})

export const markPasswordResetOutboxFailed = internalMutation({
  args: {
    ...outboxLifecycleMutationArgs,
    errorCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId)
    if (!row) return null
    await ctx.db.patch(args.outboxId, {
      status: OUTBOX_STATUS.failed,
      lastError: args.errorCode.slice(0, 120),
    })
    return null
  },
})

export const purgePasswordResetOutboxLink = internalMutation({
  args: outboxLifecycleMutationArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId)
    if (!row) return null
    if (!row.resetLink || row.resetLink.trim().length === 0) return null
    await ctx.db.patch(args.outboxId, {
      resetLink: '',
      status: row.sentAt ? OUTBOX_STATUS.sent : OUTBOX_STATUS.purged,
      purgedAt: Date.now(),
    })
    return null
  },
})

export const processPasswordResetOutboxEmail = internalAction({
  args: outboxLifecycleMutationArgs,
  returns: v.object({
    delivered: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const begin = await ctx.runMutation(beginPasswordResetOutboxAttemptRef, {
      outboxId: args.outboxId,
    })
    if (!begin.ok) {
      return { delivered: false }
    }
    const delivery = await sendPasswordResetEmail({
      toEmail: begin.email,
      resetLink: begin.resetLink,
    })
    if (delivery.ok) {
      await ctx.runMutation(markPasswordResetOutboxSentRef, {
        outboxId: args.outboxId,
        providerMessageId: delivery.messageId,
      })
      return { delivered: true }
    }
    await ctx.runMutation(markPasswordResetOutboxFailedRef, {
      outboxId: args.outboxId,
      errorCode: delivery.code,
    })
    return { delivered: false }
  },
})

export async function createAdminPasswordResetLinkForAdmin(
  ctx: MutationCtx,
  args: {
    email: string
    redirectTo?: string
    adminSecret?: string
    sessionToken?: string
  },
): Promise<{ accepted: boolean; email?: string; resetLink?: string }> {
  await requireAdminCaller(ctx, args)
  const emailNorm = normalizeEmail(args.email)
  const user = await findUserByEmailNorm(ctx, emailNorm)
  if (!user || user.deletedAt) {
    return { accepted: true }
  }
  const issued = await issuePasswordResetToken(
    ctx,
    user.userId,
    user.email,
    user.emailNorm,
    args.redirectTo,
    { persistOutbox: false, scheduleDelivery: false },
  )
  return {
    accepted: true,
    email: user.email,
    resetLink: createResetLink(args.redirectTo || getResetRedirectBaseUrl(), issued.rawToken),
  }
}

export const createAdminPasswordResetLink = internalMutation({
  args: {
    email: v.string(),
    redirectTo: v.optional(v.string()),
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  returns: v.object({
    accepted: v.boolean(),
    email: v.optional(v.string()),
    resetLink: v.optional(v.string()),
  }),
  handler: (ctx, args) => createAdminPasswordResetLinkForAdmin(ctx, args),
})

export const generateAdminPasswordResetLink = internalAction({
  args: {
    email: v.string(),
    redirectTo: v.optional(v.string()),
    sendEmail: v.optional(v.boolean()),
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  returns: v.object({
    accepted: v.boolean(),
    email: v.optional(v.string()),
    resetLink: v.optional(v.string()),
    emailStatus: v.union(v.literal('skipped'), v.literal('sent'), v.literal('failed')),
    emailErrorCode: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const created = await ctx.runMutation(createAdminPasswordResetLinkRef, {
      email: args.email,
      redirectTo: args.redirectTo,
      adminSecret: args.adminSecret,
      sessionToken: args.sessionToken,
    })
    if (!created.resetLink || !created.email) {
      return { accepted: true, emailStatus: 'skipped' as const }
    }

    if (!args.sendEmail) {
      return {
        accepted: true,
        email: created.email,
        resetLink: created.resetLink,
        emailStatus: 'skipped' as const,
      }
    }

    const delivery = await sendPasswordResetEmail({
      toEmail: created.email,
      resetLink: created.resetLink,
    })
    if (delivery.ok) {
      return {
        accepted: true,
        email: created.email,
        resetLink: created.resetLink,
        emailStatus: 'sent' as const,
      }
    }
    return {
      accepted: true,
      email: created.email,
      resetLink: created.resetLink,
      emailStatus: 'failed' as const,
      emailErrorCode: delivery.code,
    }
  },
})

export async function changePasswordForSession(
  ctx: MutationCtx,
  args: { sessionToken: string; currentPassword: string; newPassword: string },
): Promise<{ sessionToken: string; expiresAt: number }> {
  assertPasswordPolicy(args.newPassword)
  const user = await requireSessionUser(ctx, args.sessionToken)
  await consumeRateLimit(ctx, 'changePassword', { kind: 'userId', value: user.userId })
  const credential = await getPasswordCredential(ctx, user.userId)
  if (!credential) {
    throw new Error('AUTH_PASSWORD_RESET_REQUIRED')
  }
  const currentOk = await verifyPassword(args.currentPassword, credential.passwordHash)
  if (!currentOk) {
    throw new Error('AUTH_INVALID_CREDENTIALS')
  }
  const now = Date.now()
  const passwordHash = await hashPassword(args.newPassword)
  await ctx.db.patch(credential._id, { passwordHash, updatedAt: now })
  await revokeAllUserSessions(ctx, user.userId)
  return createSession(ctx, user.userId)
}

export const changePassword = mutation({
  args: {
    sessionToken: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    sessionToken: v.string(),
    expiresAt: v.number(),
  }),
  handler: (ctx, args) => changePasswordForSession(ctx, args),
})

/**
 * Continuation planifiée — purge les lignes nutrition restantes pour userId.
 * Peut s'exécuter après suppression de auth_users (pas d'orphelins durables).
 */
export const continuePurgeNutritionUserData = internalMutation({
  args: { userId: v.string() },
  returns: v.object({ done: v.boolean(), deleted: v.number() }),
  handler: async (ctx, args) => {
    const deletedDocIds = new Set<string>()
    const result = await purgeNutritionUserDataBatch(ctx, args.userId, deletedDocIds)
    if (result.remaining && hasScheduler(ctx)) {
      await ctx.scheduler.runAfter(0, continuePurgeNutritionUserDataRef, {
        userId: args.userId,
      })
      return { done: false, deleted: result.deleted }
    }
    if (result.remaining) {
      let guard = 0
      let deleted = result.deleted
      while (guard < 10_000) {
        const next = await purgeNutritionUserDataBatch(ctx, args.userId, deletedDocIds)
        deleted += next.deleted
        if (!next.remaining) return { done: true, deleted }
        guard += 1
      }
      return { done: false, deleted }
    }
    return { done: true, deleted: result.deleted }
  },
})

export const deleteOwnAccount = mutation({
  args: {
    sessionToken: v.string(),
    password: v.string(),
  },
  returns: v.object({
    deleted: v.boolean(),
    deletedAt: v.number(),
  }),
  handler: (ctx, args) => deleteAccountAndUserData(ctx, args),
})

export async function importUsersWithoutPasswordsForAdmin(
  ctx: MutationCtx,
  args: {
    users: ImportedUserInput[]
    adminSecret?: string
    sessionToken?: string
  },
): Promise<{ imported: number; updated: number; skippedDeleted: number }> {
  await requireAdminCaller(ctx, args)
  let imported = 0
  let updated = 0
  let skippedDeleted = 0
  const now = Date.now()
  for (const rawUser of args.users) {
    const outcome = await upsertImportedUserWithoutPassword(ctx, rawUser, now)
    if (outcome === 'imported') imported += 1
    if (outcome === 'updated') updated += 1
    if (outcome === 'skippedDeleted') skippedDeleted += 1
  }
  return { imported, updated, skippedDeleted }
}

export async function queueGlobalPasswordResetCampaignForAdmin(
  ctx: MutationCtx,
  args: {
    limit?: number
    redirectTo?: string
    adminSecret?: string
    sessionToken?: string
  },
): Promise<{ queued: number }> {
  const caller = await requireAdminCaller(ctx, args)
  await consumeRateLimit(ctx, 'adminResetCampaign', {
    kind: caller.userId ? 'userId' : 'admin',
    value: caller.userId || caller.via,
  })
  const limit = Math.max(1, Math.min(args.limit ?? 500, 5_000))
  const users = await ctx.db
    .query('auth_users')
    .withIndex('by_mustResetPassword', (q) => q.eq('mustResetPassword', true))
    .take(limit)
  let queued = 0
  for (const user of users) {
    if (user.deletedAt) continue
    await issuePasswordResetToken(ctx, user.userId, user.email, user.emailNorm, args.redirectTo)
    queued += 1
  }
  return { queued }
}

export async function getPasswordResetOutboxPreviewForAdmin(
  ctx: QueryCtx,
  args: {
    limit?: number
    adminSecret?: string
    sessionToken?: string
  },
) {
  await requireAdminCaller(ctx, args)
  const limit = Math.max(1, Math.min(args.limit ?? 50, 500))
  const rows = await ctx.db
    .query('auth_password_reset_outbox')
    .withIndex('by_createdAt')
    .order('desc')
    .take(limit)
  return rows.map((row) => ({
    email: row.email,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    sentAt: row.sentAt,
    lastAttemptAt: row.lastAttemptAt,
    attemptCount: row.attemptCount,
    status: row.status,
    lastError: row.lastError,
  }))
}

export const importUsersWithoutPasswords = internalMutation({
  args: {
    users: v.array(
      v.object({
        email: v.string(),
        displayName: v.optional(v.string()),
      }),
    ),
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  returns: v.object({
    imported: v.number(),
    updated: v.number(),
    skippedDeleted: v.number(),
  }),
  handler: (ctx, args) => importUsersWithoutPasswordsForAdmin(ctx, args),
})

export const queueGlobalPasswordResetCampaign = internalMutation({
  args: {
    limit: v.optional(v.number()),
    redirectTo: v.optional(v.string()),
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  returns: v.object({
    queued: v.number(),
  }),
  handler: (ctx, args) => queueGlobalPasswordResetCampaignForAdmin(ctx, args),
})

export const getPasswordResetOutboxPreview = internalQuery({
  args: {
    limit: v.optional(v.number()),
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      email: v.string(),
      createdAt: v.number(),
      expiresAt: v.optional(v.number()),
      sentAt: v.optional(v.number()),
      lastAttemptAt: v.optional(v.number()),
      attemptCount: v.number(),
      status: v.optional(outboxStatusValidator),
      lastError: v.optional(v.string()),
    }),
  ),
  handler: (ctx, args) => getPasswordResetOutboxPreviewForAdmin(ctx, args),
})
