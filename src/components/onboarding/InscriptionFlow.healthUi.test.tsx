/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InscriptionFlow } from './InscriptionFlow'
import { BLANK_PROFILE } from '../../services/nutritionStorage'

describe('InscriptionFlow Santé choice styles', () => {
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

  async function goToHealth() {
    act(() => {
      root.render(<InscriptionFlow initial={{ ...BLANK_PROFILE }} onComplete={() => {}} />)
    })
    // welcome → age
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-continue"]') as HTMLButtonElement).click()
    })
    // age → sex (Plus tard)
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-later"]') as HTMLButtonElement).click()
    })
    // sex → health (Plus tard)
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-later"]') as HTMLButtonElement).click()
    })
    expect(container.querySelector('[data-testid="inscription-health"]')).toBeTruthy()
  }

  it('Grossesse / Allaitement / TCA use square checkboxes; exclusives use radios', async () => {
    await goToHealth()
    expect(
      container.querySelector('[data-testid="inscription-health-pregnancy"]')?.getAttribute(
        'data-choice-style',
      ),
    ).toBe('checkbox')
    expect(
      container.querySelector('[data-testid="inscription-health-breastfeeding"]')?.getAttribute(
        'data-choice-style',
      ),
    ).toBe('checkbox')
    expect(
      container.querySelector('[data-testid="inscription-health-tca"]')?.getAttribute(
        'data-choice-style',
      ),
    ).toBe('checkbox')
    expect(container.querySelector('[data-testid="inscription-health-pregnancy-checkbox"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="inscription-health-none"]')?.getAttribute(
      'data-choice-style',
    )).toBe('radio')
    expect(container.querySelector('[data-testid="inscription-health-prefer-not"]')?.getAttribute(
      'data-choice-style',
    )).toBe('radio')
    expect(container.querySelector('[data-testid="inscription-health-none-radio"]')).toBeTruthy()
  })

  it('multi-select allows Grossesse + TCA; Aucune clears them', async () => {
    await goToHealth()
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-health-pregnancy"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-health-tca"]') as HTMLButtonElement).click()
    })
    expect(
      container.querySelector('[data-testid="inscription-health-pregnancy"]')?.getAttribute(
        'aria-pressed',
      ),
    ).toBe('true')
    expect(
      container.querySelector('[data-testid="inscription-health-tca"]')?.getAttribute('aria-pressed'),
    ).toBe('true')

    await act(async () => {
      ;(container.querySelector('[data-testid="inscription-health-none"]') as HTMLButtonElement).click()
    })
    expect(
      container.querySelector('[data-testid="inscription-health-pregnancy"]')?.getAttribute(
        'aria-pressed',
      ),
    ).toBe('false')
    expect(
      container.querySelector('[data-testid="inscription-health-tca"]')?.getAttribute('aria-pressed'),
    ).toBe('false')
    expect(
      container.querySelector('[data-testid="inscription-health-none"]')?.getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('progress data-progress is 1 on C’est prêt after full path', async () => {
    act(() => {
      root.render(<InscriptionFlow initial={{ ...BLANK_PROFILE }} onComplete={() => {}} />)
    })
    // Skip through with Plus tard until ready (weight may appear)
    for (let i = 0; i < 8; i += 1) {
      const ready = container.querySelector('[data-testid="inscription-ready"]')
      if (ready) break
      const later = container.querySelector('[data-testid="inscription-later"]') as HTMLButtonElement | null
      const cont = container.querySelector('[data-testid="inscription-continue"]') as HTMLButtonElement | null
      await act(async () => {
        if (later && !later.disabled) later.click()
        else cont?.click()
      })
    }
    expect(container.querySelector('[data-testid="inscription-ready"]')).toBeTruthy()
    const bar = container.querySelector('[data-testid="inscription-progress"] [data-progress]')
    expect(bar?.getAttribute('data-progress')).toBe('1')
  })
})
