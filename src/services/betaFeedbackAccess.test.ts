/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canAccessBetaFeedback,
  canOpenBetaFeedback,
  getBetaFeedbackAgeStatus,
} from './betaFeedbackAccess'

vi.mock('./nutritionStorage', () => ({
  getCalorieProfile: vi.fn(() => ({ age: undefined })),
}))

import { getCalorieProfile } from './nutritionStorage'

describe('betaFeedbackAccess (UI only — serveur lit nutrition_state)', () => {
  beforeEach(() => {
    vi.mocked(getCalorieProfile).mockReturnValue({ age: undefined } as never)
  })

  it('distingue adulte / manquant / mineur (même source âge, pas d’autre contrôle)', () => {
    expect(getBetaFeedbackAgeStatus(undefined)).toBe('missing')
    expect(getBetaFeedbackAgeStatus(null)).toBe('missing')
    expect(getBetaFeedbackAgeStatus('30')).toBe('missing')
    expect(getBetaFeedbackAgeStatus(17)).toBe('minor')
    expect(getBetaFeedbackAgeStatus(17.9)).toBe('minor')
    expect(getBetaFeedbackAgeStatus(18)).toBe('adult')
    expect(getBetaFeedbackAgeStatus(42)).toBe('adult')
  })

  it('formulaire (canAccess) seulement adulte ; entrée (canOpen) aussi si âge manquant', () => {
    expect(canAccessBetaFeedback(undefined)).toBe(false)
    expect(canOpenBetaFeedback(undefined)).toBe(true)

    expect(canAccessBetaFeedback(16)).toBe(false)
    expect(canOpenBetaFeedback(16)).toBe(false)

    expect(canAccessBetaFeedback(28)).toBe(true)
    expect(canOpenBetaFeedback(28)).toBe(true)
  })

  it('lit l’âge du profil nutrition local', () => {
    vi.mocked(getCalorieProfile).mockReturnValue({ age: 21 } as never)
    expect(canAccessBetaFeedback()).toBe(true)
    expect(canOpenBetaFeedback()).toBe(true)

    vi.mocked(getCalorieProfile).mockReturnValue({ age: undefined } as never)
    expect(canAccessBetaFeedback()).toBe(false)
    expect(canOpenBetaFeedback()).toBe(true)
    expect(getBetaFeedbackAgeStatus()).toBe('missing')
  })
})
