/**
 * Purge des archives minimales post-suppression de compte (Juriste).
 * Code only — no `npx convex deploy` from agents.
 */

import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { internalMutation, type MutationCtx } from './_generated/server'

export const ACCOUNT_DELETE_ARCHIVE_TABLES = [
  'account_delete_subscription_archive',
  'account_delete_rewards_redemption_archive',
  'account_delete_age_majority_archive',
  'account_delete_google_takeover_archive',
] as const

export type AccountDeleteArchiveTable = (typeof ACCOUNT_DELETE_ARCHIVE_TABLES)[number]

/** Max deletes per table per cron tick (idempotent batches). */
export const ACCOUNT_DELETE_ARCHIVE_PURGE_BATCH = 100

export type PurgeExpiredArchivesResult = {
  deleted: number
  scanned: number
  hasMore: boolean
  byTable: Record<AccountDeleteArchiveTable, number>
}

/**
 * Supprime les lignes d'archive dont retainUntil <= now, par lots.
 * Idempotente : un 2e passage sur les mêmes ids ne trouve plus rien.
 */
export async function purgeExpiredAccountDeleteArchivesBatch(
  ctx: Pick<MutationCtx, 'db'>,
  now: number = Date.now(),
  batchSize: number = ACCOUNT_DELETE_ARCHIVE_PURGE_BATCH,
): Promise<PurgeExpiredArchivesResult> {
  const byTable = {
    account_delete_subscription_archive: 0,
    account_delete_rewards_redemption_archive: 0,
    account_delete_age_majority_archive: 0,
    account_delete_google_takeover_archive: 0,
  } satisfies Record<AccountDeleteArchiveTable, number>
  let deleted = 0
  let scanned = 0
  let hasMore = false

  for (const table of ACCOUNT_DELETE_ARCHIVE_TABLES) {
    const rows = await ctx.db
      .query(table)
      .withIndex('by_retainUntil', (q) => q.lte('retainUntil', now))
      .take(batchSize + 1)
    scanned += rows.length
    if (rows.length > batchSize) hasMore = true
    const toDelete = rows.slice(0, batchSize)
    for (const row of toDelete) {
      await ctx.db.delete(row._id)
      deleted += 1
      byTable[table] += 1
    }
  }

  return { deleted, scanned, hasMore, byTable }
}

const continuePurgeRef = makeFunctionReference<
  'mutation',
  { now?: number; limit?: number },
  PurgeExpiredArchivesResult
>('accountDeleteArchives:purgeExpiredAccountDeleteArchives')

/**
 * Cron entry — purge retainUntil échues, puis se ré-enchaîne s'il reste des lots.
 */
export const purgeExpiredAccountDeleteArchives = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const limit = Math.max(
      1,
      Math.min(args.limit ?? ACCOUNT_DELETE_ARCHIVE_PURGE_BATCH, 500),
    )
    const result = await purgeExpiredAccountDeleteArchivesBatch(ctx, now, limit)
    if (result.hasMore) {
      await ctx.scheduler.runAfter(0, continuePurgeRef, { now, limit })
    }
    return result
  },
})
