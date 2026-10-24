/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionSnapshot } from './NutritionSnapshot'
import type { CalorieProfile } from '../../types/nutrition'
import { nutritionDayCache, diaryRollup } from '../../nutrition-engine/diaryRollup'

const profileState: { current: CalorieProfile } = {
  current: {
    weightKg: 61,
    goalWeightKg: 65,
    heightCm: 170,
    age: 22,
    sex: 'male',
    activity: 'moderate',
    morphology: 'mesomorph',
    goal: 'bulk',
    weeklyPaceKg: 0.25,
    onboardingComplete: true,
    declaredPregnancy: false,
    declaredBreastfeeding: false,
    declaredEatingDisorder: false,
    preferNotAnswerHealth: false,
  },
}

vi.mock('../../services/nutritionStorage', async () => {
  const actual = await vi.importActual<typeof import('../../services/nutritionStorage')>(
    '../../services/nutritionStorage',
  )
  return {
    ...actual,
    getCalorieProfile: () => profileState.current,
    getTodayJournal: () => ({
      dateKey: '2026-10-21',
      meals: [{ id: 'legacy', name: 'Rapide', mealType: 'snack', calories: 40, createdAt: 1 }],
      waterMl: 0,
      waterEntries: [],
    }),
    getTodayWaterMl: () => 0,
  }
})

describe('UI-N1 NutritionSnapshot', () => {
  it('jour vide : pas de 0 kcal affiché comme un repas loggé', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const empty = nutritionDayCache({
      rollup: diaryRollup({ meals: [] }),
      targetKcal: null,
      proteinTargetG: null,
    })
    await act(async () => {
      root.render(<NutritionSnapshot nutritionDay={empty} />)
    })
    expect(host.textContent).toContain('Aucun repas compté')
    expect(host.textContent).not.toContain('0 kcal')
    root.unmount()
    host.remove()
  })

  it('lit le snapshot du jour sans reprendre le journal local', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
    const snapshot = nutritionDayCache({
      rollup: diaryRollup({
        meals: [{ mealType: 'dinner', calories: 830, proteinG: 101 }],
        waterMl: 750,
      }),
      targetKcal: 2798,
      proteinTargetG: 97.6,
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<NutritionSnapshot nutritionDay={snapshot} />)
    })
    expect(host.textContent).toContain('830')
    expect(host.textContent).not.toContain('40')
    const ring = host.querySelector('[aria-label="Progression hydrique"]')
    expect(ring).toBeNull()
    root.unmount()
    host.remove()
  })
})
