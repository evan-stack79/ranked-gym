import { api as generatedApi } from '../../convex/_generated/api'
import { isConvexConfigured, getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import { safeError } from '../utils/safeLog'

// Aligné sur mealPhotoAi — codegen local peut être en retard sur les modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = generatedApi as any

export type RankedIntelligenceSuccess = {
  ok: true
  source: 'ai' | 'math_fallback'
  message: string
  aiCallsToday: number
  dailyLimit: number
  remaining: number
  leanMassKg: number | null
  ffmi: number | null
}

export type RankedIntelligenceFailure = {
  ok: false
  error: string
  code: string
}

export type RankedIntelligenceResult = RankedIntelligenceSuccess | RankedIntelligenceFailure

export const RANKED_INTELLIGENCE_DEFAULT_QUESTION =
  'Analyse ma progression actuelle et dis-moi quoi bosser cette semaine.'

/**
 * Appelle `ai.askRankedIntelligence` avec la session Convex (jamais un userId client).
 */
export async function askRankedIntelligence(
  question: string = RANKED_INTELLIGENCE_DEFAULT_QUESTION,
): Promise<RankedIntelligenceResult> {
  if (!isConvexConfigured()) {
    return {
      ok: false,
      error: 'Convex non configuré — impossible d’appeler le coach IA.',
      code: 'CONVEX_NOT_CONFIGURED',
    }
  }

  const sessionToken = await getConvexSessionToken()
  if (!sessionToken) {
    return {
      ok: false,
      error: 'Session expirée — reconnecte-toi puis réessaie.',
      code: 'AUTH_REQUIRED',
    }
  }

  try {
    const raw = (await getConvex().action(api.ai.askRankedIntelligence, {
      sessionToken,
      question: question.trim().slice(0, 800),
    })) as RankedIntelligenceResult

    if (!raw || typeof raw !== 'object' || !('ok' in raw)) {
      return { ok: false, error: 'Réponse IA invalide.', code: 'AI_INVALID' }
    }
    return raw
  } catch (error) {
    safeError('[rankedIntelligence] askRankedIntelligence failed', error)
    return {
      ok: false,
      error: 'Impossible de joindre le coach IA — réessaie.',
      code: 'AI_CLIENT_ERROR',
    }
  }
}
