import type { MutationCtx } from '../_generated/server'
import { hashToken } from './authCrypto'

/**
 * Server-side fixed-window rate limits for abuse-prone Convex mutations.
 *
 * Thresholds are conservative so legitimate retries (typos, flaky mobile
 * networks, a few avatar retakes) recover after the window elapses.
 * Keys are SHA-256 of `policy|kind|value` — never raw email, password, token, or IP.
 *
 * | Policy                 | Limit | Window | Subject          |
 * |------------------------|------:|-------:|------------------|
 * | signInEmail            |    10 | 15 min | hashed emailNorm |
 * | signUpEmail            |     5 | 60 min | hashed emailNorm |
 * | passwordResetRequest   |     5 | 15 min | hashed emailNorm |
 * | passwordResetConsume   |     8 | 15 min | hashed token     |
 * | sessionCreate          |    20 | 15 min | hashed userId    |
 * | changePassword         |     8 | 15 min | hashed userId    |
 * | deleteAccount          |     8 | 15 min | hashed userId    |
 * | avatarUploadUrl        |    20 | 15 min | hashed userId    |
 * | avatarCommit           |    20 | 15 min | hashed userId    |
 * | adminResetCampaign     |     8 | 60 min | hashed admin id  |
 * | createCheckin          |    40 | 15 min | hashed userId    |
 * | recordActivity         |    60 | 15 min | hashed userId    |
 *
 * Convex mutations do not receive client IP. Optional `ip` subjects are hashed
 * the same way when a trusted caller supplies one (HTTP action / edge).
 */
export const RATE_LIMITED_ERROR = 'RATE_LIMITED'

export const RATE_LIMIT_USER_MESSAGE =
  'Trop de tentatives. Réessaie dans quelques minutes.'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

export const RATE_LIMIT_POLICIES = {
  signInEmail: { limit: 10, windowMs: 15 * MINUTE_MS },
  signUpEmail: { limit: 5, windowMs: HOUR_MS },
  passwordResetRequest: { limit: 5, windowMs: 15 * MINUTE_MS },
  passwordResetConsume: { limit: 8, windowMs: 15 * MINUTE_MS },
  sessionCreate: { limit: 20, windowMs: 15 * MINUTE_MS },
  changePassword: { limit: 8, windowMs: 15 * MINUTE_MS },
  deleteAccount: { limit: 8, windowMs: 15 * MINUTE_MS },
  avatarUploadUrl: { limit: 20, windowMs: 15 * MINUTE_MS },
  avatarCommit: { limit: 20, windowMs: 15 * MINUTE_MS },
  adminResetCampaign: { limit: 8, windowMs: HOUR_MS },
  createCheckin: { limit: 40, windowMs: 15 * MINUTE_MS },
  recordActivity: { limit: 60, windowMs: 15 * MINUTE_MS },
} as const

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES

export type RateLimitSubjectKind = 'email' | 'userId' | 'token' | 'admin' | 'ip'

export type RateLimitSubject = {
  kind: RateLimitSubjectKind
  value: string
}

function normalizeSubjectValue(kind: RateLimitSubjectKind, value: string): string {
  const trimmed = value.trim()
  if (kind === 'email') return trimmed.toLowerCase()
  if (kind === 'ip') return trimmed.toLowerCase()
  return trimmed
}

/** SHA-256 / base64url. Output never contains the raw subject value. */
export async function hashRateLimitKey(
  policy: string,
  kind: RateLimitSubjectKind,
  value: string,
): Promise<string> {
  const normalized = normalizeSubjectValue(kind, value)
  return hashToken(`${policy}|${kind}|${normalized}`)
}

function logThrottled(policy: RateLimitPolicyName, keyHash: string): void {
  console.info('[rate-limit] throttled', {
    policy,
    keyPrefix: keyHash.slice(0, 8),
  })
}

export async function consumeRateLimit(
  ctx: MutationCtx,
  policyName: RateLimitPolicyName,
  subject: RateLimitSubject,
  now = Date.now(),
): Promise<void> {
  const policy = RATE_LIMIT_POLICIES[policyName]
  const keyHash = await hashRateLimitKey(policyName, subject.kind, subject.value)
  const existing = await ctx.db
    .query('rate_limit_buckets')
    .withIndex('by_keyHash', (q) => q.eq('keyHash', keyHash))
    .first()

  if (!existing || now - existing.windowStartedAt >= policy.windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, {
        windowStartedAt: now,
        count: 1,
        updatedAt: now,
      })
      return
    }
    await ctx.db.insert('rate_limit_buckets', {
      keyHash,
      policy: policyName,
      windowStartedAt: now,
      count: 1,
      updatedAt: now,
    })
    return
  }

  if (existing.count >= policy.limit) {
    logThrottled(policyName, keyHash)
    throw new Error(RATE_LIMITED_ERROR)
  }

  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
    updatedAt: now,
  })
}
