/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { FullProfileScreen } from './FullProfileScreen'
import type { CalorieProfile } from '../../types/nutrition'

const profileState: { current: CalorieProfile } = {
  current: {
    weightKg: 60,
    goalWeightKg: 55,
    heightCm: 170,
    age: 17,
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
  },
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.c', displayName: 'A', provider: 'email' },
    profile: { pseudo: 'A', level: 1, xp: 0 },
    refreshProfile: () => undefined,
    patchProfile: () => undefined,
  }),
}))

vi.mock('../../services/nutritionStorage', async () => {
  const actual = await vi.importActual<typeof import('../../services/nutritionStorage')>(
    '../../services/nutritionStorage',
  )
  return {
    ...actual,
    getCalorieProfile: () => profileState.current,
    saveCalorieProfile: () => undefined,
  }
})

vi.mock('../../services/userStatsService', () => ({
  fetchUserStats: async () => null,
}))

describe('QA BUG-08 — poids cible masqué mineur / drapeau OFF', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('mineur : pas de champ Poids cible', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = { ...profileState.current, age: 17 }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<FullProfileScreen onBack={() => undefined} />)
    })
    expect(host.querySelector('[data-testid="full-profile-goal-weight"]')).toBeNull()
    expect(host.querySelector('input[aria-label="Poids cible"]')).toBeNull()
    // Plage d’âge alignée sur PLAUSIBLE_AGE_* (ClearableNumberInput, type texte)
    expect(host.querySelector('input[aria-label="Âge"]')).toBeTruthy()
    root.unmount()
    host.remove()
  })

  it('drapeau OFF : pas de champ Poids cible même adulte', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
    profileState.current = { ...profileState.current, age: 30 }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<FullProfileScreen onBack={() => undefined} />)
    })
    expect(host.querySelector('[data-testid="full-profile-goal-weight"]')).toBeNull()
    root.unmount()
    host.remove()
  })

  it('adulte + drapeau ON : Poids cible visible', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = {
      ...profileState.current,
      age: 30,
      declaredEatingDisorder: false,
      declaredPregnancy: false,
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<FullProfileScreen onBack={() => undefined} />)
    })
    expect(host.querySelector('[data-testid="full-profile-goal-weight"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="full-profile-body-metrics"]')).toBeTruthy()
    root.unmount()
    host.remove()
  })

  it('mineur : pas de Poids actuel ni Taille', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = { ...profileState.current, age: 17 }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<FullProfileScreen onBack={() => undefined} />)
    })
    expect(host.querySelector('[data-testid="full-profile-body-metrics"]')).toBeNull()
    expect(host.querySelector('input[aria-label="Poids actuel"]')).toBeNull()
    expect(host.querySelector('input[aria-label="Taille"]')).toBeNull()
    root.unmount()
    host.remove()
  })

  it('TCA déclaré + drapeau ON : Poids cible masqué', async () => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
    profileState.current = {
      ...profileState.current,
      age: 30,
      declaredEatingDisorder: true,
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<FullProfileScreen onBack={() => undefined} />)
    })
    expect(host.querySelector('[data-testid="full-profile-goal-weight"]')).toBeNull()
    root.unmount()
    host.remove()
  })
})
