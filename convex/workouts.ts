import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, mutation, query } from './_generated/server'
import { runWorkersAiChat } from './lib/cloudflareAi'
import {
  buildDeterministicWorkout,
  buildWorkoutAiSystemPrompt,
  clampDurationMin,
  parseAiWorkoutPlan,
  WORKOUT_EXERCISE_POOL,
  type GeneratedExercise,
  type GeneratedWorkoutPlan,
} from './lib/workoutGenerator'
import { requireSessionUser } from './lib/auth'

/** Quota IA partagé avec `askRankedIntelligence` (profils.aiCallsToday). */
const AI_DAILY_FREE_LIMIT = 3

const generatedExerciseValidator = v.object({
  exerciseId: v.string(),
  name: v.string(),
  sets: v.number(),
  reps: v.number(),
  restSec: v.number(),
  order: v.number(),
})

type GenerateWorkoutSuccess = {
  ok: true
  source: 'ai' | 'deterministic'
  title: string
  focus: string
  durationMin: number
  exercises: GeneratedExercise[]
  aiCallsToday: number
  dailyLimit: number
  remaining: number
}

type GenerateWorkoutFailure = {
  ok: false
  error: string
  code: string
}

type GenerateWorkoutResult = GenerateWorkoutSuccess | GenerateWorkoutFailure

function sanitizeExercises(raw: GeneratedExercise[]): GeneratedExercise[] {
  return raw.slice(0, 8).map((ex, index) => ({
    exerciseId: ex.exerciseId.trim().slice(0, 64),
    name: ex.name.trim().slice(0, 80),
    sets: Math.min(6, Math.max(2, Math.round(ex.sets))),
    reps: Math.min(30, Math.max(3, Math.round(ex.reps))),
    restSec: Math.min(240, Math.max(30, Math.round(ex.restSec))),
    order: index + 1,
  }))
}

/**
 * Générateur de séance IA (hybride).
 * - Auth session + `userId` doit matcher la session (jamais un userId client arbitraire).
 * - Structure déterministe toujours disponible ; Workers AI affine si quota < 3.
 */
export const generateWorkout = action({
  args: {
    sessionToken: v.string(),
    userId: v.string(),
    durationMin: v.number(),
    focus: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      source: v.union(v.literal('ai'), v.literal('deterministic')),
      title: v.string(),
      focus: v.string(),
      durationMin: v.number(),
      exercises: v.array(generatedExerciseValidator),
      aiCallsToday: v.number(),
      dailyLimit: v.number(),
      remaining: v.number(),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      code: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<GenerateWorkoutResult> => {
    const session = await ctx.runQuery(api.auth.getSession, { sessionToken: args.sessionToken })
    if (!session) {
      return { ok: false, error: 'Session expirée — reconnecte-toi puis réessaie.', code: 'AUTH_REQUIRED' }
    }
    if (session.userId !== args.userId.trim()) {
      return { ok: false, error: 'Accès refusé.', code: 'FORBIDDEN' }
    }

    const durationMin = clampDurationMin(args.durationMin)
    const focus = args.focus.trim().slice(0, 80) || 'Upper V-Taper'
    const deterministic = buildDeterministicWorkout({ focus, durationMin })

    const context: {
      level: number
      rank: string
      discipline: string
      aiCallsToday: number
    } | null = await ctx.runQuery(internal.ai.getAthleteContext, {
      userId: session.userId,
    })
    const aiCallsToday: number = context?.aiCallsToday ?? 0

    // Quota atteint → séance déterministe gratuite (One-Tap toujours possible).
    if (aiCallsToday >= AI_DAILY_FREE_LIMIT) {
      return {
        ok: true,
        source: 'deterministic',
        title: deterministic.title,
        focus: deterministic.focus,
        durationMin: deterministic.durationMin,
        exercises: deterministic.exercises,
        aiCallsToday,
        dailyLimit: AI_DAILY_FREE_LIMIT,
        remaining: 0,
      }
    }

    const catalogIds = WORKOUT_EXERCISE_POOL.map((e) => e.id)
    const ai = await runWorkersAiChat({
      system: buildWorkoutAiSystemPrompt(catalogIds),
      user: [
        `Focus: ${focus}.`,
        `Durée disponible: ${durationMin} minutes.`,
        `Athlète: niveau ${context?.level ?? '?'} · rang ${context?.rank ?? '?'} · discipline ${context?.discipline ?? '?'}.`,
        'Propose une séance structurée (compound → isolation) adaptée au focus.',
      ].join(' '),
    })

    let plan: GeneratedWorkoutPlan = deterministic
    if (ai.ok) {
      const parsed = parseAiWorkoutPlan(ai.text, deterministic)
      if (parsed) {
        plan = parsed
        await ctx.runMutation(internal.ai.incrementAiQuota, { userId: session.userId })
      }
    }

    const nextCalls = plan.source === 'ai' ? aiCallsToday + 1 : aiCallsToday
    return {
      ok: true,
      source: plan.source,
      title: plan.title,
      focus: plan.focus,
      durationMin: plan.durationMin,
      exercises: plan.exercises,
      aiCallsToday: nextCalls,
      dailyLimit: AI_DAILY_FREE_LIMIT,
      remaining: Math.max(0, AI_DAILY_FREE_LIMIT - nextCalls),
    }
  },
})

/**
 * One-Tap Start — crée une session `active_workouts` in_progress et renvoie son id
 * pour lancer immédiatement timer de repos + UI d’entraînement.
 */
export const startGeneratedWorkout = mutation({
  args: {
    sessionToken: v.string(),
    focus: v.string(),
    title: v.optional(v.string()),
    durationMin: v.number(),
    source: v.optional(v.union(v.literal('ai'), v.literal('deterministic'))),
    exercises: v.array(generatedExerciseValidator),
  },
  returns: v.object({
    sessionId: v.id('active_workouts'),
    startedAt: v.number(),
    status: v.literal('in_progress'),
  }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const exercises = sanitizeExercises(args.exercises)
    if (exercises.length < 1) {
      throw new Error('Aucun exercice à démarrer')
    }

    const now = Date.now()
    const focus = args.focus.trim().slice(0, 80) || 'Séance'
    const title = (args.title?.trim() || focus).slice(0, 80)
    const durationMin = clampDurationMin(args.durationMin)
    const source = args.source === 'ai' ? 'ai' : 'deterministic'

    // Une seule séance in_progress par user : abandonne l’éventuelle précédente.
    const previous = await ctx.db
      .query('active_workouts')
      .withIndex('by_userId_status', (q) =>
        q.eq('userId', user.userId).eq('status', 'in_progress'),
      )
      .collect()
    for (const row of previous) {
      await ctx.db.patch(row._id, {
        status: 'abandoned',
        endedAt: now,
        updatedAt: now,
      })
    }

    const sessionId = await ctx.db.insert('active_workouts', {
      userId: user.userId,
      status: 'in_progress',
      focus,
      title,
      durationMin,
      source,
      exercises,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    return {
      sessionId,
      startedAt: now,
      status: 'in_progress' as const,
    }
  },
})

/** Lecture de la séance active (One-Tap / reprise timer). */
export const getActiveWorkout = query({
  args: { sessionToken: v.string() },
  returns: v.union(
    v.object({
      sessionId: v.id('active_workouts'),
      status: v.literal('in_progress'),
      focus: v.string(),
      title: v.string(),
      durationMin: v.number(),
      source: v.union(v.literal('ai'), v.literal('deterministic')),
      exercises: v.array(generatedExerciseValidator),
      startedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const row = await ctx.db
      .query('active_workouts')
      .withIndex('by_userId_status', (q) =>
        q.eq('userId', user.userId).eq('status', 'in_progress'),
      )
      .first()
    if (!row) return null
    return {
      sessionId: row._id,
      status: 'in_progress' as const,
      focus: row.focus,
      title: row.title,
      durationMin: row.durationMin,
      source: row.source,
      exercises: row.exercises,
      startedAt: row.startedAt,
    }
  },
})
