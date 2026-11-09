import { ChevronLeft } from 'lucide-react'
import { proD02EngagementText, PRO_PAGE_ENGAGEMENT_TITLE } from '../../../shared/subscriptions/legalCopy'
import { PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY } from '../../../shared/subscriptions/constants'

interface EngagementSixPercentPageProps {
  onBack: () => void
}

/**
 * Page dédiée PRO-D02…D07 — PAS sur le paywall tant qu’aucune asso n’est choisie.
 * Interdit (PRO-D05/D06) : collecte joueur, formulations fiscales, argument 6 % sur l’achat.
 */
export function EngagementSixPercentPage({ onBack }: EngagementSixPercentPageProps) {
  const text = proD02EngagementText(PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY)

  return (
    <div className="flex min-h-full flex-col gap-5 pb-10 ios-fade-up">
      <header className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full text-white"
          aria-label="Retour"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[20px] font-bold text-white">{PRO_PAGE_ENGAGEMENT_TITLE}</h1>
      </header>

      <p className="text-[15px] leading-relaxed text-[#E5E5EA]">{text}</p>

      <p className="text-[13px] leading-snug text-[#ACB4BA]">
        Les montants versés seront publiés ici chaque trimestre. Aucune collecte auprès des
        utilisateurs dans l’app.
      </p>
    </div>
  )
}
