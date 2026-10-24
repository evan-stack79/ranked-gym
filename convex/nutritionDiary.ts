import { ConvexError, v } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import { assertUserOwnership, requireSessionUser } from './lib/auth'
import { assertFoodAddAccessFromStoredProfile } from './lib/foodAddAccess'
import { getRankFromLevel } from './lib/progressionRank'
import {
  applyProteinGoalHalfLifeForSession,
  mergeNutritionDaySnapshotForSession,
  type FreshnessEventSnapshot,
} from './progression'
import { diaryRollup, nutritionDayCache, type DiaryMealInput } from '../src/nutrition-engine/diaryRollup'
import {
  xpForKind,
  evaluateNutritionXp,
  type NutritionAwardKind,
} from '../src/nutrition-engine/nutritionXp'

const XP_PER_LEVEL = 1000

const mealArg = v.object({
  mealType: v.optional(v.string()),
  calories: v.optional(v.union(v.number(), v.null())),
  proteinG: v.optional(v.union(v.number(), v.null())),
  carbsG: v.optional(v.union(v.number(), v.null())),
  fatG: v.optional(v.union(v.number(), v.null())),
  fiberG: v.optional(v.union(v.number(), v.null())),
  deletedAt: v.optional(v.union(v.number(), v.null())),
})

const eventArg = v.object({
  muscles: v.array(v.string()),
  units: v.number(),
  hoursAgo: v.number(),
})

function applyXp(level: number, xp: number, gain: number): { level: number; xp: number } {
  let nextLevel = Math.max(1, Math.floor(level))
  let nextXp = Math.max(0, xp) + gain
  while (nextXp >= XP_PER_LEVEL) {
    nextXp -= XP_PER_LEVEL
    nextLevel += 1
  }
  return { level: nextLevel, xp: nextXp }
}

async function findAwards(ctx: MutationCtx, userId: string, dateKey: string, kind: NutritionAwardKind) {
  return ctx.db
    .query('nutrition_xp_awards')
    .withIndex('by_user_date_kind', (q) => q.eq('userId', userId).eq('dateKey', dateKey).eq('kind', kind))
    .collect()
}

export async function awardNutritionXpForSession(
  ctx: MutationCtx,
  sessionToken: string,
  input: {
    dateKey: string
    timezone: string
    kind: NutritionAwardKind
    meals: DiaryMealInput[]
    waterMl: number | null
    targetKcal: number | null
    proteinTargetG: number | null
    freshnessEvents?: FreshnessEventSnapshot[]
  },
): Promise<{ applied: boolean; kind: NutritionAwardKind; xp: number; totalXp: number }> {
  const user = await requireSessionUser(ctx, sessionToken)
  const access = await assertFoodAddAccessFromStoredProfile(ctx, user.userId)
  if (!access.ok) throw new ConvexError({ code: access.error })

  const rollup = diaryRollup({ meals: input.meals, waterMl: input.waterMl })
  const evaluation = evaluateNutritionXp({
    rollup,
    proteinTargetG: input.proteinTargetG,
    foodAddOpen: true,
  })
  const xp = xpForKind(evaluation, input.kind)
  const cache = nutritionDayCache({
    rollup,
    targetKcal: input.targetKcal,
    proteinTargetG: input.proteinTargetG,
  })

  const existing = await findAwards(ctx, user.userId, input.dateKey, input.kind)
  for (const row of existing) assertUserOwnership(row.userId, user.userId)
  if (existing[0]) {
    await mergeNutritionDaySnapshotForSession(ctx, sessionToken, {
      dateKey: input.dateKey,
      timezone: input.timezone,
      nutrition: cache,
    })
    if (input.kind === 'protein_goal') {
      await applyProteinGoalHalfLifeForSession(ctx, sessionToken, {
        dateKey: input.dateKey,
        timezone: input.timezone,
        freshnessEvents: input.freshnessEvents,
      })
    }
    return { applied: false, kind: input.kind, xp: existing[0].xp, totalXp: evaluation.totalXp }
  }
  if (xp <= 0) throw new ConvexError({ code: 'NUTRITION_AWARD_NOT_EARNED' })

  await mergeNutritionDaySnapshotForSession(ctx, sessionToken, {
    dateKey: input.dateKey,
    timezone: input.timezone,
    nutrition: cache,
  })
  if (input.kind === 'protein_goal') {
    await applyProteinGoalHalfLifeForSession(ctx, sessionToken, {
      dateKey: input.dateKey,
      timezone: input.timezone,
      freshnessEvents: input.freshnessEvents,
    })
  }

  const profileRow = await ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', user.userId))
    .first()
  if (!profileRow) throw new Error('PROFILE_NOT_FOUND')
  assertUserOwnership(profileRow.userId, user.userId)

  const progress = applyXp(profileRow.level, profileRow.xp, xp)
  const rank = getRankFromLevel(progress.level)
  const now = Date.now()
  await ctx.db.patch(profileRow._id, {
    level: progress.level,
    xp: progress.xp,
    rank: rank.tier,
    rankDivision: rank.division,
    updatedAt: now,
  })
  await ctx.db.insert('nutrition_xp_awards', {
    userId: user.userId,
    dateKey: input.dateKey,
    kind: input.kind,
    xp,
    createdAt: now,
  })
  const raced = await findAwards(ctx, user.userId, input.dateKey, input.kind)
  if (raced.length > 1) throw new Error('NUTRITION_AWARD_IDEMPOTENT_RETRY')
  return { applied: true, kind: input.kind, xp, totalXp: evaluation.totalXp }
}

export const mergeNutritionDaySnapshot = mutation({
  args: {
    sessionToken: v.string(),
    dateKey: v.string(),
    timezone: v.string(),
    nutrition: v.object({
      logged: v.boolean(),
      kcal: v.union(v.number(), v.null()),
      proteinG: v.union(v.number(), v.null()),
      carbsG: v.union(v.number(), v.null()),
      fatG: v.union(v.number(), v.null()),
      fiberG: v.union(v.number(), v.null()),
      waterMl: v.union(v.number(), v.null()),
      targetKcal: v.union(v.number(), v.null()),
      proteinTargetG: v.union(v.number(), v.null()),
      inputsHash: v.string(),
    }),
  },
  returns: v.object({
    updated: v.boolean(),
    snapshot: v.any(),
  }),
  handler: (ctx, args) => mergeNutritionDaySnapshotForSession(ctx, args.sessionToken, args),
})

export const awardNutritionXp = mutation({
  args: {
    sessionToken: v.string(),
    dateKey: v.string(),
    timezone: v.string(),
    kind: v.union(v.literal('meals_complete'), v.literal('protein_goal')),
    meals: v.array(mealArg),
    waterMl: v.union(v.number(), v.null()),
    targetKcal: v.union(v.number(), v.null()),
    proteinTargetG: v.union(v.number(), v.null()),
    freshnessEvents: v.optional(v.array(eventArg)),
  },
  returns: v.object({
    applied: v.boolean(),
    kind: v.union(v.literal('meals_complete'), v.literal('protein_goal')),
    xp: v.number(),
    totalXp: v.number(),
  }),
  handler: (ctx, args) => awardNutritionXpForSession(ctx, args.sessionToken, args),
})
