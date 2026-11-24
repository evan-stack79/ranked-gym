/** @vitest-environment jsdom */
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentMorphButton } from './PaymentMorphButton'

describe('PaymentMorphButton', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    vi.unstubAllGlobals()
  })

  it('affiche Payer 9,99 € puis Payé après succès', async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <PaymentMorphButton
            offerKey="solo_monthly"
            resetAfter={0}
            onPay={async () => undefined}
          />
        </StrictMode>,
      )
    })
    const morph = host.querySelector('[data-dissolve="morph-button"]') as HTMLElement
    expect(morph).not.toBeNull()
    expect(host.textContent).toContain('Payer 9,99 €')

    await act(async () => {
      morph.click()
      await new Promise((r) => setTimeout(r, 40))
    })
    expect(morph.dataset.phase === 'done' || morph.dataset.phase === 'loading').toBe(true)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    expect(morph.dataset.phase).toBe('done')
    expect(host.textContent).toContain('Payé')
  })

  it('échec : retour idle + onPay a rejeté', async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <PaymentMorphButton
            offerKey="solo_yearly"
            resetAfter={0}
            onPay={async () => {
              throw new Error('USER_CANCELLED')
            }}
          />
        </StrictMode>,
      )
    })
    const morph = host.querySelector('[data-dissolve="morph-button"]') as HTMLElement
    expect(host.textContent).toContain('Payer 89,99 €')
    await act(async () => {
      morph.click()
      await new Promise((r) => setTimeout(r, 100))
    })
    expect(morph.dataset.phase).toBe('idle')
    expect(host.textContent).toContain('Payer 89,99 €')
  })
})
