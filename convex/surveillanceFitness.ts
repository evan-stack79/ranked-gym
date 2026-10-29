/**
 * Webhooks Convex → routine Grok Bot « Surveillance fitness ».
 * Env : SURVEILLANCE_FITNESS_WEBHOOK_URL + SURVEILLANCE_FITNESS_WEBHOOK_KEY.
 * Absents → log soft, jamais d’erreur utilisateur. Un envoi / (user, type) pour les « premiers ».
 *
 * Ne pas déployer depuis ce dépôt — le Studio Manager gère Convex prod.
 */
import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import type { Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  mutation,
  type MutationCtx,
} from './_generated/server'
import { requireSessionUser } from './lib/auth'
import {
  daysSince,
  postSurveillanceFitnessWebhook,
  readSurveillanceFitnessWebhookConfig,
  SURVEILLANCE_FITNESS_CHURN_DAYS,
  toIsoUtcZ,
  type SurveillanceFitnessEventType,
  type SurveillanceFitnessPlan,
  type SurveillanceFitnessWebhookPayload,
} from './lib/surveillanceFitnessWebhook'

export {
  SURVEILLANCE_FITNESS_CHURN_DAYS,
  SURVEILLANCE_FITNESS_WEBHOOK_KEY_ENV,
  SURVEILLANCE_FITNESS_WEBHOOK_URL_ENV,
  buildSurveillanceFitnessWebhookBody,
  postSurveillanceFitnessWebhook,
  type SurveillanceFitnessEventType,
  type SurveillanceFitnessWebhookPayload,
} from './lib/surveillanceFitnessWebhook'

/** 4 essais (1 immédiat + retries), même esprit qu’avis bêta. */
export const SURVEILLANCE_NOTIF_MAX_ESSAIS = 4
export const SURVEILLANCE_NOTIF_RETRY_DELAYS_MS = [
  1 * 60 * 1000,
  10 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
] as const

const eventTypeValidator = v.union(
  v.literal('signup_free'),
  v.literal('beta_signup'),
  v.literal('first_meal_photo_ai'),
  v.literal('first_workout'),
  v.literal('churn'),
  v.literal('test'),
)

const deliverRef = makeFunctionReference<
  'action',
  { eventId: Id<'surveillance_fitness_events'> },
  { delivered: boolean }
>('surveillanceFitness:deliverSurveillanceFitnessWebhook')

type SchedulerLike = { runAfter: MutationCtx['scheduler']['runAfter'] }

function hasScheduler(ctx: MutationCtx): ctx is MutationCtx & { scheduler: SchedulerLike } {
  const candidate = ctx as MutationCtx & { scheduler?: SchedulerLike }
  return typeof candidate.scheduler?.runAfter === 'function'
}

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function parseBooleanFlag(raw: string | undefined): boolean {
  if (typeof raw !== 'string') return false
  const n = raw.trim().toLowerCase()
  return n === 'true' || n === '1' || n === 'yes'
}

/** Pendant la bêta publique, les inscriptions partent en `beta_signup`. */
export function resolveSignupEventType(): Extract<
  SurveillanceFitnessEventType,
  'signup_free' | 'beta_signup'
> {
  if (parseBooleanFlag(readEnv('SURVEILLANCE_FITNESS_BETA_MODE'))) return 'beta_signup'
  if (parseBooleanFlag(readEnv('CONVEX_ALLOW_PUBLIC_SIGNUP'))) return 'beta_signup'
  return 'signup_free'
}

function planForType(type: SurveillanceFitnessEventType): SurveillanceFitnessPlan {
  if (type === 'beta_signup') return 'beta'
  if (type === 'signup_free') return 'free'
  return 'free'
}

/**
 * Enregistre un événement one-shot et planifie la livraison.
 * Si déjà envoyé / en cours pour ce (userId, type) → no-op.
 */
export async function scheduleSurveillanceFitnessEvent(
  ctx: MutationCtx,
  input: {
    userId: string
    email: string
    type: SurveillanceFitnessEventType
    lastActiveDays?: number | null
    actionCount?: number | null
    plan?: SurveillanceFitnessPlan
    force?: boolean
  },
): Promise<{ scheduled: boolean; eventId?: Id<'surveillance_fitness_events'> }> {
  const existing = await ctx.db
    .query('surveillance_fitness_events')
    .withIndex('by_userId_type', (q) => q.eq('userId', input.userId).eq('type', input.type))
    .first()

  if (existing && !input.force) {
    if (existing.notif === 'envoyee' || existing.notif === 'a_envoyer') {
      return { scheduled: false }
    }
    // `echec` après max essais : ne pas renvoyer sauf force.
    if (existing.notif === 'echec' && existing.notifEssais >= SURVEILLANCE_NOTIF_MAX_ESSAIS) {
      return { scheduled: false }
    }
  }

  const now = Date.now()
  const plan = input.plan ?? planForType(input.type)
  let eventId: Id<'surveillance_fitness_events'>

  if (existing && input.force) {
    await ctx.db.patch(existing._id, {
      email: input.email,
      plan,
      lastActiveDays: input.lastActiveDays ?? existing.lastActiveDays ?? null,
      actionCount: input.actionCount ?? existing.actionCount ?? null,
      notif: 'a_envoyer',
      notifEssais: 0,
      updatedAt: now,
    })
    eventId = existing._id
  } else if (existing) {
    await ctx.db.patch(existing._id, {
      email: input.email,
      plan,
      lastActiveDays: input.lastActiveDays ?? existing.lastActiveDays ?? null,
      actionCount: input.actionCount ?? existing.actionCount ?? null,
      notif: 'a_envoyer',
      updatedAt: now,
    })
    eventId = existing._id
  } else {
    eventId = await ctx.db.insert('surveillance_fitness_events', {
      userId: input.userId,
      email: input.email,
      type: input.type,
      plan,
      lastActiveDays: input.lastActiveDays ?? null,
      actionCount: input.actionCount ?? null,
      notif: 'a_envoyer',
      notifEssais: 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (hasScheduler(ctx)) {
    await ctx.scheduler.runAfter(0, deliverRef, { eventId })
  }
  return { scheduled: true, eventId }
}

/** Hook inscription (email / Google nouveau compte). */
export async function notifySurveillanceFitnessSignup(
  ctx: MutationCtx,
  input: { userId: string; email: string },
): Promise<void> {
  const type = resolveSignupEventType()
  await scheduleSurveillanceFitnessEvent(ctx, {
    userId: input.userId,
    email: input.email,
    type,
    lastActiveDays: 0,
    actionCount: 0,
    plan: type === 'beta_signup' ? 'beta' : 'free',
  })
}

/** Hook premier scan repas IA réussi (one-shot via table events). */
export async function notifySurveillanceFitnessFirstMealPhotoAi(
  ctx: MutationCtx,
  input: { userId: string; email: string },
): Promise<void> {
  await scheduleSurveillanceFitnessEvent(ctx, {
    userId: input.userId,
    email: input.email,
    type: 'first_meal_photo_ai',
    lastActiveDays: 0,
    actionCount: 1,
    plan: 'free',
  })
}

/**
 * Appelé depuis l’action `mealPhotoAi.analyzeMealPhoto` après un scan réussi.
 * Résout l’email si besoin ; soft no-op si user inconnu.
 */
export const notifyFirstMealPhotoAiInternal = internalMutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let email = args.email?.trim().toLowerCase() || ''
    if (!email) {
      const user = await ctx.db
        .query('auth_users')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .first()
      if (!user || user.deletedAt) return null
      email = user.email
    }
    try {
      await notifySurveillanceFitnessFirstMealPhotoAi(ctx, {
        userId: args.userId,
        email,
      })
    } catch {
      // Soft.
    }
    return null
  },
})

/** Hook première séance sport (activité workout ou sync completed). */
export async function notifySurveillanceFitnessFirstWorkout(
  ctx: MutationCtx,
  input: { userId: string; email: string },
): Promise<void> {
  await scheduleSurveillanceFitnessEvent(ctx, {
    userId: input.userId,
    email: input.email,
    type: 'first_workout',
    lastActiveDays: 0,
    actionCount: 1,
    plan: 'free',
  })
}

export const loadSurveillanceEventForWebhook = internalMutation({
  args: { eventId: v.id('surveillance_fitness_events') },
  returns: v.union(
    v.object({
      type: eventTypeValidator,
      email: v.string(),
      last_active_days: v.union(v.number(), v.null()),
      action_count: v.union(v.number(), v.null()),
      plan: v.union(v.literal('free'), v.literal('beta'), v.literal('unknown')),
      occurred_at: v.string(),
      user_id: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.eventId)
    if (!row) return null
    if (row.notif === 'envoyee') return null
    if (row.notifEssais >= SURVEILLANCE_NOTIF_MAX_ESSAIS) {
      if (row.notif !== 'echec') {
        await ctx.db.patch(args.eventId, { notif: 'echec', updatedAt: Date.now() })
      }
      return null
    }

    const { url, key } = readSurveillanceFitnessWebhookConfig()
    if (!url || !key) {
      console.info(
        '[surveillance-fitness] webhook env incomplete — event kept, notif pending',
      )
      return null
    }

    await ctx.db.patch(args.eventId, {
      notifEssais: row.notifEssais + 1,
      updatedAt: Date.now(),
    })

    return {
      type: row.type,
      email: row.email,
      last_active_days: row.lastActiveDays ?? null,
      action_count: row.actionCount ?? null,
      plan: row.plan,
      occurred_at: toIsoUtcZ(row.createdAt),
      user_id: row.userId,
    } satisfies SurveillanceFitnessWebhookPayload
  },
})

export const markSurveillanceEventSent = internalMutation({
  args: { eventId: v.id('surveillance_fitness_events') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.eventId)
    if (!row) return null
    await ctx.db.patch(args.eventId, {
      notif: 'envoyee',
      updatedAt: Date.now(),
    })
    return null
  },
})

export const markSurveillanceEventFailed = internalMutation({
  args: {
    eventId: v.id('surveillance_fitness_events'),
    scheduleRetry: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.eventId)
    if (!row) return null
    if (row.notifEssais >= SURVEILLANCE_NOTIF_MAX_ESSAIS) {
      await ctx.db.patch(args.eventId, { notif: 'echec', updatedAt: Date.now() })
      return null
    }
    await ctx.db.patch(args.eventId, { notif: 'a_envoyer', updatedAt: Date.now() })
    if (args.scheduleRetry && hasScheduler(ctx)) {
      const delayIndex = Math.min(
        row.notifEssais - 1,
        SURVEILLANCE_NOTIF_RETRY_DELAYS_MS.length - 1,
      )
      const delay =
        SURVEILLANCE_NOTIF_RETRY_DELAYS_MS[Math.max(0, delayIndex)] ??
        SURVEILLANCE_NOTIF_RETRY_DELAYS_MS[0]
      await ctx.scheduler.runAfter(delay, deliverRef, { eventId: args.eventId })
    }
    return null
  },
})

export const deliverSurveillanceFitnessWebhook = internalAction({
  args: { eventId: v.id('surveillance_fitness_events') },
  returns: v.object({ delivered: v.boolean() }),
  handler: async (ctx, args) => {
    const payload = await ctx.runMutation(
      makeFunctionReference<
        'mutation',
        { eventId: Id<'surveillance_fitness_events'> },
        SurveillanceFitnessWebhookPayload | null
      >('surveillanceFitness:loadSurveillanceEventForWebhook'),
      { eventId: args.eventId },
    )
    if (!payload) {
      return { delivered: false }
    }

    const result = await postSurveillanceFitnessWebhook(payload)
    if (!result.configured) {
      // Env absente : ne pas brûler les retries (événement déjà enregistré).
      console.info('[surveillance-fitness] env missing — soft skip')
      return { delivered: false }
    }
    if (result.ok) {
      await ctx.runMutation(
        makeFunctionReference<'mutation', { eventId: Id<'surveillance_fitness_events'> }, null>(
          'surveillanceFitness:markSurveillanceEventSent',
        ),
        { eventId: args.eventId },
      )
      return { delivered: true }
    }
    console.info('[surveillance-fitness] webhook fetch failed', {
      status: result.status,
      error: result.error,
    })
    await ctx.runMutation(
      makeFunctionReference<
        'mutation',
        { eventId: Id<'surveillance_fitness_events'>; scheduleRetry: boolean },
        null
      >('surveillanceFitness:markSurveillanceEventFailed'),
      { eventId: args.eventId, scheduleRetry: true },
    )
    return { delivered: false }
  },
})

/**
 * Test manuel (Studio Manager) : envoie `type=test` pour l’utilisateur de session.
 * Nécessite URL+clé en env Convex.
 */
export const sendTestSurveillanceFitnessWebhook = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireSessionUser(ctx, args.sessionToken)
    const result = await scheduleSurveillanceFitnessEvent(ctx, {
      userId: user.userId,
      email: user.email,
      type: 'test',
      lastActiveDays: 0,
      actionCount: 0,
      plan: 'unknown',
      force: true,
    })
    return { scheduled: result.scheduled }
  },
})

/** Action interne pure (dashboard Convex) — pas de session. */
export const sendTestSurveillanceFitnessWebhookInternal = internalAction({
  args: {
    email: v.string(),
    userId: v.optional(v.string()),
  },
  returns: v.object({
    delivered: v.boolean(),
    configured: v.boolean(),
  }),
  handler: async (_ctx, args) => {
    const payload: SurveillanceFitnessWebhookPayload = {
      type: 'test',
      email: args.email.trim().toLowerCase(),
      last_active_days: 0,
      action_count: 0,
      plan: 'unknown',
      occurred_at: toIsoUtcZ(Date.now()),
      user_id: args.userId?.trim() || undefined,
    }
    const result = await postSurveillanceFitnessWebhook(payload)
    if (!result.configured) {
      console.info('[surveillance-fitness] test skipped — env incomplete')
    }
    return { delivered: result.ok, configured: result.configured }
  },
})

/**
 * Cron churn : utilisateurs sans activité depuis SURVEILLANCE_FITNESS_CHURN_DAYS.
 * Activité = max(updatedAt profiles / workouts / nutrition / streak / dernière session).
 */
export const scanSurveillanceFitnessChurn = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({ scanned: v.number(), scheduled: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const limit = Math.min(200, Math.max(1, args.limit ?? 80))
    const thresholdMs = SURVEILLANCE_FITNESS_CHURN_DAYS * 24 * 60 * 60 * 1000
    const users = await ctx.db.query('auth_users').take(limit * 3)

    let scanned = 0
    let scheduled = 0
    for (const user of users) {
      if (user.deletedAt) continue
      scanned += 1
      if (scanned > limit) break

      const already = await ctx.db
        .query('surveillance_fitness_events')
        .withIndex('by_userId_type', (q) => q.eq('userId', user.userId).eq('type', 'churn'))
        .first()
      if (already && (already.notif === 'envoyee' || already.notif === 'a_envoyer')) {
        continue
      }

      let lastActive = user.updatedAt || user.createdAt
      const profile = await ctx.db
        .query('profiles')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .first()
      if (profile?.updatedAt) lastActive = Math.max(lastActive, profile.updatedAt)
      const workouts = await ctx.db
        .query('workouts_state')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .first()
      if (workouts?.updatedAt) lastActive = Math.max(lastActive, workouts.updatedAt)
      const nutrition = await ctx.db
        .query('nutrition_state')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .first()
      if (nutrition?.updatedAt) lastActive = Math.max(lastActive, nutrition.updatedAt)
      const streak = await ctx.db
        .query('streak_state')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .first()
      if (streak?.updatedAt) lastActive = Math.max(lastActive, streak.updatedAt)
      const sessions = await ctx.db
        .query('auth_sessions')
        .withIndex('by_userId', (q) => q.eq('userId', user.userId))
        .collect()
      for (const s of sessions) {
        if (typeof s.createdAt === 'number') lastActive = Math.max(lastActive, s.createdAt)
        if (typeof s.expiresAt === 'number') {
          // Approximation : session encore valide ⇒ actif récemment.
          if (s.expiresAt > now) lastActive = Math.max(lastActive, now)
        }
      }

      if (now - lastActive < thresholdMs) continue

      const result = await scheduleSurveillanceFitnessEvent(ctx, {
        userId: user.userId,
        email: user.email,
        type: 'churn',
        lastActiveDays: daysSince(lastActive, now),
        actionCount: null,
        plan: 'free',
      })
      if (result.scheduled) scheduled += 1
    }
    return { scanned, scheduled }
  },
})

/**
 * Ops / Studio Manager : force le schedule d’un event (ex. backfill first_workout).
 * `force: true` réarme même si déjà envoyé / en cours.
 */
export const forceScheduleSurveillanceEventInternal = internalMutation({
  args: {
    userId: v.string(),
    email: v.string(),
    type: eventTypeValidator,
    lastActiveDays: v.optional(v.union(v.number(), v.null())),
    actionCount: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await scheduleSurveillanceFitnessEvent(ctx, {
      userId: args.userId,
      email: args.email.trim().toLowerCase(),
      type: args.type,
      lastActiveDays: args.lastActiveDays ?? 0,
      actionCount: args.actionCount ?? 1,
      plan: 'free',
      force: true,
    })
    return { scheduled: result.scheduled }
  },
})
