import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from './_generated/server'
import {
  computeFfmi,
  computeLeanMassKg,
  effectiveAiCallsToday,
} from './lib/athleteMetrics'
import { runWorkersAiChat } from './lib/cloudflareAi'

/** Quota gratuit Cloudflare Workers AI (appels / jour UTC). */
const AI_DAILY_FREE_LIMIT = 3

const recentSessionValidator = v.object({
  dateKey: v.string(),
  routineId: v.string(),
  exerciseCount: v.number(),
  setCount: v.number(),
  totalVolumeKg: v.number(),
})

const athleteContextValidator = v.object({
  userId: v.string(),
  pseudo: v.string(),
  level: v.number(),
  rank: v.string(),
  discipline: v.string(),
  heightCm: v.union(v.number(), v.null()),
  weightKg: v.union(v.number(), v.null()),
  bodyfat: v.union(v.number(), v.null()),
  targetCalories: v.union(v.number(), v.null()),
  leanMassKg: v.union(v.number(), v.null()),
  ffmi: v.union(v.number(), v.null()),
  aiCallsToday: v.number(),
  lastAiCallDate: v.union(v.string(), v.null()),
  recentSessions: v.array(recentSessionValidator),
})

type RecentSession = {
  dateKey: string
  routineId: string
  exerciseCount: number
  setCount: number
  totalVolumeKg: number
}

type AthleteContext = {
  userId: string
  pseudo: string
  level: number
  rank: string
  discipline: string
  heightCm: number | null
  weightKg: number | null
  bodyfat: number | null
  targetCalories: number | null
  leanMassKg: number | null
  ffmi: number | null
  aiCallsToday: number
  lastAiCallDate: string | null
  recentSessions: RecentSession[]
}

function todayUtcDateKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function parseRecentSessions(workoutState: unknown, limit = 5): RecentSession[] {
  const state = asRecord(workoutState) ?? {}
  const notes = Array.isArray(state.workoutNotes) ? state.workoutNotes : []
  const sessions: RecentSession[] = []

  for (let i = notes.length - 1; i >= 0 && sessions.length < limit; i -= 1) {
    const note = asRecord(notes[i])
    if (!note) continue
    const dateKey = typeof note.dateKey === 'string' ? note.dateKey : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    const routineId = typeof note.routineId === 'string' ? note.routineId : 'unknown'
    const exercises = Array.isArray(note.exercises) ? note.exercises : []
    let setCount = 0
    let totalVolumeKg = 0
    for (const rawExercise of exercises) {
      const exercise = asRecord(rawExercise)
      if (!exercise) continue
      const sets = Array.isArray(exercise.sets) ? exercise.sets : []
      for (const rawSet of sets) {
        const set = asRecord(rawSet)
        if (!set) continue
        const weightKg = asFiniteNumber(set.weightKg) ?? 0
        const reps = asFiniteNumber(set.reps) ?? 0
        if (weightKg <= 0 || reps <= 0) continue
        setCount += 1
        totalVolumeKg += weightKg * reps
      }
    }
    sessions.push({
      dateKey,
      routineId,
      exerciseCount: exercises.length,
      setCount,
      totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    })
  }

  return sessions
}

function formatMathBilan(context: AthleteContext): string {
  const lines = [
    'Bilan mathématique (quota IA gratuit atteint — 3/3 aujourd’hui).',
    `Athlète: ${context.pseudo} · Niveau ${context.level} · Rang ${context.rank} · ${context.discipline}.`,
    `Mensurations: ${context.heightCm != null ? `${context.heightCm} cm` : 'taille n/a'} · ${
      context.weightKg != null ? `${context.weightKg} kg` : 'poids n/a'
    } · bodyfat ${context.bodyfat != null ? `${context.bodyfat}%` : 'n/a'}.`,
    `Masse maigre: ${context.leanMassKg != null ? `${context.leanMassKg} kg` : 'n/a'} · FFMI: ${
      context.ffmi != null ? String(context.ffmi) : 'n/a'
    }.`,
    `Objectif calorique: ${
      context.targetCalories != null ? `${Math.round(context.targetCalories)} kcal` : 'n/a'
    }.`,
  ]
  if (context.recentSessions.length > 0) {
    const last = context.recentSessions[0]
    lines.push(
      `Dernière séance: ${last.dateKey} (${last.routineId}) — ${last.setCount} séries, volume ${last.totalVolumeKg} kg.`,
    )
  } else {
    lines.push('Aucune séance récente synchronisée.')
  }
  return lines.join('\n')
}

function buildSystemPrompt(context: AthleteContext): string {
  const sessionsSummary =
    context.recentSessions.length === 0
      ? 'aucune séance récente'
      : context.recentSessions
          .map(
            (s) =>
              `${s.dateKey}/${s.routineId}: ${s.setCount} séries, volume ${s.totalVolumeKg} kg`,
          )
          .join(' ; ')

  return [
    'Tu es le coach de performance Ranked Gym.',
    'Ton direct, scientifique, factuel. Maximum 3 phrases. Pas de markdown, pas d’emojis.',
    'Base-toi uniquement sur les stats injectées — n’invente pas de mesures manquantes.',
    `Stats athlète: pseudo=${context.pseudo}, niveau=${context.level}, rang=${context.rank}, discipline=${context.discipline}.`,
    `Mensurations: taille_cm=${context.heightCm ?? 'n/a'}, poids_kg=${context.weightKg ?? 'n/a'}, bodyfat_pct=${context.bodyfat ?? 'n/a'}, objectif_kcal=${context.targetCalories ?? 'n/a'}.`,
    `Dérivés déterministes: masse_maigre_kg=${context.leanMassKg ?? 'n/a'}, FFMI=${context.ffmi ?? 'n/a'}.`,
    `Séances récentes: ${sessionsSummary}.`,
  ].join(' ')
}

async function loadAthleteContext(ctx: QueryCtx, userId: string): Promise<AthleteContext | null> {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
  if (!profile) return null

  const workout = await ctx.db
    .query('workouts_state')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()

  const heightCm = asFiniteNumber(profile.heightCm)
  const weightKg = asFiniteNumber(profile.weightKg)
  const bodyfat = asFiniteNumber(profile.bodyfat)
  const targetCalories = asFiniteNumber(profile.targetCalories)
  const leanMassKg = computeLeanMassKg(weightKg, bodyfat)
  const ffmi = computeFfmi(leanMassKg, heightCm)
  const today = todayUtcDateKey()
  const aiCallsToday = effectiveAiCallsToday(profile.aiCallsToday, profile.lastAiCallDate, today)

  return {
    userId: profile.userId,
    pseudo: profile.pseudo,
    level: profile.level,
    rank: profile.rank,
    discipline: profile.discipline,
    heightCm,
    weightKg,
    bodyfat,
    targetCalories,
    leanMassKg,
    ffmi,
    aiCallsToday,
    lastAiCallDate: profile.lastAiCallDate ?? null,
    recentSessions: parseRecentSessions(workout?.stateJson),
  }
}

/**
 * Contexte athlète + dérivés déterministes (masse maigre, FFMI) + quota IA du jour.
 * Interne — appelé uniquement depuis `askRankedIntelligence`.
 */
export const getAthleteContext = internalQuery({
  args: { userId: v.string() },
  returns: v.union(athleteContextValidator, v.null()),
  handler: async (ctx, args) => {
    return loadAthleteContext(ctx, args.userId.trim())
  },
})

/**
 * +1 sur le compteur journalier IA ; reset automatique si la date UTC a changé.
 */
export const incrementAiQuota = internalMutation({
  args: { userId: v.string() },
  returns: v.object({
    aiCallsToday: v.number(),
    lastAiCallDate: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = args.userId.trim()
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    if (!profile) {
      throw new Error('Profile not found')
    }

    const today = todayUtcDateKey()
    const current = effectiveAiCallsToday(profile.aiCallsToday, profile.lastAiCallDate, today)
    const next = current + 1
    await ctx.db.patch(profile._id, {
      aiCallsToday: next,
      lastAiCallDate: today,
      updatedAt: Date.now(),
    })
    return { aiCallsToday: next, lastAiCallDate: today }
  },
})

type AskResult =
  | {
      ok: true
      source: 'ai' | 'math_fallback'
      message: string
      aiCallsToday: number
      dailyLimit: number
      remaining: number
      leanMassKg: number | null
      ffmi: number | null
    }
  | {
      ok: false
      error: string
      code: string
    }

/**
 * Moteur hybride : bilan déterministe gratuit si quota ≥ 3, sinon Llama 3.1 via Cloudflare Workers AI.
 */
export const askRankedIntelligence = action({
  args: {
    sessionToken: v.string(),
    question: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      source: v.union(v.literal('ai'), v.literal('math_fallback')),
      message: v.string(),
      aiCallsToday: v.number(),
      dailyLimit: v.number(),
      remaining: v.number(),
      leanMassKg: v.union(v.number(), v.null()),
      ffmi: v.union(v.number(), v.null()),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      code: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<AskResult> => {
    const session = await ctx.runQuery(api.auth.getSession, { sessionToken: args.sessionToken })
    if (!session) {
      return { ok: false, error: 'Session expirée — reconnecte-toi puis réessaie.', code: 'AUTH_REQUIRED' }
    }

    const context = await ctx.runQuery(internal.ai.getAthleteContext, {
      userId: session.userId,
    })
    if (!context) {
      return { ok: false, error: 'Profil introuvable.', code: 'PROFILE_MISSING' }
    }

    if (context.aiCallsToday >= AI_DAILY_FREE_LIMIT) {
      return {
        ok: true,
        source: 'math_fallback',
        message: formatMathBilan(context),
        aiCallsToday: context.aiCallsToday,
        dailyLimit: AI_DAILY_FREE_LIMIT,
        remaining: 0,
        leanMassKg: context.leanMassKg,
        ffmi: context.ffmi,
      }
    }

    const userQuestion =
      typeof args.question === 'string' && args.question.trim().length > 0
        ? args.question.trim().slice(0, 800)
        : 'Donne-moi un feedback de performance concis basé sur mes stats actuelles.'

    const ai = await runWorkersAiChat({
      system: buildSystemPrompt(context),
      user: userQuestion,
    })
    if (!ai.ok) {
      return { ok: false, error: ai.error, code: ai.code }
    }

    const quota = await ctx.runMutation(internal.ai.incrementAiQuota, {
      userId: session.userId,
    })

    return {
      ok: true,
      source: 'ai',
      message: ai.text,
      aiCallsToday: quota.aiCallsToday,
      dailyLimit: AI_DAILY_FREE_LIMIT,
      remaining: Math.max(0, AI_DAILY_FREE_LIMIT - quota.aiCallsToday),
      leanMassKg: context.leanMassKg,
      ffmi: context.ffmi,
    }
  },
})
