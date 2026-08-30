/**
 * Capture / restaure le focus clavier lors d’un overlay plein écran (Daily Streak).
 * Release idempotent — une seule restauration même si appelée plusieurs fois.
 */

function isHTMLElement(el: Element | null): el is HTMLElement {
  return (
    el !== null &&
    typeof (el as HTMLElement).focus === 'function' &&
    typeof (el as HTMLElement).isConnected === 'boolean'
  )
}

/** Vérifie la cible au moment exact de la restauration, après retrait du portal. */
export function isRestorableStreakCelebrationFocusTarget(
  el: Element | null,
): el is HTMLElement {
  if (!isHTMLElement(el) || !el.isConnected) return false
  if (el === document.body || el === document.documentElement) return false
  if (el.matches(':disabled, [aria-disabled="true"]')) return false
  if (el.closest('[inert], [aria-hidden="true"]')) return false
  if (el.tabIndex < 0 && !el.isContentEditable) return false

  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

/** Lit l’élément actif pendant le render (DOM pas encore mis à jour). */
export function captureFocusReturnTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const el = document.activeElement
  if (!isHTMLElement(el)) return null
  if (el === document.body || el === document.documentElement) return null
  return el
}

export function captureStreakCelebrationFocus(
  overlayEl: HTMLElement | null,
  focusReturnTarget: HTMLElement | null,
): void {
  overlayEl?.focus({ preventScroll: true })
  void focusReturnTarget
}

/**
 * Restaure immédiatement le focus. L'appelant doit avoir confirmé que le portal
 * est démonté et que le commit a rendu le shell interactif.
 */
export function restoreStreakCelebrationFocusPostCommit(
  focusReturnTarget: HTMLElement | null,
): boolean {
  if (!isRestorableStreakCelebrationFocusTarget(focusReturnTarget)) return false
  focusReturnTarget.focus({ preventScroll: true })
  return document.activeElement === focusReturnTarget
}

/** @deprecated Préférer capture + restoreStreakCelebrationFocusPostCommit séparés. */
export function releaseStreakCelebrationFocus(
  focusReturnTarget: HTMLElement | null,
): () => void {
  let released = false
  return () => {
    if (released) return
    released = true
    restoreStreakCelebrationFocusPostCommit(focusReturnTarget)
  }
}

/** @deprecated Préférer captureStreakCelebrationFocus avec cible explicite. */
export function captureOverlayFocus(focusTarget: HTMLElement | null): () => void {
  const previous = captureFocusReturnTarget()
  captureStreakCelebrationFocus(focusTarget, previous)
  return releaseStreakCelebrationFocus(previous)
}

/**
 * Rend le shell applicatif non focalisable (inert) pendant la célébration.
 * Release idempotent.
 */
export function setShellInert(shellEl: HTMLElement | null): () => void {
  if (!shellEl) return () => {}

  const hadInert = shellEl.hasAttribute('inert')
  shellEl.setAttribute('inert', '')

  let released = false
  return () => {
    if (released) return
    released = true
    if (!hadInert) {
      shellEl.removeAttribute('inert')
    }
  }
}
