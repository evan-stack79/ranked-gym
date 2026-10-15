/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BETA_FEEDBACK_LOGOUT_QUEUE_WARN } from '../content/betaFeedbackCopy'
import { AVIS_BETA_QUEUE_PREFIX } from './clearAvisBetaLocalData'
import { confirmSignOutClearingAvisQueue } from './avisBetaLogoutWarn'

describe('confirmSignOutClearingAvisQueue (AV-17)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('laisse passer sans confirm si file vide', () => {
    const confirmFn = vi.fn(() => false)
    expect(confirmSignOutClearingAvisQueue(confirmFn)).toBe(true)
    expect(confirmFn).not.toHaveBeenCalled()
  })

  it('demande confirmation avec le texte d’avertissement si file non vide', () => {
    localStorage.setItem(`${AVIS_BETA_QUEUE_PREFIX}u1`, JSON.stringify([{ id: '1' }]))
    const confirmFn = vi.fn(() => true)
    expect(confirmSignOutClearingAvisQueue(confirmFn)).toBe(true)
    expect(confirmFn).toHaveBeenCalledWith(BETA_FEEDBACK_LOGOUT_QUEUE_WARN)
  })

  it('annule la déconnexion si l’utilisateur refuse', () => {
    localStorage.setItem(`${AVIS_BETA_QUEUE_PREFIX}u1`, JSON.stringify([{ id: '1' }]))
    expect(confirmSignOutClearingAvisQueue(() => false)).toBe(false)
  })
})
