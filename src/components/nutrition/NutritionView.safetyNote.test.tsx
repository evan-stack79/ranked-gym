/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionView } from './NutritionView'
import { M_INFO_1, Q8_SCREEN_TITLE } from '../../content/safetyCopy'
import type { CalorieProfile } from '../../types/nutrition'

const adultProfile: CalorieProfile = {
  weightKg: 75,
  goalWeightKg: 75,
  heightCm: 175,
  age: 28,
  sex: 'female',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'maintain',
  weeklyPaceKg: 0,
  onboardingComplete: true,
  declaredPregnancy: false,
  declaredBreastfeeding: false,
  declaredEatingDisorder: false,
  preferNotAnswerHealth: false,
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isLoading: false,
    user: { id: 'u1', email: 'a@b.c', displayName: 'A', provider: 'email' },
    requireAuth: () => true,
  }),
}))

vi.mock('../../services/nutritionStorage', async () => {
  const actual = await vi.importActual<typeof import('../../services/nutritionStorage')>(
    '../../services/nutritionStorage',
  )
  return {
    ...actual,
    getCalorieProfile: () => adultProfile,
    getJournalForDate: () => ({ dateKey: '2026-10-02', meals: [], waterMl: 0, waterEntries: [] }),
    getMealJournal: () => ({}),
    getWaterMlForDate: () => 0,
  }
})

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let from = 0
  while (from < haystack.length) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    count += 1
    from = idx + needle.length
  }
  return count
}

describe('NutritionView — affichage unique M_INFO_1', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'false')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('affiche M_INFO_1 exactement une fois et le lien Besoin d’en parler ?', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<NutritionView />)
    })

    expect(countOccurrences(host.textContent ?? '', M_INFO_1)).toBe(1)
    expect(host.querySelector('[data-testid="calorie-goal-disabled-notice"]')).toBeNull()
    expect(host.querySelector('[data-testid="safety-note"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="dashboard-need-to-talk"]')?.textContent).toContain(
      Q8_SCREEN_TITLE,
    )

    root.unmount()
    host.remove()
  })
})
