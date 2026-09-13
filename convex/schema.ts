import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Ranked Gym Convex schema (Phase A — compatibility-first).
 *
 * Maps plan domains:
 * - Profil: profiles, checkins, custom_spots, active_checkins
 * - Train: workouts_state
 * - Nutrition + Hydratation: nutrition_state (journalJson nests waterEntries)
 * - Sommeil: sleep_nights (currently local-only in the app)
 * - Streak: streak_state
 * - Files: user_files
 * - Migration bookkeeping: migration_runs, migration_entity_map, legacy_supabase_backups
 *
 * Convex indexes are not unique. Uniqueness listed below is a mutation invariant
 * to enforce when write functions land (later phase).
 *
 * Timestamps are unix milliseconds.
 */
export const convexTables = {
  profiles: defineTable({
    userId: v.string(),
    pseudo: v.string(),
    level: v.number(),
    xp: v.number(),
    rank: v.string(),
    discipline: v.string(),
    avatarFileId: v.optional(v.id('user_files')),
    isGhostModeEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_updatedAt', ['updatedAt']),

  workouts_state: defineTable({
    userId: v.string(),
    stateJson: v.any(),
    progressJson: v.any(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_updatedAt', ['updatedAt']),

  nutrition_state: defineTable({
    userId: v.string(),
    profileJson: v.any(),
    journalJson: v.any(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_updatedAt', ['updatedAt']),

  sleep_nights: defineTable({
    userId: v.string(),
    dateKey: v.string(),
    bedtime: v.string(),
    waketime: v.string(),
    tstHours: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId_dateKey', ['userId', 'dateKey'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),

  checkins: defineTable({
    userId: v.string(),
    salleNom: v.string(),
    salleLat: v.optional(v.union(v.number(), v.null())),
    salleLng: v.optional(v.union(v.number(), v.null())),
    gymPayload: v.optional(v.any()),
    createdAt: v.number(),
  }).index('by_userId_createdAt', ['userId', 'createdAt']),

  custom_spots: defineTable({
    userId: v.string(),
    spotId: v.string(),
    name: v.string(),
    lat: v.number(),
    lng: v.number(),
    address: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId_spotId', ['userId', 'spotId'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt']),

  active_checkins: defineTable({
    userId: v.string(),
    checkinJson: v.any(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  aliments: defineTable({
    userId: v.string(),
    nom: v.string(),
    calories: v.number(),
    proteines: v.number(),
    glucides: v.number(),
    lipides: v.number(),
    barcode: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_userId_createdAt', ['userId', 'createdAt'])
    .index('by_barcode', ['barcode']),

  activities: defineTable({
    userId: v.string(),
    activityType: v.string(),
    actionText: v.string(),
    xpEarned: v.number(),
    originLat: v.optional(v.union(v.number(), v.null())),
    originLng: v.optional(v.union(v.number(), v.null())),
    createdAt: v.number(),
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_userId_createdAt', ['userId', 'createdAt']),

  ai_usage_limits: defineTable({
    userId: v.string(),
    dateOfScan: v.string(),
    scanCount: v.number(),
    updatedAt: v.number(),
  }).index('by_userId_dateOfScan', ['userId', 'dateOfScan']),

  streak_state: defineTable({
    userId: v.string(),
    currentStreak: v.number(),
    lastLoginDate: v.optional(v.union(v.string(), v.null())),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  user_files: defineTable({
    userId: v.string(),
    kind: v.literal('avatar'),
    storageId: v.id('_storage'),
    contentType: v.string(),
    sizeBytes: v.number(),
    sha256: v.string(),
    createdAt: v.number(),
    replacedAt: v.optional(v.number()),
  })
    .index('by_userId_kind', ['userId', 'kind'])
    .index('by_storageId', ['storageId']),

  migration_runs: defineTable({
    runId: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.union(
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('aborted'),
    ),
    sourceSha: v.string(),
    summaryJson: v.any(),
  })
    .index('by_runId', ['runId'])
    .index('by_startedAt', ['startedAt']),

  migration_entity_map: defineTable({
    runId: v.string(),
    entityType: v.string(),
    supabaseId: v.string(),
    convexId: v.string(),
    checksum: v.string(),
    importedAt: v.number(),
  })
    .index('by_entity_supabaseId', ['entityType', 'supabaseId'])
    .index('by_runId_entityType', ['runId', 'entityType']),

  legacy_supabase_backups: defineTable({
    userId: v.string(),
    payloadJson: v.any(),
    updatedAt: v.number(),
    source: v.literal('supabase_user_backups'),
  }).index('by_userId', ['userId']),
}

export default defineSchema(convexTables)
