/**
 * @vitest-environment jsdom
 * B15 — TCA verrouillé + Aucune disabled quand serveur a true.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AUCUNE_LOCKED_HINT, TCA_LOCKED_MESSAGE } from '../../content/safetyCopy'
import { SUPPORT_EMAIL, WRITE_TO_US_LABEL } from '../../config/contact'
import { BLANK_PROFILE } from '../../services/nutritionStorage'
import type { CalorieProfile } from '../../types/nutrition'
import { InscriptionFlow } from './InscriptionFlow'

describe('B15 — InscriptionFlow TCA / Aucune locks', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  async function goToHealth(initial: CalorieProfile) {
    act(() => {
      root.render(<InscriptionFlow initial={initial} onComplete={() => {}} />)
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-continue"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-later"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-later"]') as HTMLButtonElement).click()
    })
    expect(container.querySelector('[data-testid="inscription-health"]')).toBeTruthy()
  }

  it('profil jamais envoyé : TCA libre (check/uncheck)', async () => {
    await goToHealth({ ...BLANK_PROFILE })
    const tca = container.querySelector('[data-testid="inscription-health-tca"]') as HTMLButtonElement
    expect(tca.getAttribute('data-disabled')).toBe('false')
    await act(async () => {
      tca.click()
    })
    expect(tca.getAttribute('aria-pressed')).toBe('true')
    await act(async () => {
      tca.click()
    })
    expect(tca.getAttribute('aria-pressed')).toBe('false')
  })

  it('TCA true serveur : case cochée, disabled, message + Nous écrire', async () => {
    await goToHealth({
      ...BLANK_PROFILE,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    const tca = container.querySelector('[data-testid="inscription-health-tca"]') as HTMLButtonElement
    expect(tca.getAttribute('data-disabled')).toBe('true')
    expect(tca.getAttribute('aria-pressed')).toBe('true')
    expect(tca.disabled).toBe(true)
    expect(
      container.querySelector('[data-testid="inscription-health-tca-contact-message"]')?.textContent,
    ).toBe(TCA_LOCKED_MESSAGE)
    expect(
      container.querySelector('[data-testid="inscription-health-tca-contact-write-btn"]')?.textContent,
    ).toBe(WRITE_TO_US_LABEL)
    expect(
      container.querySelector('[data-testid="inscription-health-tca-contact-address"]')?.textContent,
    ).toBe(SUPPORT_EMAIL)
    await act(async () => {
      tca.click()
    })
    expect(tca.getAttribute('aria-pressed')).toBe('true')
  })

  it('situation true serveur : Aucune disabled + hint, rien n’est effacé', async () => {
    await goToHealth({
      ...BLANK_PROFILE,
      declaredDiabetes: true,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    const none = container.querySelector(
      '[data-testid="inscription-health-none"]',
    ) as HTMLButtonElement
    expect(none.getAttribute('data-disabled')).toBe('true')
    expect(none.disabled).toBe(true)
    expect(container.querySelector('[data-testid="inscription-health-none-lock-hint"]')?.textContent).toBe(
      AUCUNE_LOCKED_HINT,
    )
    await act(async () => {
      none.click()
    })
    expect(
      container.querySelector('[data-testid="inscription-health-tca"]')?.getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
