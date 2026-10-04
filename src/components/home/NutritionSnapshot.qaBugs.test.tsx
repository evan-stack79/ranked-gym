/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionSnapshot } from './NutritionSnapshot'
import type { CalorieProfile } from '../../types/nutrition'

const profileState: { current: CalorieProfile } = {
  current: {
    weightKg: 80,
    goalWeightKg: 80,
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
  },
}

vi.mock('../../services/nutritionStorage', async () => {
  const actual = await vi.importActual<typeof import('../../services/nutritionStorage')>(
    '../../services/nutritionStorage',
  )
  return {
    ...actual,
    getCalorieProfile: () => profileState.current,
    getTodayJournal: () => ({ dateKey: '2026-10-02', meals: [], waterMl: 0, waterEntries: [] }),
    getTodayWaterMl: () => 0,
  }
})

describe('QA BUG-16 / BUG-38 / BUG-39 — Accueil NutritionSnapshot', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  async function renderSnapshot() {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<NutritionSnapshot onOpenNutrition={() => undefined} />)
    })
    return {
      host,
      cleanup: () => {
        root.unmount()
        host.remove()
      },
    }
  }

  it('BUG-16 drapeau OFF : carte neutre « Suivi du jour », pas Objectif indisponible', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
    profileState.current = { ...profileState.current, age: 30, declaredEatingDisorder: false }
    const { host, cleanup } = await renderSnapshot()
    expect(host.textContent).not.toContain('Objectif indisponible')
    expect(host.textContent).toContain('Suivi du jour')
    expect(host.textContent).toContain('kcal consommées')
    expect(host.querySelector('[aria-label="Ajouter un repas"]')).toBeTruthy()
    cleanup()
  })

  it('BUG-38 mineur + drapeau OFF : pas de compteur ni Ajouter un repas ; eau intacte', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
    profileState.current = { ...profileState.current, age: 17, declaredEatingDisorder: false }
    const { host, cleanup } = await renderSnapshot()
    expect(host.textContent).not.toContain('Objectif indisponible')
    expect(host.textContent).not.toContain('kcal consommées')
    expect(host.querySelector('[aria-label="Ajouter un repas"]')).toBeNull()
    expect(host.textContent).toContain('Eau')
    expect(host.textContent).toContain('Suivi du jour')
    cleanup()
  })

  it('BUG-38 mineur + drapeau ON : pas de compteur ni Ajouter un repas', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = { ...profileState.current, age: 16, declaredEatingDisorder: false }
    const { host, cleanup } = await renderSnapshot()
    expect(host.textContent).not.toContain('Objectif indisponible')
    expect(host.textContent).not.toContain('kcal consommées')
    expect(host.querySelector('[aria-label="Ajouter un repas"]')).toBeNull()
    expect(host.textContent).toContain('Eau')
    cleanup()
  })

  it('BUG-38 TCA + drapeau OFF : pas de compteur ni Ajouter un repas', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
    profileState.current = {
      ...profileState.current,
      age: 30,
      declaredEatingDisorder: true,
    }
    const { host, cleanup } = await renderSnapshot()
    expect(host.textContent).not.toContain('kcal consommées')
    expect(host.querySelector('[aria-label="Ajouter un repas"]')).toBeNull()
    expect(host.textContent).toContain('Eau')
    cleanup()
  })

  it('BUG-39 TCA + drapeau ON : pas « Objectif indisponible », carte neutre sans compteur', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = {
      ...profileState.current,
      age: 30,
      declaredEatingDisorder: true,
      declaredPregnancy: false,
    }
    const { host, cleanup } = await renderSnapshot()
    expect(host.textContent).not.toContain('Objectif indisponible')
    expect(host.textContent).not.toContain('Ouvre Nutri pour vérifier ton plan')
    expect(host.textContent).not.toContain('kcal consommées')
    expect(host.querySelector('[aria-label="Ajouter un repas"]')).toBeNull()
    cleanup()
  })

  it('BUG-39 grossesse + drapeau ON : pas « Objectif indisponible » ; suivi sans objectif OK', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = {
      ...profileState.current,
      age: 30,
      sex: 'female',
      declaredEatingDisorder: false,
      declaredPregnancy: true,
    }
    const { host, cleanup } = await renderSnapshot()
    expect(host.textContent).not.toContain('Objectif indisponible')
    expect(host.textContent).toContain('Suivi du jour')
    // Grossesse : shouldHideWeightAndCaloriesTracking = false → suivi consommé autorisé.
    expect(host.textContent).toContain('kcal consommées')
    expect(host.querySelector('[aria-label="Ajouter un repas"]')).toBeTruthy()
    cleanup()
  })
})
