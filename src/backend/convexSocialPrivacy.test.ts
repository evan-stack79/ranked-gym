import { describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import { getOwnedFileView } from '../../convex/files'
import { getSocialActivityFeed, recordActivityForSession } from '../../convex/rpc'
import {
  acceptFollowForSession,
  addCommentForSession,
  blockUserForSession,
  countReactionsForSession,
  countVisibleActivitiesForSession,
  deleteCommentForSession,
  deleteOwnActivityForSession,
  followUserForSession,
  getVisibleActivityForSession,
  getVisibleProfileForSession,
  listBlockedUsersForSession,
  listCommentsForSession,
  listFollowRequestsForSession,
  listVisibleActivitiesForSession,
  searchProfilesForSession,
  setAccountPrivacyForSession,
  toggleReactionForSession,
} from '../../convex/social'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'profiles'
  | 'activities'
  | 'user_blocks'
  | 'user_follows'
  | 'activity_comments'
  | 'activity_reactions'
  | 'user_files'
  | 'rate_limit_buckets'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    profiles: [],
    activities: [],
    user_blocks: [],
    user_follows: [],
    activity_comments: [],
    activity_reactions: [],
    user_files: [],
    rate_limit_buckets: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  get(id: string) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }

  patch(id: string, patch: Record<string, unknown>) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (!row) continue
      Object.assign(row, patch)
      return Promise.resolve()
    }
    throw new Error(`Row not found: ${id}`)
  }

  delete(id: string) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key].splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  table(name: TableName): StoredRow[] {
    return this.rows[name]
  }
}

class FakeQuery {
  private filtered: StoredRow[]

  constructor(rows: StoredRow[]) {
    this.filtered = [...rows]
  }

  withIndex(
    _indexName: string,
    fn?: (q: {
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => unknown
      }
    }) => unknown,
  ) {
    if (!fn) return this
    const clauses: Array<{ field: string; value: unknown }> = []
    const chain = {
      eq(field: string, value: unknown) {
        clauses.push({ field, value })
        return chain
      },
    }
    fn(chain)
    this.filtered = this.filtered.filter((row) =>
      clauses.every((clause) => row[clause.field] === clause.value),
    )
    return this
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
}

class FakeStorage {
  readonly signedUrlCalls: string[] = []

  getUrl(storageId: string) {
    this.signedUrlCalls.push(storageId)
    return Promise.resolve(`https://signed.example/${storageId}`)
  }
}

function createCtx(db: FakeDb, storage?: FakeStorage): { db: FakeDb; storage?: FakeStorage } {
  return storage ? { db, storage } : { db }
}

async function seedUser(
  db: FakeDb,
  userId: string,
  sessionToken: string,
  opts: { ghost?: boolean; isPrivate?: boolean; pseudo?: string } = {},
) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId,
    email: `${userId}@example.com`,
    emailNorm: `${userId}@example.com`,
    displayName: userId,
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + 120_000,
  })
  await db.insert('profiles', {
    userId,
    pseudo: opts.pseudo ?? (userId === 'user-a' ? 'Alpha' : 'Bravo'),
    level: 1,
    xp: 0,
    rank: 'Bronze',
    discipline: 'Musculation',
    isGhostModeEnabled: Boolean(opts.ghost),
    isPrivate: Boolean(opts.isPrivate),
    createdAt: now,
    updatedAt: now,
  })
}

describe('Convex social privacy (Mission 4)', () => {
  it('hides private accounts from search, profile, counters, and list-by-id until follow is accepted', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b', { isPrivate: true, pseudo: 'BravoPrivate' })

    const activityB = await recordActivityForSession(ctx as never, 'session-b', {
      activityType: 'workout',
      actionText: 'a termine une seance privee',
      xpEarned: 40,
    })

    expect(await searchProfilesForSession(ctx as never, 'session-a', 'Bravo')).toEqual([])
    expect(await getVisibleProfileForSession(ctx as never, 'session-a', 'user-b')).toBeNull()
    expect(await listVisibleActivitiesForSession(ctx as never, 'session-a', 'user-b')).toEqual([])
    expect(await countVisibleActivitiesForSession(ctx as never, 'session-a', 'user-b')).toBe(0)
    expect(await getVisibleActivityForSession(ctx as never, 'session-a', activityB)).toBeNull()
    expect(await countReactionsForSession(ctx as never, 'session-a', activityB)).toBe(0)
    expect(await listCommentsForSession(ctx as never, 'session-a', activityB)).toEqual([])

    const pending = await followUserForSession(ctx as never, 'session-a', 'user-b')
    expect(pending.status).toBe('pending')
    expect(await getVisibleProfileForSession(ctx as never, 'session-a', 'user-b')).toBeNull()
    expect((await listFollowRequestsForSession(ctx as never, 'session-b'))[0]?.followerUserId).toBe(
      'user-a',
    )

    const accepted = await acceptFollowForSession(ctx as never, 'session-b', 'user-a')
    expect(accepted.accepted).toBe(true)
    expect(await getVisibleProfileForSession(ctx as never, 'session-a', 'user-b')).toMatchObject({
      userId: 'user-b',
      pseudo: 'BravoPrivate',
    })
    expect(await searchProfilesForSession(ctx as never, 'session-a', 'Bravo')).toHaveLength(1)
    expect(await countVisibleActivitiesForSession(ctx as never, 'session-a', 'user-b')).toBe(1)
    const listed = await listVisibleActivitiesForSession(ctx as never, 'session-a', 'user-b')
    expect(listed).toHaveLength(1)
    expect(listed[0]?.action_text).toContain('privee')
    expect(listed[0]).not.toHaveProperty('originLat')
  })

  it('enforces reciprocal blocking across search, feed-by-id, comments, reactions, and counters', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')

    const activityB = await recordActivityForSession(ctx as never, 'session-b', {
      activityType: 'pr',
      actionText: 'a battu un PR public',
      xpEarned: 80,
    })
    const activityA = await recordActivityForSession(ctx as never, 'session-a', {
      activityType: 'checkin',
      actionText: 'a check-in a Gym A',
      xpEarned: 20,
    })

    const visibleB = await getVisibleProfileForSession(ctx as never, 'session-a', 'user-b')
    expect(visibleB?.pseudo).toBe('Bravo')
    await addCommentForSession(ctx as never, 'session-a', activityB, 'bravo!')
    await toggleReactionForSession(ctx as never, 'session-a', activityB)
    expect(await countReactionsForSession(ctx as never, 'session-b', activityB)).toBe(1)

    await blockUserForSession(ctx as never, 'session-a', 'user-b')
    await blockUserForSession(ctx as never, 'session-b', 'user-a')

    expect(await searchProfilesForSession(ctx as never, 'session-a', 'Bravo')).toEqual([])
    expect(await searchProfilesForSession(ctx as never, 'session-b', 'Alpha')).toEqual([])
    expect(await getVisibleProfileForSession(ctx as never, 'session-a', 'user-b')).toBeNull()
    expect(await getVisibleProfileForSession(ctx as never, 'session-b', 'user-a')).toBeNull()
    expect(await getVisibleActivityForSession(ctx as never, 'session-a', activityB)).toBeNull()
    expect(await getVisibleActivityForSession(ctx as never, 'session-b', activityA)).toBeNull()
    expect(await listVisibleActivitiesForSession(ctx as never, 'session-a', 'user-b')).toEqual([])
    expect(await countVisibleActivitiesForSession(ctx as never, 'session-b', 'user-a')).toBe(0)
    expect(await listCommentsForSession(ctx as never, 'session-a', activityB)).toEqual([])
    expect(await countReactionsForSession(ctx as never, 'session-a', activityB)).toBe(0)
    expect(await listBlockedUsersForSession(ctx as never, 'session-a').then((rows) => rows[0]?.userId)).toBe(
      'user-b',
    )

    await expect(addCommentForSession(ctx as never, 'session-a', activityB, 'still here')).rejects.toThrow(
      /cross-user access denied/i,
    )
    await expect(toggleReactionForSession(ctx as never, 'session-b', activityA)).rejects.toThrow(
      /cross-user access denied/i,
    )
    const followBlocked = await followUserForSession(ctx as never, 'session-a', 'user-b')
    expect(followBlocked.status).toBe('blocked')
  })

  it('rejects IDOR swaps on activities, comments, files, and ignores client-sent identity', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')

    const activityB = await recordActivityForSession(ctx as never, 'session-b', {
      activityType: 'workout',
      actionText: 'seance B',
      xpEarned: 10,
    })
    const commentB = await addCommentForSession(ctx as never, 'session-b', activityB, 'note B')
    const fileB = await db.insert('user_files', {
      userId: 'user-b',
      kind: 'avatar',
      storageId: 'storage-b-1',
      contentType: 'image/jpeg',
      sizeBytes: 12,
      sha256: 'bbb',
      createdAt: Date.now(),
    })

    await expect(deleteOwnActivityForSession(ctx as never, 'session-a', activityB)).rejects.toThrow(
      /cross-user access denied/i,
    )
    expect(await getVisibleActivityForSession(ctx as never, 'session-a', activityB)).toMatchObject({
      action_text: 'seance B',
    })
    const stillThere = db.table('activities').find((row) => row._id === activityB)
    expect(stillThere?.deletedAt).toBeUndefined()

    await expect(deleteCommentForSession(ctx as never, 'session-a', commentB.id)).rejects.toThrow(
      /cross-user access denied/i,
    )
    expect(await listCommentsForSession(ctx as never, 'session-a', activityB)).toHaveLength(1)

    await expect(getOwnedFileView(ctx as never, 'session-a', fileB as never)).rejects.toThrow(
      /cross-user access denied/i,
    )
    expect(storage.signedUrlCalls).toHaveLength(0)

    await setAccountPrivacyForSession(ctx as never, 'session-b', true)
    expect(await getVisibleActivityForSession(ctx as never, 'session-a', activityB)).toBeNull()
    expect(await deleteOwnActivityForSession(ctx as never, 'session-b', activityB)).toEqual({
      deleted: true,
    })
    expect(await getVisibleActivityForSession(ctx as never, 'session-b', activityB)).toBeNull()
    expect(await countVisibleActivitiesForSession(ctx as never, 'session-b', 'user-b')).toBe(0)
    expect(await listCommentsForSession(ctx as never, 'session-b', activityB)).toEqual([])
  })

  it('keeps Mission 3 owner-scoped social feed and skips soft-deleted activities', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedUser(db, 'user-b', 'session-b')

    await recordActivityForSession(ctx as never, 'session-b', {
      activityType: 'checkin',
      actionText: 'secret B',
      xpEarned: 90,
      originLat: 48.86,
      originLng: 2.35,
    })
    const ownId = await recordActivityForSession(ctx as never, 'session-a', {
      activityType: 'streak',
      actionText: 'serie A',
      xpEarned: 5,
    })

    const feedA = await getSocialActivityFeed(ctx as never, {
      sessionToken: 'session-a',
      limit: 10,
    })
    expect(feedA).toHaveLength(1)
    expect(feedA[0]?.user_id).toBe('user-a')
    expect(feedA[0]?.action_text).toBe('serie A')
    expect(JSON.stringify(feedA)).not.toContain('secret B')
    expect(JSON.stringify(feedA)).not.toContain('48.86')

    await deleteOwnActivityForSession(ctx as never, 'session-a', ownId)
    const feedAfterDelete = await getSocialActivityFeed(ctx as never, {
      sessionToken: 'session-a',
      limit: 10,
    })
    expect(feedAfterDelete).toHaveLength(0)
  })
})
