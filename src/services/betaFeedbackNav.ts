import type { BetaFeedbackPage } from './betaFeedbackPages'

export const OPEN_BETA_FEEDBACK_EVENT = 'ranked-gym:open-beta-feedback'

export type OpenBetaFeedbackDetail = {
  page?: BetaFeedbackPage | string
}

const PREFILL_KEY = 'ranked-gym:avis-beta-prefill-page'
const PENDING_OPEN_KEY = 'ranked-gym:avis-beta-pending-open'

/** Demande d’ouvrir l’écran avis (Profil → Donner mon avis). */
export function requestOpenBetaFeedback(page?: string): void {
  if (typeof window === 'undefined') return
  if (page) setBetaFeedbackPrefillPage(page)
  markBetaFeedbackPendingOpen()
  window.dispatchEvent(
    new CustomEvent<OpenBetaFeedbackDetail>(OPEN_BETA_FEEDBACK_EVENT, {
      detail: page ? { page } : {},
    }),
  )
}

export function setBetaFeedbackPrefillPage(page: string): void {
  try {
    sessionStorage.setItem(PREFILL_KEY, page)
  } catch {
    /* ignore */
  }
}

export function consumeBetaFeedbackPrefillPage(): string | null {
  try {
    const value = sessionStorage.getItem(PREFILL_KEY)
    if (value) sessionStorage.removeItem(PREFILL_KEY)
    return value
  } catch {
    return null
  }
}

export function markBetaFeedbackPendingOpen(): void {
  try {
    sessionStorage.setItem(PENDING_OPEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumeBetaFeedbackPendingOpen(): boolean {
  try {
    const value = sessionStorage.getItem(PENDING_OPEN_KEY)
    if (value) sessionStorage.removeItem(PENDING_OPEN_KEY)
    return value === '1'
  } catch {
    return false
  }
}
