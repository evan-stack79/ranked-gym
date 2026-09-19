import { isNetworkAuthError } from './authErrors'

export type FoodSearchErrorKind =
  | 'offline'
  | 'service_down'
  | 'timeout'
  | 'parse'
  | 'unknown'

export type FoodSearchError = {
  kind: FoodSearchErrorKind
  message: string
  retryable: boolean
}

const OFFLINE_MSG = 'Hors ligne. Vérifie ta connexion puis réessaie.'
const SERVICE_MSG = 'Recherche alimentaire indisponible. Réessaie dans un instant.'
const TIMEOUT_MSG = 'La recherche a pris trop de temps. Réessaie.'
const PARSE_MSG = 'Réponse invalide du service alimentaire. Réessaie.'
const UNKNOWN_MSG = 'Recherche impossible. Réessaie.'

/**
 * Mappe toute erreur fetch/parse OFF → message FR stable.
 * Jamais de « Load failed » / TypeError brut dans l’UI.
 */
export function mapFoodSearchError(err: unknown): FoodSearchError {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { kind: 'offline', message: OFFLINE_MSG, retryable: true }
  }

  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { kind: 'timeout', message: TIMEOUT_MSG, retryable: true }
  }

  if (
    lower.includes('json') ||
    lower.includes('unexpected token') ||
    lower.includes('syntaxerror') ||
    lower.includes('invalid response')
  ) {
    return { kind: 'parse', message: PARSE_MSG, retryable: true }
  }

  if (
    isNetworkAuthError(err) ||
    lower.includes('load failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network')
  ) {
    return { kind: 'offline', message: OFFLINE_MSG, retryable: true }
  }

  if (
    lower.includes('indisponible') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('429') ||
    lower.includes('open food facts')
  ) {
    return { kind: 'service_down', message: SERVICE_MSG, retryable: true }
  }

  // Ne jamais remonter le message navigateur brut (ex. Safari « Load failed »).
  if (/load failed|failed to fetch|networkerror/i.test(raw)) {
    return { kind: 'offline', message: OFFLINE_MSG, retryable: true }
  }

  return { kind: 'unknown', message: UNKNOWN_MSG, retryable: true }
}

export function foodSearchErrorMessage(err: unknown): string {
  return mapFoodSearchError(err).message
}
