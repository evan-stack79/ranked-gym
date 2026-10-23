import { useState } from 'react'
import { Zap } from 'lucide-react'
import { isConvexConfigured } from '../../lib/convex'
import {
  askRankedIntelligence,
  RANKED_INTELLIGENCE_DEFAULT_QUESTION,
} from '../../services/rankedIntelligenceService'
import { safeError } from '../../utils/safeLog'

/**
 * Coach IA hybride — appelle `api.ai.askRankedIntelligence` via sessionToken
 * (jamais un userId client). Masqué si Convex n’est pas configuré.
 *
 * Note: on n’utilise pas `useAction` ici — l’auth Ranked Gym passe par
 * `sessionToken` + `getConvex().action`, comme mealPhotoAi.
 */
export function RankedCoach() {
  if (!isConvexConfigured()) return null
  return <RankedCoachInner />
}

function RankedCoachInner() {
  const [response, setResponse] = useState('')
  const [meta, setMeta] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleTestAI = async () => {
    setLoading(true)
    setMeta(null)
    try {
      const result = await askRankedIntelligence(RANKED_INTELLIGENCE_DEFAULT_QUESTION)

      if (result.ok) {
        setResponse(result.message)
        const sourceLabel =
          result.source === 'math_fallback' ? 'bilan mathématique (quota)' : 'coach IA'
        setMeta(
          `${sourceLabel} · ${result.aiCallsToday}/${result.dailyLimit} · reste ${result.remaining}`,
        )
      } else {
        setResponse(result.error)
      }
    } catch (error) {
      safeError('[RankedCoach] askRankedIntelligence', error)
      setResponse('Erreur lors de l’appel à l’IA.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      className="glass-card space-y-4 rounded-2xl p-5"
      data-testid="ranked-coach"
      aria-label="Ranked Intelligence"
    >
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-[#FF2B2B]" strokeWidth={2.25} aria-hidden />
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-white">
          Ranked Intelligence
        </h2>
      </div>

      <p className="text-[13px] leading-relaxed text-[#8E8E93]">
        Coach biométrique : calculs déterministes (masse maigre, FFMI) + Cloudflare Workers AI.
        Quota gratuit : 3 bilans IA / jour.
      </p>

      <button
        type="button"
        onClick={() => void handleTestAI()}
        disabled={loading}
        className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        {loading ? 'Calculs biométriques & appel IA…' : 'Lancer le bilan IA'}
      </button>

      {response ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-[13px] leading-relaxed text-[#E5E5EA]">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#FF6961]">
            Diagnostic
          </p>
          <p className="whitespace-pre-wrap">{response}</p>
          {meta ? <p className="mt-3 text-[11px] text-[#636366]">{meta}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
