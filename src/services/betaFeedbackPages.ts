/** Pages proposées dans le sélecteur (libellés FR visibles). */
export const BETA_FEEDBACK_PAGES = [
  'Accueil',
  'Train',
  'Séance en cours',
  'Fin de séance',
  'Nutrition',
  'Profil',
  'Réglages',
  'Historique',
  'Autre',
] as const

export type BetaFeedbackPage = (typeof BETA_FEEDBACK_PAGES)[number]

export const BETA_FEEDBACK_PAGE_SESSION_END: BetaFeedbackPage = 'Fin de séance'

export function isBetaFeedbackPage(value: string): value is BetaFeedbackPage {
  return (BETA_FEEDBACK_PAGES as readonly string[]).includes(value)
}
