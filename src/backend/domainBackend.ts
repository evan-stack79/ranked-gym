import { isSupabaseConfigured } from '../lib/supabase'
import { safeWarn } from '../utils/safeLog'
import { isConvexDomainActive } from './adapter'

type DomainBackendPlan<T> = {
  operation: string
  convex: () => Promise<T>
  supabase: () => Promise<T>
  allowSupabaseFallback?: boolean
}

/**
 * Centralized backend routing for business services:
 * - Convex primary when enabled/configured.
 * - Controlled Supabase fallback during migration on Convex runtime failure.
 */
export async function runWithDomainBackend<T>(plan: DomainBackendPlan<T>): Promise<T> {
  if (!isConvexDomainActive()) {
    return plan.supabase()
  }
  try {
    return await plan.convex()
  } catch (error) {
    const canFallback = plan.allowSupabaseFallback !== false && isSupabaseConfigured()
    if (!canFallback) throw error
    safeWarn(`[backend:${plan.operation}] convex failed, fallback supabase`, error)
    return plan.supabase()
  }
}
