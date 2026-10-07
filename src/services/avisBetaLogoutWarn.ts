import { BETA_FEEDBACK_LOGOUT_QUEUE_WARN } from '../content/betaFeedbackCopy'
import { hasPendingAvisBetaQueue } from './clearAvisBetaLocalData'

/**
 * AV-17 — si des avis sont encore en file hors ligne, demander confirmation
 * avant une déconnexion qui purge la file.
 */
export function confirmSignOutClearingAvisQueue(
  confirmFn: (message: string) => boolean = (message) =>
    typeof window !== 'undefined' ? window.confirm(message) : true,
): boolean {
  if (!hasPendingAvisBetaQueue()) return true
  return confirmFn(BETA_FEEDBACK_LOGOUT_QUEUE_WARN)
}
