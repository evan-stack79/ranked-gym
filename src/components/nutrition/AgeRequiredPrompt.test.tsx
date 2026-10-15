/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgeRequiredPrompt } from './AgeRequiredPrompt'
import {
  addMealToToday,
  getCalorieProfile,
  getTodayJournal,
  saveCalorieProfile,
  BLANK_PROFILE,
} from '../../services/nutritionStorage'
import { canShowMealJournal, needsAgePrompt } from '../../services/foodAddAccess'
import { NutritionView } from './NutritionView'
import { NutritionDashboard } from './NutritionDashboard'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

describe('Âge manquant — prompt V3 + journal legacy intact', () => {
  const prevFoodAddV3 = import.meta.env.VITE_ENABLE_FOOD_ADD_V3

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    if (prevFoodAddV3 == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prevFoodAddV3)
  })

  it('affiche la question d’âge (composant réutilisé)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onAgeSubmit = vi.fn()

    await act(async () => {
      root.render(<AgeRequiredPrompt onAgeSubmit={onAgeSubmit} />)
    })

    expect(host.querySelector('[data-testid="age-required-prompt"]')).toBeTruthy()
    expect(host.textContent).toMatch(/Ton âge|âge/i)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('sans âge : journal legacy visible, repas locaux préservés', () => {
    saveCalorieProfile({ ...BLANK_PROFILE, age: null as unknown as number, onboardingComplete: true })
    addMealToToday({
      name: 'Yaourt conservé',
      mealType: 'snack',
      calories: 90,
    })
    const before = getTodayJournal().meals
    expect(before.some((m) => m.name === 'Yaourt conservé')).toBe(true)

    const noAge = getCalorieProfile()
    expect(needsAgePrompt(noAge)).toBe(true)
    expect(canShowMealJournal(noAge)).toBe(true)
    expect(getTodayJournal().meals.some((m) => m.name === 'Yaourt conservé')).toBe(true)

    saveCalorieProfile({ ...noAge, age: 28 })
    const adult = getCalorieProfile()
    expect(needsAgePrompt(adult)).toBe(false)
    expect(canShowMealJournal(adult)).toBe(true)
    expect(getTodayJournal().meals.some((m) => m.name === 'Yaourt conservé')).toBe(true)
  })

  it('flag OFF : NutritionView ne montre pas le prompt âge (rien de nouveau)', async () => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    saveCalorieProfile({ ...BLANK_PROFILE, age: null as unknown as number, onboardingComplete: true })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<NutritionView />)
    })

    expect(host.querySelector('[data-testid="age-required-prompt"]')).toBeNull()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('flag ON : ouvrir Ajouter demande l’âge avant V3', async () => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', 'true')
    const profile = {
      ...BLANK_PROFILE,
      age: null as unknown as number,
      onboardingComplete: true,
    }

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
    // Wait hydration (useEffect → setHydrated)
    await act(async () => {
      await Promise.resolve()
    })

    const searchBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      /recherche/i.test(b.textContent ?? ''),
    )
    expect(searchBtn).toBeTruthy()
    await act(async () => {
      searchBtn!.click()
    })

    expect(host.querySelector('[data-testid="age-required-prompt"]')).toBeTruthy()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
