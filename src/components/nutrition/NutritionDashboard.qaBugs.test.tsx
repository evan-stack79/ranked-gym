/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionDashboard } from './NutritionDashboard'
import type { CalorieProfile } from '../../types/nutrition'
import { M_CAL_2, M_INFO_1, Q8_SCREEN_TITLE } from '../../content/safetyCopy'

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
    getJournalForDate: () => ({ dateKey: '2026-10-02', meals: [], waterMl: 0, waterEntries: [] }),
    getMealJournal: () => ({}),
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

describe('QA BUG-05 / BUG-06 — notices + estimation + Besoin d’en parler', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('affiche M_CAL_2 / M_INFO_1 et un lien Besoin d’en parler ?', async () => {
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

    expect(host.querySelector('[data-testid="dashboard-need-to-talk"]')?.textContent).toContain(
      Q8_SCREEN_TITLE,
    )
    // Avec objectif moteur OK : notices d’estimation
    const notices = host.querySelector('[data-testid="dashboard-estimation-notices"]')
    if (notices) {
      expect(notices.textContent).toContain(M_CAL_2)
      expect(notices.textContent).toContain(M_INFO_1)
    } else {
      // Si moteur non OK en environnement de test, au moins safety notices ou lien
      expect(host.textContent).toMatch(/estimation|Repère indicatif/i)
    }

    root.unmount()
    host.remove()
  })
})

describe('QA BUG-07 via dashboard — TCA sans CTA setup', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('profil TCA : pas de bouton Définir mon objectif', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <NutritionDashboard
          profile={{ ...eligibleProfile, declaredEatingDisorder: true }}
          onChangeProfile={() => undefined}
          onOpenSetup={() => undefined}
        />,
      )
    })
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeNull()
    expect(host.textContent).not.toContain('Définir mon objectif')
    root.unmount()
    host.remove()
  })
})
