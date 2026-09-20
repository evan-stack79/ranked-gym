import { describe, expect, it } from 'vitest'
import { convexTables } from '../../convex/schema.ts'
import {
  getActiveCloudBackend,
  getCloudBackendAdapter,
  getRequestedCloudBackend,
} from './adapter'
import {
  getActiveAuthBackend,
  getRequestedAuthBackend,
  isConvexAuthEnabled,
} from './authFeatureFlag'
import { isConvexPrimaryEnabled, parseBooleanFlag } from './featureFlag'
import { getConvexConfigError, isConvexConfigured } from '../lib/convex'

const PHASE_E_TABLES = [
  'auth_users',
  'auth_password_credentials',
  'auth_sessions',
  'auth_password_reset_tokens',
  'auth_password_reset_outbox',
  'auth_private_notes',
  'rate_limit_buckets',
  'profiles',
  'workouts_state',
  'nutrition_state',
  'sleep_nights',
  'checkins',
  'custom_spots',
  'active_checkins',
  'aliments',
  'activities',
  'ai_usage_limits',
  'streak_state',
  'user_files',
  'migration_runs',
  'migration_entity_map',
  'legacy_supabase_backups',
  'user_blocks',
  'user_follows',
  'activity_comments',
  'activity_reactions',
] as const

describe('Convex Phase A feature flag', () => {
  it('treats only explicit true-ish values as enabled', () => {
    expect(parseBooleanFlag(undefined)).toBe(false)
    expect(parseBooleanFlag('')).toBe(false)
    expect(parseBooleanFlag('false')).toBe(false)
    expect(parseBooleanFlag('true')).toBe(true)
    expect(parseBooleanFlag('1')).toBe(true)
    expect(parseBooleanFlag('YES')).toBe(true)
  })

  it('defaults Convex primary to off in this environment', () => {
    expect(isConvexPrimaryEnabled()).toBe(false)
  })

  it('defaults Convex auth to off in this environment', () => {
    expect(isConvexAuthEnabled()).toBe(false)
    expect(isConvexAuthEnabled('YES')).toBe(true)
    expect(getRequestedAuthBackend()).toBe('supabase')
    expect(getActiveAuthBackend()).toBe('supabase')
  })
})

describe('cloud backend adapter', () => {
  it('keeps Supabase as the active runtime when Convex is not configured', () => {
    expect(getRequestedCloudBackend()).toBe('supabase')
    expect(getActiveCloudBackend()).toBe('supabase')
    const adapter = getCloudBackendAdapter()
    expect(adapter.active).toBe('supabase')
    expect(adapter.requested).toBe('supabase')
    expect(adapter.convexConfigured).toBe(false)
  })

  it('does not treat an empty Convex URL as configured', () => {
    expect(isConvexConfigured()).toBe(false)
    expect(getConvexConfigError()).toMatch(/VITE_CONVEX_URL|Convex/)
  })
})

describe('Convex schema contract', () => {
  it('declares every Phase E auth + Phase A domain table from the migration plan', () => {
    expect(Object.keys(convexTables).sort()).toEqual([...PHASE_E_TABLES].sort())
  })
})
