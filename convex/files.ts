import { v } from 'convex/values'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertUserOwnership, requireSessionUser } from './lib/auth'
import { requireAdminCaller, requireAuthorizedMigrationRun } from './lib/migrationAdmin'
import { consumeRateLimit } from './lib/rateLimit'

const DEFAULT_CONTENT_TYPE = 'image/jpeg'

export type UserFileView = {
  fileId: Id<'user_files'>
  userId: string
  kind: 'avatar'
  storageId: Id<'_storage'>
  contentType: string
  sizeBytes: number
  sha256: string
  legacySupabasePath?: string
  createdAt: number
  replacedAt?: number
  url: string | null
}

const fileViewValidator = v.object({
  fileId: v.id('user_files'),
  userId: v.string(),
  kind: v.literal('avatar'),
  storageId: v.id('_storage'),
  contentType: v.string(),
  sizeBytes: v.number(),
  sha256: v.string(),
  legacySupabasePath: v.optional(v.string()),
  createdAt: v.number(),
  replacedAt: v.optional(v.number()),
  url: v.union(v.string(), v.null()),
})

const importedAvatarValidator = v.object({
  fileId: v.id('user_files'),
  userId: v.string(),
  storageId: v.id('_storage'),
  legacySupabasePath: v.string(),
  replacedAt: v.optional(v.number()),
})

const deleteAvatarResultValidator = v.object({
  deleted: v.boolean(),
  fileId: v.optional(v.id('user_files')),
})

async function findActiveAvatar(ctx: QueryCtx | MutationCtx, userId: string) {
  const rows = await ctx.db
    .query('user_files')
    .withIndex('by_userId_kind', (q) => q.eq('userId', userId).eq('kind', 'avatar'))
    .collect()
  return (
    rows
      .filter((row) => !row.replacedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .at(0) ?? null
  )
}

async function toOwnedFileView(
  ctx: QueryCtx | MutationCtx,
  file: {
    _id: Id<'user_files'>
    userId: string
    kind: 'avatar'
    storageId: Id<'_storage'>
    contentType: string
    sizeBytes: number
    sha256: string
    legacySupabasePath?: string
    createdAt: number
    replacedAt?: number
  },
): Promise<UserFileView> {
  const url = await ctx.storage.getUrl(file.storageId)
  return {
    fileId: file._id,
    userId: file.userId,
    kind: file.kind,
    storageId: file.storageId,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    legacySupabasePath: file.legacySupabasePath,
    createdAt: file.createdAt,
    replacedAt: file.replacedAt,
    url,
  }
}

async function clearOrReplaceActiveAvatar(
  ctx: MutationCtx,
  userId: string,
  nextFileId: Id<'user_files'> | null,
  now: number,
): Promise<void> {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  if (!profile) return
  assertUserOwnership(profile.userId, userId)
  if (nextFileId) {
    await ctx.db.patch(profile._id, { avatarFileId: nextFileId, updatedAt: now })
    return
  }
  if (profile.avatarFileId) {
    await ctx.db.patch(profile._id, { avatarFileId: undefined, updatedAt: now })
  }
}

async function ensureAuthorizedMigrationRun(
  ctx: MutationCtx | QueryCtx,
  args: { runId: string; sourceSha: string; runSecret: string },
) {
  await requireAuthorizedMigrationRun(ctx, args)
}

export async function assertOwnedUserFile(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
  fileId: Id<'user_files'>,
) {
  const user = await requireSessionUser(ctx, sessionToken)
  const file = await ctx.db.get(fileId)
  if (!file) return null
  assertUserOwnership(file.userId, user.userId)
  return { user, file }
}

export async function commitAvatarUploadForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: {
    storageId: Id<'_storage'>
    contentType: string
    sizeBytes: number
    sha256: string
  },
): Promise<UserFileView> {
  const user = await requireSessionUser(ctx, sessionToken)
  await consumeRateLimit(ctx, 'avatarCommit', { kind: 'userId', value: user.userId })
  const now = Date.now()
  const previous = await findActiveAvatar(ctx, user.userId)
  if (previous) {
    assertUserOwnership(previous.userId, user.userId)
    await ctx.storage.delete(previous.storageId)
    await ctx.db.patch(previous._id, { replacedAt: now })
  }

  const fileId = await ctx.db.insert('user_files', {
    userId: user.userId,
    kind: 'avatar',
    storageId: input.storageId,
    contentType: input.contentType || DEFAULT_CONTENT_TYPE,
    sizeBytes: Math.max(0, input.sizeBytes),
    sha256: input.sha256,
    createdAt: now,
  })

  await clearOrReplaceActiveAvatar(ctx, user.userId, fileId, now)
  const inserted = await ctx.db.get(fileId)
  if (!inserted) throw new Error('AVATAR_INSERT_FAILED')
  return toOwnedFileView(ctx, inserted)
}

export async function getOwnedFileView(
  ctx: QueryCtx,
  sessionToken: string,
  fileId: Id<'user_files'>,
): Promise<UserFileView | null> {
  const owned = await assertOwnedUserFile(ctx, sessionToken, fileId)
  if (!owned) return null
  return toOwnedFileView(ctx, owned.file)
}

export async function deleteOwnAvatarForSession(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<{ deleted: boolean; fileId?: Id<'user_files'> }> {
  const user = await requireSessionUser(ctx, sessionToken)
  const active = await findActiveAvatar(ctx, user.userId)
  if (!active) return { deleted: false }
  assertUserOwnership(active.userId, user.userId)
  await ctx.storage.delete(active.storageId)
  const now = Date.now()
  await ctx.db.patch(active._id, { replacedAt: now })
  await clearOrReplaceActiveAvatar(ctx, user.userId, null, now)
  return { deleted: true, fileId: active._id }
}

export async function importSupabaseAvatarForUser(
  ctx: MutationCtx,
  input: {
    runId: string
    sourceSha: string
    runSecret: string
    userId: string
    legacySupabasePath: string
    storageId: Id<'_storage'>
    contentType: string
    sizeBytes: number
    sha256: string
    createdAt?: number
    adminSecret?: string
    sessionToken?: string
  },
): Promise<{
  fileId: Id<'user_files'>
  userId: string
  storageId: Id<'_storage'>
  legacySupabasePath: string
  replacedAt?: number
}> {
  await requireAdminCaller(ctx, input)
  await ensureAuthorizedMigrationRun(ctx, {
    runId: input.runId,
    sourceSha: input.sourceSha,
    runSecret: input.runSecret,
  })
  const userId = input.userId.trim()
  const legacySupabasePath = input.legacySupabasePath.trim()
  if (!userId) throw new Error('MIGRATION_AVATAR_USER_ID_REQUIRED')
  if (!legacySupabasePath) throw new Error('MIGRATION_AVATAR_PATH_REQUIRED')

  const now = Date.now()
  const existingByPath = await ctx.db
    .query('user_files')
    .withIndex('by_legacySupabasePath', (q) => q.eq('legacySupabasePath', legacySupabasePath))
    .first()
  if (existingByPath) {
    assertUserOwnership(existingByPath.userId, userId)
  }

  const active = await findActiveAvatar(ctx, userId)
  if (active && (!existingByPath || existingByPath._id !== active._id)) {
    assertUserOwnership(active.userId, userId)
    await ctx.db.patch(active._id, { replacedAt: now })
  }

  let fileId: Id<'user_files'>
  if (existingByPath) {
    if (existingByPath.storageId !== input.storageId) {
      await ctx.storage.delete(existingByPath.storageId)
    }
    await ctx.db.patch(existingByPath._id, {
      storageId: input.storageId,
      contentType: input.contentType || DEFAULT_CONTENT_TYPE,
      sizeBytes: Math.max(0, input.sizeBytes),
      sha256: input.sha256,
      createdAt: input.createdAt ?? existingByPath.createdAt,
      replacedAt: undefined,
    })
    fileId = existingByPath._id
  } else {
    fileId = await ctx.db.insert('user_files', {
      userId,
      kind: 'avatar',
      storageId: input.storageId,
      contentType: input.contentType || DEFAULT_CONTENT_TYPE,
      sizeBytes: Math.max(0, input.sizeBytes),
      sha256: input.sha256,
      legacySupabasePath,
      createdAt: input.createdAt ?? now,
    })
  }

  await clearOrReplaceActiveAvatar(ctx, userId, fileId, now)
  const file = await ctx.db.get(fileId)
  if (!file) throw new Error('MIGRATION_AVATAR_INSERT_FAILED')
  return {
    fileId,
    userId: file.userId,
    storageId: file.storageId,
    legacySupabasePath: file.legacySupabasePath ?? legacySupabasePath,
    replacedAt: file.replacedAt,
  }
}

export async function generateMigrationAvatarUploadUrlForRun(
  ctx: MutationCtx,
  args: {
    runId: string
    sourceSha: string
    runSecret: string
    adminSecret?: string
    sessionToken?: string
  },
): Promise<{ uploadUrl: string }> {
  await requireAdminCaller(ctx, args)
  await ensureAuthorizedMigrationRun(ctx, {
    runId: args.runId,
    sourceSha: args.sourceSha,
    runSecret: args.runSecret,
  })
  const uploadUrl = await ctx.storage.generateUploadUrl()
  return { uploadUrl }
}

export async function generateAvatarUploadUrlForSession(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<{ uploadUrl: string }> {
  const user = await requireSessionUser(ctx, sessionToken)
  await consumeRateLimit(ctx, 'avatarUploadUrl', { kind: 'userId', value: user.userId })
  const uploadUrl = await ctx.storage.generateUploadUrl()
  return { uploadUrl }
}

export const generateAvatarUploadUrl = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: (ctx, args) => generateAvatarUploadUrlForSession(ctx, args.sessionToken),
})

export const generateMigrationAvatarUploadUrl = internalMutation({
  args: {
    runId: v.string(),
    sourceSha: v.string(),
    runSecret: v.string(),
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: (ctx, args) => generateMigrationAvatarUploadUrlForRun(ctx, args),
})

export const commitAvatarUpload = mutation({
  args: {
    sessionToken: v.string(),
    storageId: v.id('_storage'),
    contentType: v.string(),
    sizeBytes: v.number(),
    sha256: v.string(),
  },
  returns: fileViewValidator,
  handler: (ctx, args) =>
    commitAvatarUploadForSession(ctx, args.sessionToken, {
      storageId: args.storageId,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      sha256: args.sha256,
    }),
})

export const importSupabaseAvatar = internalMutation({
  args: {
    runId: v.string(),
    sourceSha: v.string(),
    runSecret: v.string(),
    userId: v.string(),
    legacySupabasePath: v.string(),
    storageId: v.id('_storage'),
    contentType: v.string(),
    sizeBytes: v.number(),
    sha256: v.string(),
    createdAt: v.optional(v.number()),
    adminSecret: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  returns: importedAvatarValidator,
  handler: (ctx, args) =>
    importSupabaseAvatarForUser(ctx, {
      runId: args.runId,
      sourceSha: args.sourceSha,
      runSecret: args.runSecret,
      userId: args.userId,
      legacySupabasePath: args.legacySupabasePath,
      storageId: args.storageId,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      sha256: args.sha256,
      createdAt: args.createdAt,
      adminSecret: args.adminSecret,
      sessionToken: args.sessionToken,
    }),
})

export const getOwnedFile = query({
  args: {
    sessionToken: v.string(),
    fileId: v.id('user_files'),
  },
  returns: v.union(fileViewValidator, v.null()),
  handler: (ctx, args) => getOwnedFileView(ctx, args.sessionToken, args.fileId),
})

export const getOwnAvatar = query({
  args: { sessionToken: v.string() },
  returns: v.union(fileViewValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const file = await findActiveAvatar(ctx, user.userId)
    if (!file) return null
    assertUserOwnership(file.userId, user.userId)
    return toOwnedFileView(ctx, file)
  },
})

export const deleteOwnAvatar = mutation({
  args: { sessionToken: v.string() },
  returns: deleteAvatarResultValidator,
  handler: (ctx, args) => deleteOwnAvatarForSession(ctx, args.sessionToken),
})
