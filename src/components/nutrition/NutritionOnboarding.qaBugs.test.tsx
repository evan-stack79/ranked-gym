/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionOnboarding } from './NutritionOnboarding'
import { GlobalOnboardingScreen } from '../onboarding/GlobalOnboardingScreen'
import { BLANK_PROFILE } from '../../services/nutritionStorage'
import {
  M_MIN_1,
  Q6A_MINEURS,
  Q6B_GROSSESSE_ALLAITEMENT,
  M_TCA_1,
  Q8_SCREEN_TITLE,
  M_INFO_1,
} from '../../content/safetyCopy'
import type { CalorieProfile } from '../../types/nutrition'

function blankAdult(): CalorieProfile {
  return { ...BLANK_PROFILE }
}

async function renderOnboarding(
  onComplete: (p: CalorieProfile) => void,
  initial: CalorieProfile = blankAdult(),
) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<NutritionOnboarding initial={initial} onComplete={onComplete} />)
  })
  return { host, root, cleanup: () => { root.unmount(); host.remove() } }
}

function fillMeasurements(host: HTMLElement, opts: { age: number; weight?: number; height?: number }) {
  const weight = host.querySelector('input[aria-label="Poids actuel"]') as HTMLInputElement
  const height = host.querySelector('input[aria-label="Taille"]') as HTMLInputElement
  const age = host.querySelector('input[aria-label="Âge"]') as HTMLInputElement
  const male = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Homme')

  const setNative = (el: HTMLInputElement, value: string) => {
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    proto?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  setNative(weight, String(opts.weight ?? 60))
  setNative(height, String(opts.height ?? 170))
  setNative(age, String(opts.age))
  male?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('QA BUG-01 — drapeau OFF coupe l’assistant calories', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('n’affiche pas le calcul calorique et n’enregistre aucun objectif chiffré', async () => {
    const saved: { current: CalorieProfile | null } = { current: null }
    const { host, cleanup } = await renderOnboarding((p) => {
      saved.current = p
    })

    expect(host.querySelector('[data-testid="onboarding-lite"]')).toBeTruthy()
    expect(host.textContent).not.toMatch(/on calcule tes calories/i)
    expect(host.textContent).toContain(M_INFO_1)

    await act(async () => {
      fillMeasurements(host, { age: 30, weight: 80, height: 180 })
    })

    const continuer = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(saved.current).not.toBeNull()
    expect(saved.current!.onboardingComplete).toBe(true)
    expect(saved.current!.goal).toBe('maintain')
    expect(saved.current!.weeklyPaceKg).toBe(0)
    expect(saved.current!.age).toBe(30)
    // Pas d’objectif de perte / rythme stocké comme plan calorique
    expect(saved.current!.goalWeightKg).toBe(saved.current!.weightKg)

    cleanup()
  })

  it('GlobalOnboardingScreen : sous-titre sans calcul calories quand OFF', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<GlobalOnboardingScreen onComplete={() => undefined} />)
    })
    const screen = host.querySelector('[data-testid="global-onboarding"]')
    expect(screen?.getAttribute('data-calorie-goal')).toBe('off')
    expect(host.textContent).not.toMatch(/on calcule tes calories/i)
    expect(host.textContent).toContain(M_INFO_1)
    root.unmount()
    host.remove()
  })
})

describe('QA BUG-02 — mineur 17 ans peut s’inscrire', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('enregistre l’âge et affiche Q6A + M_MIN_1 puis laisse entrer', async () => {
    const saved: { current: CalorieProfile | null } = { current: null }
    const { host, cleanup } = await renderOnboarding((p) => {
      saved.current = p
    })

    await act(async () => {
      fillMeasurements(host, { age: 17, weight: 60, height: 170 })
    })
    const continuer = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.querySelector('[data-testid="onboarding-exit"]')).toBeTruthy()
    expect(host.textContent).toContain(Q6A_MINEURS)
    expect(host.textContent).toContain(M_MIN_1)
    expect(host.textContent).not.toMatch(/Certaines fonctions de nutrition ne sont pas proposées avant 18 ans\.$/)

    await act(async () => {
      host
        .querySelector('[data-testid="exit-continue"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(saved.current).not.toBeNull()
    expect(saved.current!.age).toBe(17)
    expect(saved.current!.onboardingComplete).toBe(true)
    expect(saved.current!.goal).toBe('maintain')

    cleanup()
  })
})

describe('QA BUG-03 — grossesse / TCA : sortie vers l’app', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('grossesse : Q6B + bouton Continuer (pas d’écran vide)', async () => {
    const saved: { current: CalorieProfile | null } = { current: null }
    const { host, cleanup } = await renderOnboarding((p) => {
      saved.current = p
    })

    const pregnancy = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Grossesse'),
    )
    const checkbox = pregnancy?.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => {
      checkbox.click()
    })
    expect(checkbox.checked).toBe(true)

    await act(async () => {
      fillMeasurements(host, { age: 28, weight: 65, height: 165 })
    })

    const continuer = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.querySelector('[data-testid="onboarding-exit"]')).toBeTruthy()
    expect(host.textContent).toContain(Q6B_GROSSESSE_ALLAITEMENT)
    expect(host.querySelector('[data-testid="exit-continue"]')).toBeTruthy()

    await act(async () => {
      host
        .querySelector('[data-testid="exit-continue"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(saved.current?.declaredPregnancy).toBe(true)
    expect(saved.current?.onboardingComplete).toBe(true)

    cleanup()
  })

  it('TCA : M_TCA_1 + accès Besoin d’en parler ?', async () => {
    const { host, cleanup } = await renderOnboarding(() => undefined)

    const tca = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Trouble du comportement'),
    )
    const checkbox = tca?.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => {
      checkbox.click()
    })
    expect(host.textContent).toContain(M_TCA_1)

    await act(async () => {
      fillMeasurements(host, { age: 25, weight: 60, height: 170 })
    })

    const continuer = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.textContent).toContain(M_TCA_1)
    const talk = host.querySelector('[data-testid="exit-need-to-talk"]')
    expect(talk?.textContent).toContain(Q8_SCREEN_TITLE)

    await act(async () => {
      talk?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('[data-testid="need-to-talk-screen"]')).toBeTruthy()

    cleanup()
  })
})

describe('QA BUG-04 — sèche non refusée avant mensurations', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('choisir Sèche au premier écran n’affiche pas le refus trompeur', async () => {
    const { host, cleanup } = await renderOnboarding(() => undefined)

    const cutBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sèche') || b.textContent?.includes('Perte'),
    )
    // GoalPicker labels via GOAL_LABELS
    const goalButtons = Array.from(host.querySelectorAll('button'))
    const cut = goalButtons.find((b) => /sèche|cut|perte/i.test(b.textContent ?? ''))
    expect(cut || cutBtn).toBeTruthy()
    await act(async () => {
      ;(cut ?? cutBtn)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const continuer = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Continuer' || b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.textContent).not.toContain("Cet objectif de perte n’est pas proposé.")
    expect(host.textContent).not.toContain("Cet objectif de perte n'est pas proposé.")
    // On doit être passé à l'étape poids objectif
    expect(host.querySelector('input[aria-label="Poids objectif"]')).toBeTruthy()

    cleanup()
  })
})
