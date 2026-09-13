import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertUserOwnership, requireSessionUser } from './lib/auth'

export const createPrivateNote = mutation({
  args: {
    sessionToken: v.string(),
    content: v.string(),
  },
  returns: v.object({
    noteId: v.id('auth_private_notes'),
    userId: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const now = Date.now()
    const noteId = await ctx.db.insert('auth_private_notes', {
      userId: user.userId,
      content: args.content.slice(0, 2000),
      createdAt: now,
      updatedAt: now,
    })
    return { noteId, userId: user.userId }
  },
})

export const listPrivateNotes = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.array(
    v.object({
      noteId: v.id('auth_private_notes'),
      userId: v.string(),
      content: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const notes = await ctx.db
      .query('auth_private_notes')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', user.userId))
      .collect()
    return notes.map((note) => ({
      noteId: note._id,
      userId: note.userId,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }))
  },
})

export const getPrivateNote = query({
  args: {
    sessionToken: v.string(),
    noteId: v.id('auth_private_notes'),
  },
  returns: v.union(
    v.object({
      noteId: v.id('auth_private_notes'),
      userId: v.string(),
      content: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const note = await ctx.db.get(args.noteId)
    if (!note) return null
    assertUserOwnership(note.userId, user.userId)
    return {
      noteId: note._id,
      userId: note.userId,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
  },
})
