import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertUserOwnership, requireSessionUser } from './lib/auth'

type NoteShape = {
  noteId: Id<'auth_private_notes'>
  userId: string
  content: string
  createdAt: number
  updatedAt: number
}

export async function createPrivateNoteForSession(
  ctx: MutationCtx,
  sessionToken: string,
  content: string,
): Promise<{ noteId: Id<'auth_private_notes'>; userId: string }> {
  const user = await requireSessionUser(ctx, sessionToken)
  const now = Date.now()
  const noteId = await ctx.db.insert('auth_private_notes', {
    userId: user.userId,
    content: content.slice(0, 2000),
    createdAt: now,
    updatedAt: now,
  })
  return { noteId, userId: user.userId }
}

export async function listPrivateNotesForSession(
  ctx: QueryCtx,
  sessionToken: string,
): Promise<NoteShape[]> {
  const user = await requireSessionUser(ctx, sessionToken)
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
}

export async function getPrivateNoteForSession(
  ctx: QueryCtx,
  sessionToken: string,
  noteId: Id<'auth_private_notes'>,
): Promise<NoteShape | null> {
  const user = await requireSessionUser(ctx, sessionToken)
  const note = await ctx.db.get(noteId)
  if (!note) return null
  assertUserOwnership(note.userId, user.userId)
  return {
    noteId: note._id,
    userId: note.userId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

export const createPrivateNote = mutation({
  args: {
    sessionToken: v.string(),
    content: v.string(),
  },
  returns: v.object({
    noteId: v.id('auth_private_notes'),
    userId: v.string(),
  }),
  handler: (ctx, args) => createPrivateNoteForSession(ctx, args.sessionToken, args.content),
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
  handler: (ctx, args) => listPrivateNotesForSession(ctx, args.sessionToken),
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
  handler: (ctx, args) => getPrivateNoteForSession(ctx, args.sessionToken, args.noteId),
})
