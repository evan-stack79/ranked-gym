import type { MutationCtx } from '../_generated/server'
import {
  PRO_ANNUAL_RENEWAL_REMINDER_DAYS_BEFORE,
  PRO_TRIAL_END_REMINDER_DAYS_BEFORE,
} from '../../shared/subscriptions/constants'

/**
 * Planifie / déduplique rappels (essai J−2, annuel J−30).
 */
export async function upsertReminder(
  ctx: MutationCtx,
  args: {
    userId: string
    kind: 'trial_end_j2' | 'annual_renewal_j30'
    periodKey: string
    fireAt: number
    channel?: 'local_push' | 'email' | 'in_app'
  },
  now = Date.now(),
) {
  const existing = await ctx.db
    .query('subscriptionReminderOutbox')
    .withIndex('by_user_kind_period', (q) =>
      q.eq('userId', args.userId).eq('kind', args.kind).eq('periodKey', args.periodKey),
    )
    .first()
  if (existing) {
    if (existing.status === 'sent') return existing._id
    await ctx.db.patch(existing._id, {
      fireAt: args.fireAt,
      status: args.fireAt <= now ? 'cancelled' : 'scheduled',
      updatedAt: now,
      channel: args.channel ?? existing.channel,
    })
    return existing._id
  }
  if (args.fireAt <= now) return null
  return await ctx.db.insert('subscriptionReminderOutbox', {
    userId: args.userId,
    kind: args.kind,
    periodKey: args.periodKey,
    fireAt: args.fireAt,
    status: 'scheduled',
    channel: args.channel ?? (args.kind === 'annual_renewal_j30' ? 'email' : 'local_push'),
    createdAt: now,
    updatedAt: now,
  })
}

export async function scheduleTrialAndAnnualReminders(
  ctx: MutationCtx,
  args: {
    userId: string
    storeChainKey: string
    billingPeriod: 'month' | 'year'
    trialEndsAt?: number
    periodEndsAt?: number
    isTrial: boolean
  },
  now = Date.now(),
) {
  if (args.isTrial && args.trialEndsAt) {
    await upsertReminder(ctx, {
      userId: args.userId,
      kind: 'trial_end_j2',
      periodKey: `${args.storeChainKey}:trial:${args.trialEndsAt}`,
      fireAt: args.trialEndsAt - PRO_TRIAL_END_REMINDER_DAYS_BEFORE * 86400000,
      channel: 'local_push',
    }, now)
  }
  if (args.billingPeriod === 'year' && args.periodEndsAt) {
    await upsertReminder(ctx, {
      userId: args.userId,
      kind: 'annual_renewal_j30',
      periodKey: `${args.storeChainKey}:year:${args.periodEndsAt}`,
      fireAt: args.periodEndsAt - PRO_ANNUAL_RENEWAL_REMINDER_DAYS_BEFORE * 86400000,
      channel: 'email',
    }, now)
  }
}

export async function dueReminders(
  ctx: MutationCtx,
  now = Date.now(),
  limit = 50,
) {
  const scheduled = await ctx.db
    .query('subscriptionReminderOutbox')
    .withIndex('by_status_fireAt', (q) => q.eq('status', 'scheduled'))
    .collect()
  return scheduled.filter((r) => r.fireAt <= now).slice(0, limit)
}
