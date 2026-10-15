/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from 'vitest'
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

describe('QA BUG-16 — Accueil sans « Objectif indisponible » (drapeau OFF)', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('drapeau OFF : carte neutre « Suivi du jour », pas Objectif indisponible', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
    profileState.current = { ...profileState.current, age: 30 }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<NutritionSnapshot />)
    })
    expect(host.textContent).not.toContain('Objectif indisponible')
    expect(host.textContent).toContain('Suivi du jour')
    root.unmount()
    host.remove()
  })

  it('mineur + drapeau ON : pas Objectif indisponible', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = { ...profileState.current, age: 17 }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<NutritionSnapshot />)
    })
    expect(host.textContent).not.toContain('Objectif indisponible')
    root.unmount()
    host.remove()
  })
})
