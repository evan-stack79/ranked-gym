import { v } from 'convex/values'
import { mutation, query, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server'
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

const RESET_ROUTE_PATH = '/auth/reset-password'

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

export async function issuePasswordResetToken(
  ctx: MutationCtx,
  userId: string,
  email: string,
  emailNorm: string,
  redirectTo?: string,
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
  await ctx.db.insert('auth_password_reset_outbox', {
    userId,
    email,
    emailNorm,
    tokenHash,
    resetLink: createResetLink(redirectTo || getResetRedirectBaseUrl(), rawToken),
    createdAt: now,
    attemptCount: 0,
  })
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
  await deleteRows(
    ctx,
    await ctx.db
      .query('activities')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', user.userId))
      .collect(),
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
  handler: async (ctx, args) => {
    const emailNorm = normalizeEmail(args.email)
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
  },
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

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
    redirectTo: v.optional(v.string()),
  },
  returns: v.object({
    accepted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const emailNorm = normalizeEmail(args.email)
    const user = await findUserByEmailNorm(ctx, emailNorm)
    if (user && !user.deletedAt) {
      await issuePasswordResetToken(ctx, user.userId, user.email, user.emailNorm, args.redirectTo)
    }
    return { accepted: true }
  },
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
  handler: async (ctx, args) => {
    assertPasswordPolicy(args.newPassword)
    const user = await requireSessionUser(ctx, args.sessionToken)
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
  await requireAdminCaller(ctx, args)
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
    sentAt: row.sentAt,
    attemptCount: row.attemptCount,
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
      sentAt: v.optional(v.number()),
      attemptCount: v.number(),
      lastError: v.optional(v.string()),
    }),
  ),
  handler: (ctx, args) => getPasswordResetOutboxPreviewForAdmin(ctx, args),
})
