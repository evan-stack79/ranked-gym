/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canAccessBetaFeedback } from './betaFeedbackAccess'

vi.mock('./nutritionStorage', () => ({
  getCalorieProfile: vi.fn(() => ({ age: undefined })),
}))

import { getCalorieProfile } from './nutritionStorage'

describe('betaFeedbackAccess (UI only — serveur lit nutrition_state)', () => {
  beforeEach(() => {
    vi.mocked(getCalorieProfile).mockReturnValue({ age: undefined } as never)
  })

  it('masque l’accès pour mineur et âge inconnu', () => {
    expect(canAccessBetaFeedback(undefined)).toBe(false)
    expect(canAccessBetaFeedback(null)).toBe(false)
    expect(canAccessBetaFeedback(17)).toBe(false)
    expect(canAccessBetaFeedback(17.9)).toBe(false)
    expect(canAccessBetaFeedback(18)).toBe(true)
    expect(canAccessBetaFeedback(42)).toBe(true)
    expect(canAccessBetaFeedback('30')).toBe(false)
  })

  it('lit l’âge du profil nutrition local (masquage entrée uniquement)', () => {
    vi.mocked(getCalorieProfile).mockReturnValue({ age: 21 } as never)
    expect(canAccessBetaFeedback()).toBe(true)

    vi.mocked(getCalorieProfile).mockReturnValue({ age: 15 } as never)
    expect(canAccessBetaFeedback()).toBe(false)
  })
})
