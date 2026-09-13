/**
 * Session unique Daily Streak — acquisition/libération idempotentes (StrictMode-safe).
 * Le cleanup différé ne libère que si aucun remount n’a incrémenté la génération.
 * (Le shell `inert` est posé de façon déclarative par AppLayout.)
 */

import { acquireBodyScrollLock } from './bodyScrollLock'
import {
  captureStreakCelebrationFocus,
  restoreStreakCelebrationFocusPostCommit,
} from './streakCelebrationFocus'

let scrollRelease: (() => void) | null = null
let focusReturnTarget: HTMLElement | null = null
let overlayElement: HTMLElement | null = null
let focusCaptured = false
let mountGeneration = 0
let releaseObserver: MutationObserver | null = null
let releasedGeneration = 0

export function enterStreakCelebrationSession(
  overlayEl: HTMLElement | null,
  returnTarget: HTMLElement | null,
): number {
  mountGeneration += 1

  if (!scrollRelease) {
    scrollRelease = acquireBodyScrollLock()
  }

  syncStreakCelebrationSessionRefs(overlayEl, returnTarget)

  return mountGeneration
}

/** Met à jour le focus overlay quand la ref est disponible. */
export function syncStreakCelebrationSessionRefs(
  overlayEl: HTMLElement | null,
  returnTarget: HTMLElement | null,
): void {
  if (returnTarget && !focusReturnTarget) {
    focusReturnTarget = returnTarget
  }

  if (overlayEl && !focusCaptured) {
    overlayElement = overlayEl
    captureStreakCelebrationFocus(overlayEl, focusReturnTarget)
    focusCaptured = true
  }
}

function releaseStreakCelebrationShell(): void {
  scrollRelease?.()
  scrollRelease = null
}

function releaseStreakCelebrationFocusPostCommit(): void {
  restoreStreakCelebrationFocusPostCommit(focusReturnTarget)
  focusReturnTarget = null
  overlayElement = null
  focusCaptured = false
}

function releaseStreakCelebrationSession(generation: number): void {
  if (releasedGeneration === generation) return
  releasedGeneration = generation
  releaseObserver?.disconnect()
  releaseObserver = null
  releaseStreakCelebrationShell()
  releaseStreakCelebrationFocusPostCommit()
}

function isCelebrationPortalUnmounted(): boolean {
  if (typeof document === 'undefined') return true
  return !overlayElement?.isConnected && !document.body.querySelector('.streak-celeb')
}

/**
 * Cleanup effect — attend le retrait DOM réel du portal, puis libère scroll et
 * focus une seule fois. Une génération StrictMode remontée annule le cleanup.
 */
export function scheduleStreakCelebrationSessionUnmount(generation: number): void {
  const tryRelease = () => {
    if (mountGeneration !== generation || releasedGeneration === generation) return
    if (!isCelebrationPortalUnmounted()) return
    releaseStreakCelebrationSession(generation)
  }

  queueMicrotask(() => {
    if (mountGeneration !== generation || releasedGeneration === generation) return
    if (isCelebrationPortalUnmounted()) {
      tryRelease()
      return
    }

    if (typeof MutationObserver === 'function') {
      releaseObserver?.disconnect()
      releaseObserver = new MutationObserver(tryRelease)
      releaseObserver.observe(document.body, { childList: true, subtree: true })
    }
  })
}

/** @internal tests */
export function __resetStreakCelebrationSessionForTests(): void {
  releaseObserver?.disconnect()
  releaseObserver = null
  scrollRelease?.()
  scrollRelease = null
  focusReturnTarget = null
  overlayElement = null
  focusCaptured = false
  mountGeneration = 0
  releasedGeneration = 0
}

/** @internal tests */
export function __getStreakCelebrationSessionGenerationForTests(): number {
  return mountGeneration
}
