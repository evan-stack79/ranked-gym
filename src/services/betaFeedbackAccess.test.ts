/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canAccessBetaFeedback, getDeclaredAgeForAvis } from './betaFeedbackAccess'

vi.mock('./nutritionStorage', () => ({
  getCalorieProfile: vi.fn(() => ({ age: undefined })),
}))

import { getCalorieProfile } from './nutritionStorage'

describe('betaFeedbackAccess', () => {
  beforeEach(() => {
    vi.mocked(getCalorieProfile).mockReturnValue({ age: undefined } as never)
  })

  it('masque l’accès pour mineur et âge inconnu', () => {
    expect(canAccessBetaFeedback(undefined)).toBe(false)
    expect(canAccessBetaFeedback(17)).toBe(false)
    expect(canAccessBetaFeedback(18)).toBe(true)
    expect(canAccessBetaFeedback(42)).toBe(true)
  })

  it('lit l’âge du profil nutrition local', () => {
    vi.mocked(getCalorieProfile).mockReturnValue({ age: 21 } as never)
    expect(canAccessBetaFeedback()).toBe(true)
    expect(getDeclaredAgeForAvis()).toBe(21)

    vi.mocked(getCalorieProfile).mockReturnValue({ age: 15 } as never)
    expect(canAccessBetaFeedback()).toBe(false)
    expect(getDeclaredAgeForAvis()).toBeNull()
  })
})
