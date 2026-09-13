import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertUserOwnership, requireSessionUser } from './lib/auth'

/**
 * Private avatar / user_files scaffolding (PR-F).
 *
 * Full storage cutover (Supabase avatars export, short-lived HTTP URLs,
 * cleanup jobs) remains CODEX-RISK PR-H.
 *
 * Access rule: never return a storage URL until the session user owns the file.
 */

export type UserFileView = {
  fileId: Id<'user_files'>
  userId: string
  kind: 'avatar'
  storageId: Id<'_storage'>
  contentType: string
  sizeBytes: number
  sha256: string
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
  createdAt: v.number(),
  replacedAt: v.optional(v.number()),
  url: v.union(v.string(), v.null()),
})

async function findActiveAvatar(ctx: QueryCtx | MutationCtx, userId: string) {
  const rows = await ctx.db
    .query('user_files')
    .withIndex('by_userId_kind', (q) => q.eq('userId', userId).eq('kind', 'avatar'))
    .collect()
  return rows.find((row) => !row.replacedAt) ?? null
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
  const now = Date.now()
  const previous = await findActiveAvatar(ctx, user.userId)
  if (previous) {
    assertUserOwnership(previous.userId, user.userId)
    await ctx.db.patch(previous._id, { replacedAt: now })
  }

  const fileId = await ctx.db.insert('user_files', {
    userId: user.userId,
    kind: 'avatar',
    storageId: input.storageId,
    contentType: input.contentType || 'image/jpeg',
    sizeBytes: Math.max(0, input.sizeBytes),
    sha256: input.sha256,
    createdAt: now,
  })

  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', user.userId))
    .first()
  if (profile) {
    assertUserOwnership(profile.userId, user.userId)
    await ctx.db.patch(profile._id, { avatarFileId: fileId, updatedAt: now })
  }

  const url = await ctx.storage.getUrl(input.storageId)
  return {
    fileId,
    userId: user.userId,
    kind: 'avatar',
    storageId: input.storageId,
    contentType: input.contentType || 'image/jpeg',
    sizeBytes: Math.max(0, input.sizeBytes),
    sha256: input.sha256,
    createdAt: now,
    url,
  }
}

export async function getOwnedFileView(
  ctx: QueryCtx,
  sessionToken: string,
  fileId: Id<'user_files'>,
): Promise<UserFileView | null> {
  const owned = await assertOwnedUserFile(ctx, sessionToken, fileId)
  if (!owned) return null
  const url = await ctx.storage.getUrl(owned.file.storageId)
  return {
    fileId: owned.file._id,
    userId: owned.file.userId,
    kind: owned.file.kind,
    storageId: owned.file.storageId,
    contentType: owned.file.contentType,
    sizeBytes: owned.file.sizeBytes,
    sha256: owned.file.sha256,
    createdAt: owned.file.createdAt,
    replacedAt: owned.file.replacedAt,
    url,
  }
}

export const generateAvatarUploadUrl = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireSessionUser(ctx, args.sessionToken)
    const uploadUrl = await ctx.storage.generateUploadUrl()
    return { uploadUrl }
  },
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
    const url = await ctx.storage.getUrl(file.storageId)
    return {
      fileId: file._id,
      userId: file.userId,
      kind: file.kind,
      storageId: file.storageId,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      createdAt: file.createdAt,
      replacedAt: file.replacedAt,
      url,
    }
  },
})
