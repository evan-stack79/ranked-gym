/** @vitest-environment jsdom */
/**
 * R4-01 — V3 OFF, kcal vides : jamais « null kcal » dans Aliments du jour.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NutritionDashboard } from './NutritionDashboard'
import type { CalorieProfile } from '../../types/nutrition'
import { todayKey } from '../../utils/calories'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.c', displayName: 'A', provider: 'email' },
    requireAuth: () => true,
  }),
}))

vi.mock('../../backend/adapter', () => ({
  isConvexDomainActive: () => false,
}))

vi.mock('../../services/convexNutritionQueue', () => ({
  enqueueConvexNutritionOp: vi.fn(),
}))

const nullKcalMeal = {
  id: 'plat-sans-kcal',
  name: 'Plat sans kcal',
  mealType: 'lunch' as const,
  calories: null as number | null,
  proteinG: null as number | null,
  carbsG: null as number | null,
  fatG: null as number | null,
  grams: 200,
  createdAt: 1,
}

vi.mock('../../services/nutritionStorage', async () => {
  const actual = await vi.importActual<typeof import('../../services/nutritionStorage')>(
    '../../services/nutritionStorage',
  )
  return {
    ...actual,
    getJournalForDate: () => ({
      dateKey: todayKey(),
      meals: [nullKcalMeal],
      waterMl: 0,
      waterEntries: [],
    }),
    getMealJournal: () => ({
      [todayKey()]: {
        dateKey: todayKey(),
        meals: [nullKcalMeal],
        waterMl: 0,
        waterEntries: [],
      },
    }),
    getWaterMlForDate: () => 0,
  }
})

const eligibleProfile: CalorieProfile = {
  weightKg: 80,
  goalWeightKg: 78,
  heightCm: 180,
  age: 30,
  sex: 'male',
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

describe('NutritionDashboard — R4-01 kcal vides', () => {
  const prevV3 = import.meta.env.VITE_ENABLE_FOOD_ADD_V3

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
  })

  afterEach(() => {
    if (prevV3 == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prevV3)
  })

  it('Aliments du jour : jamais « null kcal » / NaN / undefined pour kcal vides', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <NutritionDashboard
          profile={eligibleProfile}
          onChangeProfile={() => undefined}
          onOpenSetup={() => undefined}
        />,
      )
    })

    const journalBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Journal'),
    ) as HTMLButtonElement | undefined
    expect(journalBtn).toBeTruthy()
    await act(async () => {
      journalBtn!.click()
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })

    const section = document.querySelector('[aria-label="Détail du journal"]')
    expect(section).toBeTruthy()
    const text = section!.textContent ?? ''
    expect(text).toContain('Plat sans kcal')
    expect(text).toContain('Déjeuner')
    expect(text).not.toMatch(/null\s*kcal/i)
    expect(text).not.toContain('null')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('undefined')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
