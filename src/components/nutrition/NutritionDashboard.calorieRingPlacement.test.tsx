/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from 'vitest'
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
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return { host, root }
}

describe('NutritionDashboard — anneau kcal / Eau / TCA', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('non-TCA avec objectif → anneau au-dessus de la carte Eau (espacée)', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    const { host, root } = await renderDashboard(eligibleProfile)
    const ring = host.querySelector('[data-testid="nutrition-calorie-ring"]') as HTMLElement
    const eau = host.querySelector('[data-testid="nutrition-eau-card"]') as HTMLElement
    const spacer = host.querySelector('[data-nutrition-eau-spacer="1"]')
    expect(ring.getAttribute('data-calorie-ring-mode')).toBe('ring')
    expect(ring.textContent).toMatch(/kcal restantes/)
    expect(eau).toBeTruthy()
    expect(spacer).toBeTruthy()
    expect(ring.compareDocumentPosition(eau) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(host.textContent).not.toMatch(/Touche la carte pour dire/)
    root.unmount()
    host.remove()
  })

  it('non-TCA sans objectif (profil incomplet) → bouton Fixer un objectif', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    const { host, root } = await renderDashboard({
      ...eligibleProfile,
      onboardingComplete: false,
      weightKg: 0,
      heightCm: 0,
    })
    const ring = host.querySelector('[data-testid="nutrition-calorie-ring"]') as HTMLElement
    expect(ring.getAttribute('data-calorie-ring-mode')).toBe('empty')
    expect(host.querySelector('[data-testid="define-calorie-goal"]')?.textContent).toMatch(
      /Fixer un objectif/,
    )
    expect(ring.textContent).not.toMatch(/kcal restantes/)
    root.unmount()
    host.remove()
  })

  it('TCA → jamais d’anneau kcal restantes', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    const { host, root } = await renderDashboard({
      ...eligibleProfile,
      healthAnswer: 'situations',
      declaredEatingDisorder: true,
    })
    const ring = host.querySelector('[data-testid="nutrition-calorie-ring"]') as HTMLElement
    expect(ring.getAttribute('data-calorie-ring-mode')).toBe('empty')
    expect(ring.getAttribute('data-calorie-lock')).toBe('tca')
    expect(ring.textContent).not.toMatch(/kcal restantes/)
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeNull()
    expect(host.querySelector('[aria-label="Progression calorique"]')).toBeNull()
    expect(ring.textContent).toMatch(/Situations de santé/)
    root.unmount()
    host.remove()
  })
})
