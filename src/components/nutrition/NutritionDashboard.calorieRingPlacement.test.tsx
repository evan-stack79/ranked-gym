/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionDashboard } from './NutritionDashboard'
import type { CalorieProfile } from '../../types/nutrition'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
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
    getJournalForDate: () => ({
      dateKey: '2026-11-10',
      meals: [
        {
          id: 'm1',
          name: 'Repas',
          mealType: 'lunch',
          calories: 600,
          proteinG: 40,
          carbsG: 50,
          fatG: 20,
          createdAt: Date.now(),
        },
      ],
      waterMl: 0,
      waterEntries: [],
    }),
    getMealJournal: () => ({}),
    getWaterMlForDate: () => 0,
  }
})

vi.mock('../../services/hydration/hydrationService', () => ({
  HYDRATION_CHANGED_EVENT: 'ranked-gym:hydration-changed',
  fetchHydrationToday: async () => ({
    dayKey: '2026-11-10',
    drunkMl: 900,
    goalMl: 2800,
    entries: [],
    effectiveVisualMode: 'catalog',
    myBottleHasShape: false,
  }),
  flushHydrationPendingQueue: async () => undefined,
  onHydrationAccountChanged: () => undefined,
  addHydrationEntry: async () => ({
    dayKey: '2026-11-10',
    drunkMl: 900,
    goalMl: 2800,
    entries: [],
    effectiveVisualMode: 'catalog',
    myBottleHasShape: false,
  }),
  undoLastHydrationEntry: async () => ({
    dayKey: '2026-11-10',
    drunkMl: 900,
    goalMl: 2800,
    entries: [],
    effectiveVisualMode: 'catalog',
    myBottleHasShape: false,
  }),
}))

vi.mock('../../services/hydration/bottleShapeStorage', () => ({
  loadBottleShapeUrl: async () => null,
}))

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
  healthAnswer: 'none',
  declaredPregnancy: false,
  declaredBreastfeeding: false,
  declaredEatingDisorder: false,
  preferNotAnswerHealth: false,
}

async function renderDashboard(profile: CalorieProfile) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(
      <NutritionDashboard
        profile={profile}
        onChangeProfile={() => undefined}
        onOpenSetup={() => undefined}
      />,
    )
  })
  // HydrationPanel charge en async
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return { host, root }
}

describe('NutritionDashboard — placement anneau kcal / carte Eau', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('anneau « kcal restantes » présent au-dessus de la carte Eau', async () => {
    const { host, root } = await renderDashboard(eligibleProfile)
    const ring = host.querySelector('[data-testid="nutrition-calorie-ring"]') as HTMLElement | null
    const eau = host.querySelector('[data-testid="nutrition-eau-card"]') as HTMLElement | null
    expect(ring).not.toBeNull()
    expect(eau).not.toBeNull()
    expect(ring?.getAttribute('data-calorie-ring-mode')).toBe('ring')
    expect(ring?.textContent).toMatch(/kcal restantes/)
    expect(ring?.textContent).toMatch(/Calories aujourd/)
    expect(host.textContent).toMatch(/Protéines/)
    expect(host.textContent).toMatch(/Glucides/)
    expect(host.textContent).toMatch(/Lipides/)

    const position = ring!.compareDocumentPosition(eau!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    root.unmount()
    host.remove()
  })

  it('profil TCA : pas d’anneau « kcal restantes » (cible masquée)', async () => {
    const { host, root } = await renderDashboard({
      ...eligibleProfile,
      healthAnswer: 'situations',
      declaredEatingDisorder: true,
    })
    const ring = host.querySelector('[data-testid="nutrition-calorie-ring"]') as HTMLElement | null
    expect(ring).not.toBeNull()
    expect(ring?.getAttribute('data-calorie-ring-mode')).toBe('empty')
    expect(ring?.textContent).not.toMatch(/kcal restantes/)
    expect(host.querySelector('[aria-label="Progression calorique"]')).toBeNull()
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeNull()
    expect(host.querySelector('[data-testid="nutrition-eau-card"]')).not.toBeNull()

    root.unmount()
    host.remove()
  })
})
