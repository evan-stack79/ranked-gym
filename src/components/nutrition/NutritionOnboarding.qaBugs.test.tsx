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

function setNative(el: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  proto?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function fillAgeSex(host: HTMLElement, ageYears: number, sexLabel: 'Homme' | 'Femme' = 'Homme') {
  const age = host.querySelector('input[aria-label="Âge"]') as HTMLInputElement
  const sexBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === sexLabel)
  setNative(age, String(ageYears))
  sexBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** Drive NumberWheel via keyboard (Home → ArrowDown × N). */
async function setWheelTo(host: HTMLElement, ariaLabel: string, target: number, min: number) {
  const slider = () => host.querySelector(`[role="slider"][aria-label="${ariaLabel}"]`) as HTMLElement
  expect(slider()).toBeTruthy()
  await act(async () => {
    slider().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
  })
  const steps = Math.max(0, Math.round(target - min))
  for (let i = 0; i < steps; i += 1) {
    await act(async () => {
      slider().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
  }
}

async function fillBody(host: HTMLElement, opts?: { weight?: number; height?: number }) {
  const weight = opts?.weight ?? 60
  const height = opts?.height ?? 170
  // Ensure weight tab
  const weightTab = host.querySelector('[data-testid="height-weight-tab-weight"]') as HTMLButtonElement | null
  if (weightTab) {
    await act(async () => {
      weightTab.click()
    })
  }
  await setWheelTo(host, 'Poids en kg', weight, 30)
  const heightTab = host.querySelector('[data-testid="height-weight-tab-height"]') as HTMLButtonElement
  await act(async () => {
    heightTab.click()
  })
  await setWheelTo(host, 'Taille en cm', height, 100)
}

async function fillAdultMeasurements(
  host: HTMLElement,
  opts: { age: number; weight?: number; height?: number },
) {
  await act(async () => {
    fillAgeSex(host, opts.age)
  })
  await fillBody(host, opts)
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

    await fillAdultMeasurements(host, { age: 30, weight: 80, height: 180 })

    const continuer = host.querySelector(
      '[data-testid="height-weight-continue"]',
    ) as HTMLButtonElement | null
    expect(continuer).toBeTruthy()
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // « C’est noté. » puis sauvegarde async (~700ms)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800))
    })

    expect(saved.current).not.toBeNull()
    expect(saved.current!.onboardingComplete).toBe(true)
    expect(saved.current!.goal).toBe('maintain')
    expect(saved.current!.weeklyPaceKg).toBe(0)
    expect(saved.current!.age).toBe(30)
    // Pas d’objectif de perte / rythme stocké comme plan calorique
    expect(saved.current!.goalWeightKg).toBe(saved.current!.weightKg)
    expect(saved.current!.weightKg).toBe(80)
    expect(saved.current!.heightCm).toBe(180)

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
      fillAgeSex(host, 17)
    })
    // BUG-08 : pas de champs poids/taille pour un mineur
    expect(host.querySelector('[data-testid="onboarding-body-fields"]')).toBeNull()
    expect(host.querySelector('input[aria-label="Poids actuel"]')).toBeNull()

    const continuer = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.querySelector('[data-testid="onboarding-exit"]')).toBeTruthy()
    expect(host.textContent).toContain(Q6A_MINEURS)
    expect(host.textContent).toContain(M_MIN_1)

    await act(async () => {
      host
        .querySelector('[data-testid="exit-continue"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(saved.current).not.toBeNull()
    expect(saved.current!.age).toBe(17)
    expect(saved.current!.weightKg).toBeNull()
    expect(saved.current!.heightCm).toBeNull()
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

    // Grossesse → roue corps masquée ; âge + Femme (Homme ignorerait Grossesse)
    await act(async () => {
      fillAgeSex(host, 28, 'Femme')
    })
    expect(host.querySelector('[data-testid="height-weight-picker"]')).toBeNull()

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
      fillAgeSex(host, 25)
    })
    expect(host.querySelector('[data-testid="height-weight-picker"]')).toBeNull()

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

describe('QA BUG-31 — TCA dès l’étape 1 interrompt l’assistant (drapeau ON)', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('cocher TCA → sortie immédiate, pas de Sèche ni poids objectif', async () => {
    const { host, cleanup } = await renderOnboarding(() => undefined)

    const tca = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Trouble du comportement'),
    )
    await act(async () => {
      tca?.querySelector('input[type="checkbox"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
      ;(tca?.querySelector('input[type="checkbox"]') as HTMLInputElement | null)?.click()
    })

    expect(host.querySelector('[data-testid="onboarding-exit"]')).toBeTruthy()
    expect(host.textContent).toContain(M_TCA_1)
    expect(host.textContent).not.toMatch(/Sèche/)
    expect(host.querySelector('input[aria-label="Poids objectif"]')).toBeNull()
    expect(host.querySelector('[data-testid="exit-need-to-talk"]')).toBeTruthy()

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
    // BUG-08 ON : étape suivante = mensurations (âge), pas encore poids objectif
    expect(host.textContent).toContain('Tes mensurations')
    expect(host.querySelector('input[aria-label="Âge"]')).toBeTruthy()
    expect(host.querySelector('input[aria-label="Poids objectif"]')).toBeNull()

    cleanup()
  })
})

describe('QA BUG-36 — adulte à risque OFF sans poids/taille peut terminer', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', '')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it.each([
    { label: 'Grossesse', field: 'declaredPregnancy' as const, sex: 'Femme' as const },
    { label: 'Allaitement', field: 'declaredBreastfeeding' as const, sex: 'Femme' as const },
    { label: 'Trouble du comportement', field: 'declaredEatingDisorder' as const, sex: 'Homme' as const },
  ])(
    '$label : Continuer vers l’app sans poids ni taille',
    async ({ label, field, sex }) => {
      const saved: { current: CalorieProfile | null } = { current: null }
      const { host, cleanup } = await renderOnboarding((p) => {
        saved.current = p
      })

      const row = Array.from(host.querySelectorAll('label')).find((l) =>
        l.textContent?.includes(label),
      )
      await act(async () => {
        ;(row?.querySelector('input[type="checkbox"]') as HTMLInputElement | null)?.click()
      })

      await act(async () => {
        fillAgeSex(host, 30, sex)
      })
      // Situations à risque : roue taille/poids masquée (pas de saisie corps)
      expect(host.querySelector('[data-testid="height-weight-picker"]')).toBeNull()
      expect(host.querySelector('[data-testid="onboarding-body-fields"]')).toBeNull()

      const continuer = Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Continuer'),
      )
      await act(async () => {
        continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(host.querySelector('[data-testid="onboarding-exit"]')).toBeTruthy()
      expect(host.querySelector('[data-testid="onboarding-error"]')).toBeNull()

      await act(async () => {
        host
          .querySelector('[data-testid="exit-continue"]')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(host.querySelector('[data-testid="onboarding-error"]')).toBeNull()
      expect(saved.current).not.toBeNull()
      expect(saved.current![field]).toBe(true)
      expect(saved.current!.onboardingComplete).toBe(true)
      expect(saved.current!.age).toBe(30)
      expect(saved.current!.weightKg).toBeNull()
      expect(saved.current!.heightCm).toBeNull()

      cleanup()
    },
  )
})

describe('QA BUG-08 ON — pas de poids objectif / rythme avant l’âge', () => {
  const prev = import.meta.env.VITE_ENABLE_CALORIE_GOAL

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', 'true')
  })

  afterEach(() => {
    if (prev === undefined) vi.unstubAllEnvs()
    else vi.stubEnv('VITE_ENABLE_CALORIE_GOAL', prev)
  })

  it('mineur 17 ans : jamais « Ton poids objectif » ni « Ton rythme »', async () => {
    const saved: { current: CalorieProfile | null } = { current: null }
    const { host, cleanup } = await renderOnboarding((p) => {
      saved.current = p
    })

    const goalButtons = Array.from(host.querySelectorAll('button'))
    const cut = goalButtons.find((b) => /sèche|cut|perte/i.test(b.textContent ?? ''))
    await act(async () => {
      cut?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const continuer = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.textContent).toContain('Tes mensurations')
    expect(host.querySelector('input[aria-label="Poids objectif"]')).toBeNull()
    expect(host.textContent).not.toContain('Ton rythme')

    await act(async () => {
      fillAgeSex(host, 17)
    })
    expect(host.querySelector('[data-testid="height-weight-picker"]')).toBeNull()

    const continuer2 = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continuer'),
    )
    await act(async () => {
      continuer2?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(host.querySelector('[data-testid="onboarding-exit"]')).toBeTruthy()
    expect(host.textContent).toContain(Q6A_MINEURS)
    expect(host.querySelector('input[aria-label="Poids objectif"]')).toBeNull()
    expect(host.textContent).not.toContain('Ton rythme')

    await act(async () => {
      host
        .querySelector('[data-testid="exit-continue"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(saved.current?.age).toBe(17)
    expect(saved.current?.goal).toBe('maintain')
    expect(saved.current?.goalWeightKg).toBeNull()

    cleanup()
  })
})
