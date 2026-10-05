import { M_INFO_1, Q8_SCREEN_TITLE } from '../../content/safetyCopy'

interface SafetyNoteProps {
  /** Ouvre l’écran « Besoin d’en parler ? ». Si omis, seul le texte M_INFO_1 est affiché. */
  onNeedToTalk?: () => void
  /** data-testid du bouton de lien (défaut dashboard). */
  talkTestId?: string
}

/**
 * Affichage unique et sobre du repère de sécurité nutrition (M_INFO_1).
 * Petite taille, couleur atténuée — pas de bandeau / carte.
 */
export function SafetyNote({
  onNeedToTalk,
  talkTestId = 'dashboard-need-to-talk',
}: SafetyNoteProps) {
  return (
    <div className="mt-2 space-y-1.5 px-1" data-testid="safety-note">
      <p className="text-[11px] leading-relaxed text-[#636366]">{M_INFO_1}</p>
      {onNeedToTalk ? (
        <button
          type="button"
          onClick={onNeedToTalk}
          className="ios-press text-[12px] font-medium text-[#64D2FF] underline"
          data-testid={talkTestId}
        >
          {Q8_SCREEN_TITLE}
        </button>
      ) : null}
    </div>
  )
}
