import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireSessionUser } from './auth'
import { hashToken } from './authCrypto'

export const MIGRATION_ADMIN_SECRET_ENV = 'MIGRATION_ADMIN_SECRET'
export const MIN_MIGRATION_RUN_SECRET_LENGTH = 16
export const ADMIN_ROLE = 'admin' as const

export const MIGRATION_ADMIN_ERRORS = {
  unauthenticated: 'Not authenticated',
  forbidden: 'MIGRATION_ADMIN_FORBIDDEN',
  runNotFound: 'MIGRATION_RUN_NOT_FOUND',
  sourceShaMismatch: 'MIGRATION_SOURCE_SHA_MISMATCH',
  runSecretInvalid: 'MIGRATION_RUN_SECRET_INVALID',
  runSecretWeak: 'MIGRATION_RUN_SECRET_WEAK',
} as const

type AdminCtx = QueryCtx | MutationCtx

export type AdminAuthz = {
  adminSecret?: string
  sessionToken?: string
}

export type AdminCaller = {
  via: 'secret' | 'session'
  userId?: string
}

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function trimToEmpty(value: string | undefined): string {
  return value?.trim() ?? ''
}

function constantTimeEqualStrings(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let diff = 0
  for (let i = 0; i < leftBytes.length; i += 1) {
    diff |= leftBytes[i] ^ rightBytes[i]
  }
  return diff === 0
}

export async function hashMigrationSecret(secret: string): Promise<string> {
  return hashToken(secret)
}

export function assertRunSecretStrength(runSecret: string): void {
  if (trimToEmpty(runSecret).length < MIN_MIGRATION_RUN_SECRET_LENGTH) {
    throw new Error(MIGRATION_ADMIN_ERRORS.runSecretWeak)
  }
}

async function requireConfiguredAdminSecret(presented: string): Promise<void> {
  const expected = trimToEmpty(readEnv(MIGRATION_ADMIN_SECRET_ENV))
  if (!expected) {
    throw new Error(MIGRATION_ADMIN_ERRORS.forbidden)
  }
  const [presentedHash, expectedHash] = await Promise.all([
    hashMigrationSecret(presented),
    hashMigrationSecret(expected),
  ])
  if (!constantTimeEqualStrings(presentedHash, expectedHash)) {
    throw new Error(MIGRATION_ADMIN_ERRORS.forbidden)
  }
}

/**
 * Server-side admin gate. Callers must present either:
 * - `adminSecret` matching Convex env `MIGRATION_ADMIN_SECRET`, or
 * - a valid session whose `auth_users.role` is `admin`.
 *
 * Missing credentials fail as unauthenticated. A normal user session is forbidden.
 */
export async function requireAdminCaller(ctx: AdminCtx, authz: AdminAuthz): Promise<AdminCaller> {
  const adminSecret = trimToEmpty(authz.adminSecret)
  const sessionToken = trimToEmpty(authz.sessionToken)
  if (!adminSecret && !sessionToken) {
    throw new Error(MIGRATION_ADMIN_ERRORS.unauthenticated)
  }
  if (adminSecret) {
    await requireConfiguredAdminSecret(adminSecret)
    return { via: 'secret' }
  }
  const user = await requireSessionUser(ctx, sessionToken)
  if (user.role !== ADMIN_ROLE) {
    throw new Error(MIGRATION_ADMIN_ERRORS.forbidden)
  }
  return { via: 'session', userId: user.userId }
}

export async function requireAuthorizedMigrationRun(
  ctx: AdminCtx,
  args: {
    runId: string
    runSecret: string
    sourceSha?: string
  },
) {
  const run = await ctx.db
    .query('migration_runs')
    .withIndex('by_runId', (q) => q.eq('runId', args.runId))
    .first()
  if (!run) {
    throw new Error(MIGRATION_ADMIN_ERRORS.runNotFound)
  }
  if (args.sourceSha != null && args.sourceSha !== '' && run.sourceSha !== args.sourceSha) {
    throw new Error(MIGRATION_ADMIN_ERRORS.sourceShaMismatch)
  }
  const storedHash = run.adminSecretHash
  if (!storedHash) {
    throw new Error(MIGRATION_ADMIN_ERRORS.runSecretInvalid)
  }
  const presentedHash = await hashMigrationSecret(args.runSecret)
  if (!constantTimeEqualStrings(presentedHash, storedHash)) {
    throw new Error(MIGRATION_ADMIN_ERRORS.runSecretInvalid)
  }
  return run
}
