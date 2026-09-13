import { describe, expect, it } from 'vitest'
import { convexTables } from '../../convex/schema.ts'
import {
  getActiveCloudBackend,
  getCloudBackendAdapter,
  getRequestedCloudBackend,
} from './adapter'
import { isConvexPrimaryEnabled, parseBooleanFlag } from './featureFlag'
import { getConvexConfigError, isConvexConfigured } from '../lib/convex'

const PHASE_A_TABLES = [
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
})

describe('cloud backend adapter', () => {
  it('keeps Supabase as the active runtime even if Convex is requested later', () => {
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
  it('declares every Phase A domain / bookkeeping table from the Codex plan', () => {
    expect(Object.keys(convexTables).sort()).toEqual([...PHASE_A_TABLES].sort())
  })
})
