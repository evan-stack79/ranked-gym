import { v } from 'convex/values'
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server'

/**
 * Internal-only helpers to inventory and clear legacy Lobby gym location rows.
 * Do NOT expose as public API. Team lead runs via `npx convex run` after GO.
 *
 * Tables kept in schema (not dropped): checkins, custom_spots, active_checkins.
 */

const DEFAULT_BATCH_SIZE = 100

function hasCheckinCoords(row: {
  salleLat?: number | null
  salleLng?: number | null
  gymPayload?: unknown
}): boolean {
  if (row.salleLat != null) return true
  if (row.salleLng != null) return true
  if (row.gymPayload != null) return true
  return false
}

export async function countLegacyLocationRows(ctx: QueryCtx | MutationCtx): Promise<{
  checkinsWithCoords: number
  checkinsTotal: number
  customSpots: number
  activeCheckins: number
}> {
  const [checkins, customSpots, activeCheckins] = await Promise.all([
    ctx.db.query('checkins').collect(),
    ctx.db.query('custom_spots').collect(),
    ctx.db.query('active_checkins').collect(),
  ])

  let checkinsWithCoords = 0
  for (const row of checkins) {
    if (hasCheckinCoords(row)) checkinsWithCoords += 1
  }

  return {
    checkinsWithCoords,
    checkinsTotal: checkins.length,
    customSpots: customSpots.length,
    activeCheckins: activeCheckins.length,
  }
}

export async function purgeLegacyLocationRows(
  ctx: MutationCtx,
  options?: { dryRun?: boolean; batchSize?: number },
): Promise<{
  dryRun: boolean
  deletedCustomSpots: number
  deletedActiveCheckins: number
  clearedCheckins: number
  remainingCustomSpots: number
  remainingActiveCheckins: number
  remainingCheckinsWithCoords: number
}> {
  const dryRun = options?.dryRun !== false
  const batchSize = Math.max(
    1,
    Math.min(
      500,
      typeof options?.batchSize === 'number' && Number.isFinite(options.batchSize)
        ? Math.floor(options.batchSize)
        : DEFAULT_BATCH_SIZE,
    ),
  )

  const customSpots = await ctx.db.query('custom_spots').take(batchSize)
  const activeCheckins = await ctx.db.query('active_checkins').take(batchSize)
  const checkins = await ctx.db.query('checkins').collect()
  const checkinsWithCoords = checkins.filter(hasCheckinCoords).slice(0, batchSize)

  let deletedCustomSpots = 0
  let deletedActiveCheckins = 0
  let clearedCheckins = 0

  if (!dryRun) {
    for (const row of customSpots) {
      await ctx.db.delete(row._id)
      deletedCustomSpots += 1
    }
    for (const row of activeCheckins) {
      await ctx.db.delete(row._id)
      deletedActiveCheckins += 1
    }
    for (const row of checkinsWithCoords) {
      await ctx.db.patch(row._id, {
        salleLat: null,
        salleLng: null,
        gymPayload: null,
      })
      clearedCheckins += 1
    }
  } else {
    deletedCustomSpots = customSpots.length
    deletedActiveCheckins = activeCheckins.length
    clearedCheckins = checkinsWithCoords.length
  }

  const remaining = await countLegacyLocationRows(ctx)
  // dryRun did not mutate — remaining equals current totals
  if (dryRun) {
    return {
      dryRun: true,
      deletedCustomSpots,
      deletedActiveCheckins,
      clearedCheckins,
      remainingCustomSpots: remaining.customSpots,
      remainingActiveCheckins: remaining.activeCheckins,
      remainingCheckinsWithCoords: remaining.checkinsWithCoords,
    }
  }

  return {
    dryRun: false,
    deletedCustomSpots,
    deletedActiveCheckins,
    clearedCheckins,
    remainingCustomSpots: remaining.customSpots,
    remainingActiveCheckins: remaining.activeCheckins,
    remainingCheckinsWithCoords: remaining.checkinsWithCoords,
  }
}

/** Returns ONLY aggregate counts — never row content. */
export const countRows = internalQuery({
  args: {},
  returns: v.object({
    checkinsWithCoords: v.number(),
    checkinsTotal: v.number(),
    customSpots: v.number(),
    activeCheckins: v.number(),
  }),
  handler: (ctx) => countLegacyLocationRows(ctx),
})

/**
 * Deletes custom_spots + active_checkins rows and nulls checkin coords,
 * in batches. dryRun defaults to true (no writes).
 */
export const purge = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    deletedCustomSpots: v.number(),
    deletedActiveCheckins: v.number(),
    clearedCheckins: v.number(),
    remainingCustomSpots: v.number(),
    remainingActiveCheckins: v.number(),
    remainingCheckinsWithCoords: v.number(),
  }),
  handler: (ctx, args) =>
    purgeLegacyLocationRows(ctx, {
      dryRun: args.dryRun,
      batchSize: args.batchSize,
    }),
})
