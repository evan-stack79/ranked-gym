/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
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

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

describe('Âge manquant — prompt + journal masqué + repas conservés', () => {
  it('affiche la question d’âge (prompt bloquant)', async () => {
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

  it('sans âge : journal masqué, repas locaux préservés ; âge ≥18 restaure le journal', () => {
    localStorage.clear()
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
    expect(canShowMealJournal(noAge)).toBe(false)
    // Les repas restent en storage même si le journal UI est masqué.
    expect(getTodayJournal().meals.some((m) => m.name === 'Yaourt conservé')).toBe(true)

    saveCalorieProfile({ ...noAge, age: 28 })
    const adult = getCalorieProfile()
    expect(needsAgePrompt(adult)).toBe(false)
    expect(canShowMealJournal(adult)).toBe(true)
    expect(getTodayJournal().meals.some((m) => m.name === 'Yaourt conservé')).toBe(true)
  })

  it('NutritionView montre le prompt quand l’âge manque', async () => {
    localStorage.clear()
    saveCalorieProfile({ ...BLANK_PROFILE, age: null as unknown as number, onboardingComplete: true })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<NutritionView />)
    })

    expect(host.querySelector('[data-testid="age-required-prompt"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Détail du journal"]')).toBeNull()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
