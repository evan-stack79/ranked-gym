import { isConvexDomainActive } from './adapter'

type DomainBackendPlan<T> = {
  operation: string
  convex: () => Promise<T>
  supabase: () => Promise<T>
}

type BackendFailureCode =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'config'
  | 'forbidden'
  | 'not_found'
  | 'unknown'

const DIAGNOSTIC_FLAG = import.meta.env.VITE_ENABLE_BACKEND_DIAGNOSTICS
const BACKEND_DIAGNOSTICS_ENABLED =
  import.meta.env.DEV &&
  typeof DIAGNOSTIC_FLAG === 'string' &&
  ['1', 'true', 'yes'].includes(DIAGNOSTIC_FLAG.trim().toLowerCase())

function classifyFailure(error: unknown): BackendFailureCode {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('timeout')) return 'timeout'
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
    return 'network'
  }
  if (lower.includes('auth') || lower.includes('session') || lower.includes('token')) return 'auth'
  if (lower.includes('forbidden') || lower.includes('rls')) return 'forbidden'
  if (lower.includes('not found') || lower.includes('404')) return 'not_found'
  if (lower.includes('config') || lower.includes('missing') || lower.includes('invalid')) {
    return 'config'
  }
  return 'unknown'
}

function logBackendDiagnostic(event: {
  domain: string
  firstBackend: 'convex' | 'supabase'
  convexSucceeded: boolean
  fallbackActivated: boolean
  fallbackCause?: BackendFailureCode
}) {
  if (!BACKEND_DIAGNOSTICS_ENABLED) return
  // Dev-only operational diagnostics. Never include payloads or user data.
  console.info('[backend-diagnostic]', event)
}

function convexFailureMessage(code: BackendFailureCode): string {
  switch (code) {
    case 'network':
    case 'timeout':
      return 'Service temporairement indisponible — réessaie dans quelques instants.'
    case 'auth':
      return 'Session expirée — reconnecte-toi puis réessaie.'
    case 'config':
      return 'Configuration service invalide — contacte le support.'
    case 'forbidden':
      return 'Accès refusé pour cette action.'
    case 'not_found':
      return 'Service introuvable pour cette action.'
    default:
      return 'Erreur de service — réessaie dans quelques instants.'
  }
}

/**
 * Centralized backend routing for business services:
 * - Convex primary when enabled/configured.
 * - No Supabase fallback when Convex is active (avoids dual-write divergence).
 */
export async function runWithDomainBackend<T>(plan: DomainBackendPlan<T>): Promise<T> {
  if (!isConvexDomainActive()) {
    try {
      const result = await plan.supabase()
      logBackendDiagnostic({
        domain: plan.operation,
        firstBackend: 'supabase',
        convexSucceeded: false,
        fallbackActivated: false,
      })
      return result
    } catch (error) {
      logBackendDiagnostic({
        domain: plan.operation,
        firstBackend: 'supabase',
        convexSucceeded: false,
        fallbackActivated: false,
        fallbackCause: classifyFailure(error),
      })
      throw error
    }
  }
  try {
    const result = await plan.convex()
    logBackendDiagnostic({
      domain: plan.operation,
      firstBackend: 'convex',
      convexSucceeded: true,
      fallbackActivated: false,
    })
    return result
  } catch (error) {
    const fallbackCause = classifyFailure(error)
    logBackendDiagnostic({
      domain: plan.operation,
      firstBackend: 'convex',
      convexSucceeded: false,
      fallbackActivated: false,
      fallbackCause,
    })

    const wrapped = new Error(convexFailureMessage(fallbackCause))
    wrapped.name = 'ConvexPrimaryError'
    ;(wrapped as Error & { cause?: unknown }).cause = error
    throw wrapped
  }
}
