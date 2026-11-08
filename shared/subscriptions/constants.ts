/**
 * Ranked Pro Solo v0 — valeurs figées (SPEC_ABONNEMENT_PRO + ARCHI §1.1 / §12).
 * Identifiants store définitifs après création des comptes vendeurs.
 */

export const PRO_MIN_AGE_YEARS = 15

/** Offre Solo unique v0 — Duo/Squad = P1, non vendus. */
export const PRO_PLAN = 'solo' as const
export const PRO_SEAT_LIMIT = 1

export const PRO_OFFERS = {
  monthly: {
    key: 'solo_monthly',
    billingPeriod: 'month',
    productIdApple: 'ranked.pro.solo.monthly',
    productIdGoogle: 'ranked.pro.solo',
    basePlanIdGoogle: 'monthly',
    priceEurosDisplay: '9,99 €',
    periodLabel: 'mois',
  },
  yearly: {
    key: 'solo_yearly',
    billingPeriod: 'year',
    productIdApple: 'ranked.pro.solo.yearly',
    productIdGoogle: 'ranked.pro.solo',
    basePlanIdGoogle: 'yearly',
    priceEurosDisplay: '89,99 €',
    periodLabel: 'an',
    /** 89,99 ÷ 12 = 7,499 → afficher 7,50 (SPEC PRO-P02). */
    monthlyEquivalentEurosDisplay: '7,50 €',
  },
} as const

export type ProOfferKey = (typeof PRO_OFFERS)[keyof typeof PRO_OFFERS]['key']

export const PRO_TRIAL_DAYS = 14

/**
 * Grâce Apple choisie Evan/Studio via ARCHI §12 : 16 jours.
 * Le code lit toujours `gracePeriodExpiresDate` / subscriptionsv2 — ne jamais inventer une fin.
 */
export const PRO_GRACE_DAYS_CONFIGURED_APPLE = 16

/** Partage familial Apple désactivé en v0 (ARCHI §12.1 décision 5). */
export const PRO_FAMILY_SHARING_ENABLED = false

/** Rappel fin d’essai : J−2 (ARCHI §12 + brief). */
export const PRO_TRIAL_END_REMINDER_DAYS_BEFORE = 2

/** Rappel reconduction annuelle ~30 j (PRO-P05). */
export const PRO_ANNUAL_RENEWAL_REMINDER_DAYS_BEFORE = 30

/**
 * Date limite annonce asso (PRO-D03) — provisoire tant qu’Evan n’a pas fixé.
 * Ambiguïté tranchée prudemment : 31/12/2026, à confirmer.
 */
export const PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY = '31/12/2026'

export const PRO_LEGAL_TEXT_VERSION_L05 = 'juriste-2026-11-08-l05'
export const PRO_LEGAL_TEXT_VERSION_L05B = 'juriste-2026-11-08-l05b'
export const PRO_CGV_VERSION = 'draft-pro-v0'

export const SUBSCRIPTION_SOURCES = ['apple', 'google', 'admin'] as const
export type SubscriptionSource = (typeof SUBSCRIPTION_SOURCES)[number]

export const SUBSCRIPTION_ENVIRONMENTS = ['production', 'sandbox', 'local_test'] as const
export type SubscriptionEnvironment = (typeof SUBSCRIPTION_ENVIRONMENTS)[number]

export const SUBSCRIPTION_CHAIN_STATUSES = [
  'pending',
  'trial',
  'active',
  'canceled_active_until',
  'grace',
  'suspended',
  'expired',
  'refunded',
  'revoked',
] as const
export type SubscriptionChainStatus = (typeof SUBSCRIPTION_CHAIN_STATUSES)[number]

export const SUBSCRIPTION_ACCESS_STATES = [
  'free',
  ...SUBSCRIPTION_CHAIN_STATUSES,
] as const
export type SubscriptionAccessState = (typeof SUBSCRIPTION_ACCESS_STATES)[number]
