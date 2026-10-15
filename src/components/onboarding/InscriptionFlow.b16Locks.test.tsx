/**
 * @vitest-environment jsdom
 * B16 — « Je préfère ne pas répondre » verrouillé comme Aucune.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AUCUNE_LOCKED_HINT } from '../../content/safetyCopy'
import { BLANK_PROFILE } from '../../services/nutritionStorage'
import type { CalorieProfile } from '../../types/nutrition'
import { InscriptionFlow } from './InscriptionFlow'

describe('B16 — InscriptionFlow prefer_not lock', () => {
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

  it('situation true serveur : prefer_not disabled + AUCUNE_LOCKED_HINT verbatim', async () => {
    await goToHealth({
      ...BLANK_PROFILE,
      declaredEatingDisorder: true,
      healthAnswer: 'situations',
    })
    const prefer = container.querySelector(
      '[data-testid="inscription-health-prefer-not"]',
    ) as HTMLButtonElement
    expect(prefer.getAttribute('data-disabled')).toBe('true')
    expect(prefer.disabled).toBe(true)
    expect(
      container.querySelector('[data-testid="inscription-health-prefer-not-lock-hint"]')
        ?.textContent,
    ).toBe(AUCUNE_LOCKED_HINT)
    await act(async () => {
      prefer.click()
    })
    // Situation reste cochée — prefer_not n’efface rien.
    expect(
      container
        .querySelector('[data-testid="inscription-health-tca"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
