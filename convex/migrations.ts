import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

export const MIGRATION_ENTITY_TYPES = [
  'auth_users',
  'profiles',
  'workouts',
  'nutrition',
  'checkins',
  'aliments',
  'activities',
  'ai_usage_limits',
  'user_backups',
] as const

export type MigrationEntityType = (typeof MIGRATION_ENTITY_TYPES)[number]

type ImportOperation = 'inserted' | 'updated' | 'skipped'

function entityTypeValidator() {
  return v.union(
    ...MIGRATION_ENTITY_TYPES.map((name) => v.literal(name as MigrationEntityType)),
  )
}

async function findRun(ctx: QueryCtx | MutationCtx, runId: string) {
  return ctx.db.query('migration_runs').withIndex('by_runId', (q) => q.eq('runId', runId)).first()
}

async function findMap(ctx: QueryCtx | MutationCtx, entityType: string, supabaseId: string) {
  return ctx.db
    .query('migration_entity_map')
    .withIndex('by_entity_supabaseId', (q) => q.eq('entityType', entityType).eq('supabaseId', supabaseId))
    .first()
}

async function ensureRun(
  ctx: MutationCtx,
  runId: string,
  sourceSha: string,
  now: number,
): Promise<{ runDocId: Id<'migration_runs'>; created: boolean }> {
  const existing = await findRun(ctx, runId)
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: 'running',
      sourceSha: sourceSha || existing.sourceSha,
      summaryJson: { ...(existing.summaryJson ?? {}), resumedAt: now },
    })
    return { runDocId: existing._id, created: false }
  }
  const runDocId = await ctx.db.insert('migration_runs', {
    runId,
    startedAt: now,
    status: 'running',
    sourceSha,
    summaryJson: {},
  })
  return { runDocId, created: true }
}

async function upsertAuthUser(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_AUTH_USER_ID')
  const now = Date.now()
  const existing = await ctx.db
    .query('auth_users')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const patch = {
    email: String(payload.email ?? ''),
    emailNorm: String(payload.emailNorm ?? String(payload.email ?? '').trim().toLowerCase()),
    displayName: String(payload.displayName ?? 'Athlete'),
    mustResetPassword: true,
    updatedAt: Number(payload.updatedAt ?? now),
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('auth_users', {
    userId,
    createdAt: Number(payload.createdAt ?? now),
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertProfile(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_PROFILE_USER_ID')
  const now = Date.now()
  const patch = {
    pseudo: String(payload.pseudo ?? 'Athlete').slice(0, 24),
    level: Math.max(1, Number(payload.level ?? 1)),
    xp: Math.max(0, Number(payload.xp ?? 0)),
    rank: String(payload.rank ?? 'Bronze'),
    discipline: String(payload.discipline ?? 'Musculation'),
    isGhostModeEnabled: Boolean(payload.isGhostModeEnabled),
    updatedAt: Number(payload.updatedAt ?? now),
  }
  const existing = await ctx.db.query('profiles').withIndex('by_userId', (q) => q.eq('userId', userId)).first()
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('profiles', {
    userId,
    createdAt: Number(payload.createdAt ?? now),
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertWorkouts(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_WORKOUTS_USER_ID')
  const existing = await ctx.db
    .query('workouts_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const patch = {
    stateJson: payload.stateJson ?? {},
    progressJson: payload.progressJson ?? {},
    updatedAt: Number(payload.updatedAt ?? Date.now()),
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('workouts_state', {
    userId,
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertNutrition(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_NUTRITION_USER_ID')
  const existing = await ctx.db
    .query('nutrition_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const patch = {
    profileJson: payload.profileJson ?? {},
    journalJson: payload.journalJson ?? {},
    updatedAt: Number(payload.updatedAt ?? Date.now()),
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('nutrition_state', {
    userId,
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertMapBoundDoc(
  ctx: MutationCtx,
  table: 'checkins' | 'aliments' | 'activities',
  mapConvexId: string | null,
  insertDoc: Record<string, unknown>,
  patchDoc: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  if (mapConvexId) {
    const existing = await ctx.db.get(mapConvexId as never)
    if (existing) {
      await ctx.db.patch(existing._id, patchDoc as never)
      return { convexId: String(existing._id), operation: 'updated' }
    }
  }
  const inserted = await ctx.db.insert(table, insertDoc as never)
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertCheckin(
  ctx: MutationCtx,
  mapConvexId: string | null,
  supabaseId: string,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_CHECKIN_USER_ID')
  const patchDoc = {
    userId,
    legacySupabaseId: supabaseId,
    salleNom: String(payload.salleNom ?? 'Salle'),
    salleLat: payload.salleLat == null ? null : Number(payload.salleLat),
    salleLng: payload.salleLng == null ? null : Number(payload.salleLng),
    gymPayload: payload.gymPayload ?? null,
    createdAt: Number(payload.createdAt ?? Date.now()),
  }
  return upsertMapBoundDoc(ctx, 'checkins', mapConvexId, patchDoc, patchDoc)
}

async function upsertAliment(
  ctx: MutationCtx,
  mapConvexId: string | null,
  supabaseId: string,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_ALIMENT_USER_ID')
  const patchDoc = {
    userId,
    legacySupabaseId: supabaseId,
    nom: String(payload.nom ?? 'Aliment'),
    calories: Number(payload.calories ?? 0),
    proteines: Number(payload.proteines ?? 0),
    glucides: Number(payload.glucides ?? 0),
    lipides: Number(payload.lipides ?? 0),
    barcode: payload.barcode == null ? undefined : String(payload.barcode),
    createdAt: Number(payload.createdAt ?? Date.now()),
  }
  return upsertMapBoundDoc(ctx, 'aliments', mapConvexId, patchDoc, patchDoc)
}

async function upsertActivity(
  ctx: MutationCtx,
  mapConvexId: string | null,
  supabaseId: string,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_ACTIVITY_USER_ID')
  const activityType = String(payload.activityType ?? 'workout')
  if (!ACTIVITY_TYPES.includes(activityType)) throw new Error('MIGRATION_INVALID_ACTIVITY_TYPE')
  const patchDoc = {
    userId,
    legacySupabaseId: supabaseId,
    activityType,
    actionText: String(payload.actionText ?? '').slice(0, 280) || 'Activite importee',
    xpEarned: Math.max(0, Math.min(10_000, Number(payload.xpEarned ?? 0))),
    originLat: payload.originLat == null ? null : Number(payload.originLat),
    originLng: payload.originLng == null ? null : Number(payload.originLng),
    createdAt: Number(payload.createdAt ?? Date.now()),
  }
  return upsertMapBoundDoc(ctx, 'activities', mapConvexId, patchDoc, patchDoc)
}

const ACTIVITY_TYPES = ['pr', 'workout', 'checkin', 'rank_up', 'streak']

async function upsertAiUsageLimit(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  const dateOfScan = String(payload.dateOfScan ?? '')
  if (!userId || !dateOfScan) throw new Error('MIGRATION_INVALID_AI_USAGE_KEY')
  const existing = await ctx.db
    .query('ai_usage_limits')
    .withIndex('by_userId_dateOfScan', (q) => q.eq('userId', userId).eq('dateOfScan', dateOfScan))
    .first()
  const patch = {
    scanCount: Math.max(0, Number(payload.scanCount ?? 0)),
    updatedAt: Number(payload.updatedAt ?? Date.now()),
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('ai_usage_limits', {
    userId,
    dateOfScan,
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertBackup(
  ctx: MutationCtx,
  payload: Record<string, unknown>,
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  const userId = String(payload.userId ?? '')
  if (!userId) throw new Error('MIGRATION_INVALID_BACKUP_USER_ID')
  const existing = await ctx.db
    .query('legacy_supabase_backups')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  const patch = {
    payloadJson: payload.payloadJson ?? {},
    updatedAt: Number(payload.updatedAt ?? Date.now()),
    source: 'supabase_user_backups' as const,
  }
  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return { convexId: String(existing._id), operation: 'updated' }
  }
  const inserted = await ctx.db.insert('legacy_supabase_backups', {
    userId,
    ...patch,
  })
  return { convexId: String(inserted), operation: 'inserted' }
}

async function upsertEntity(
  ctx: MutationCtx,
  args: {
    entityType: MigrationEntityType
    supabaseId: string
    payload: Record<string, unknown>
    mapConvexId: string | null
  },
): Promise<{ convexId: string; operation: Exclude<ImportOperation, 'skipped'> }> {
  switch (args.entityType) {
    case 'auth_users':
      return upsertAuthUser(ctx, args.payload)
    case 'profiles':
      return upsertProfile(ctx, args.payload)
    case 'workouts':
      return upsertWorkouts(ctx, args.payload)
    case 'nutrition':
      return upsertNutrition(ctx, args.payload)
    case 'checkins':
      return upsertCheckin(ctx, args.mapConvexId, args.supabaseId, args.payload)
    case 'aliments':
      return upsertAliment(ctx, args.mapConvexId, args.supabaseId, args.payload)
    case 'activities':
      return upsertActivity(ctx, args.mapConvexId, args.supabaseId, args.payload)
    case 'ai_usage_limits':
      return upsertAiUsageLimit(ctx, args.payload)
    case 'user_backups':
      return upsertBackup(ctx, args.payload)
    default:
      throw new Error('MIGRATION_ENTITY_UNSUPPORTED')
  }
}

export async function importEntityForRun(
  ctx: MutationCtx,
  args: {
    runId: string
    sourceSha: string
    entityType: MigrationEntityType
    supabaseId: string
    checksum: string
    payload: Record<string, unknown>
    dryRun?: boolean
  },
): Promise<{ operation: ImportOperation; convexId: string | null }> {
  const now = Date.now()
  await ensureRun(ctx, args.runId, args.sourceSha, now)
  const existingMap = await findMap(ctx, args.entityType, args.supabaseId)
  if (existingMap && existingMap.checksum === args.checksum) {
    await ctx.db.patch(existingMap._id, {
      runId: args.runId,
      importedAt: now,
    })
    return { operation: 'skipped', convexId: existingMap.convexId }
  }

  if (args.dryRun) {
    return { operation: existingMap ? 'updated' : 'inserted', convexId: existingMap?.convexId ?? null }
  }

  const outcome = await upsertEntity(ctx, {
    entityType: args.entityType,
    supabaseId: args.supabaseId,
    payload: args.payload,
    mapConvexId: existingMap?.convexId ?? null,
  })

  if (existingMap) {
    await ctx.db.patch(existingMap._id, {
      runId: args.runId,
      convexId: outcome.convexId,
      checksum: args.checksum,
      importedAt: now,
    })
  } else {
    await ctx.db.insert('migration_entity_map', {
      runId: args.runId,
      entityType: args.entityType,
      supabaseId: args.supabaseId,
      convexId: outcome.convexId,
      checksum: args.checksum,
      importedAt: now,
    })
  }

  return { operation: outcome.operation, convexId: outcome.convexId }
}

export const startRun = mutation({
  args: {
    runId: v.string(),
    sourceSha: v.string(),
  },
  returns: v.object({
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const outcome = await ensureRun(ctx, args.runId, args.sourceSha, now)
    return { created: outcome.created }
  },
})

export const importEntity = mutation({
  args: {
    runId: v.string(),
    sourceSha: v.string(),
    entityType: entityTypeValidator(),
    supabaseId: v.string(),
    checksum: v.string(),
    payload: v.any(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    operation: v.union(v.literal('inserted'), v.literal('updated'), v.literal('skipped')),
    convexId: v.union(v.string(), v.null()),
  }),
  handler: (ctx, args) =>
    importEntityForRun(ctx, {
      runId: args.runId,
      sourceSha: args.sourceSha,
      entityType: args.entityType,
      supabaseId: args.supabaseId,
      checksum: args.checksum,
      payload: (args.payload ?? {}) as Record<string, unknown>,
      dryRun: args.dryRun,
    }),
})

export const finishRun = mutation({
  args: {
    runId: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('aborted'),
    ),
    summaryJson: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await findRun(ctx, args.runId)
    if (!run) {
      await ctx.db.insert('migration_runs', {
        runId: args.runId,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        status: args.status,
        sourceSha: 'unknown',
        summaryJson: args.summaryJson ?? {},
      })
      return null
    }
    await ctx.db.patch(run._id, {
      status: args.status,
      finishedAt: Date.now(),
      summaryJson: args.summaryJson ?? {},
    })
    return null
  },
})

function toEntityCounts(rows: Array<{ entityType: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const type of MIGRATION_ENTITY_TYPES) counts[type] = 0
  for (const row of rows) {
    counts[row.entityType] = (counts[row.entityType] ?? 0) + 1
  }
  return counts
}

export const getCounts = query({
  args: {
    runId: v.optional(v.string()),
  },
  returns: v.object({
    tables: v.object({
      auth_users: v.number(),
      profiles: v.number(),
      workouts: v.number(),
      nutrition: v.number(),
      checkins: v.number(),
      aliments: v.number(),
      activities: v.number(),
      ai_usage_limits: v.number(),
      user_backups: v.number(),
    }),
    mappedEntities: v.object({
      auth_users: v.number(),
      profiles: v.number(),
      workouts: v.number(),
      nutrition: v.number(),
      checkins: v.number(),
      aliments: v.number(),
      activities: v.number(),
      ai_usage_limits: v.number(),
      user_backups: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const mapRows = await ctx.db.query('migration_entity_map').collect()
    const scoped = args.runId ? mapRows.filter((row) => row.runId === args.runId) : mapRows
    const mappedEntities = toEntityCounts(scoped)
    return {
      tables: {
        auth_users: (await ctx.db.query('auth_users').collect()).length,
        profiles: (await ctx.db.query('profiles').collect()).length,
        workouts: (await ctx.db.query('workouts_state').collect()).length,
        nutrition: (await ctx.db.query('nutrition_state').collect()).length,
        checkins: (await ctx.db.query('checkins').collect()).length,
        aliments: (await ctx.db.query('aliments').collect()).length,
        activities: (await ctx.db.query('activities').collect()).length,
        ai_usage_limits: (await ctx.db.query('ai_usage_limits').collect()).length,
        user_backups: (await ctx.db.query('legacy_supabase_backups').collect()).length,
      },
      mappedEntities,
    }
  },
})
