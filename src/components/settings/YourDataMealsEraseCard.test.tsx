/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { YourDataMealsErasePanel } from './YourDataMealsEraseCard'
import { ERASE_MEALS_CONNECT_MESSAGE } from '../../services/eraseUserMeals'

describe('YourDataMealsErasePanel', () => {
  it('toujours visible même avec count 0', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          count={0}
          confirmOpen={false}
          onConfirmOpenChange={vi.fn()}
          onRequestErase={vi.fn()}
        />,
      )
    })

    expect(host.querySelector('[data-testid="your-data-meals-section"]')).toBeTruthy()
    expect(host.textContent).toContain('Effacer mes anciens repas')
    expect(host.querySelector('[data-testid="erase-old-meals-count"]')?.textContent).toMatch(
      /0 repas gardé/,
    )

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('affiche le compteur sans détails de repas', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          count={12}
          confirmOpen={false}
          onConfirmOpenChange={vi.fn()}
          onRequestErase={vi.fn()}
        />,
      )
    })

    expect(host.querySelector('[data-testid="erase-old-meals-count"]')?.textContent).toMatch(
      /12 repas gardés/,
    )
    expect(host.textContent).not.toContain('Skyr')
    expect(host.textContent).not.toMatch(/export/i)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('signé out : tap → Connecte-toi pour effacer immédiatement, sans confirmation', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onConfirmOpenChange = vi.fn()
    const onSignedOutTap = vi.fn()

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          count={0}
          signedOut
          confirmOpen={false}
          onConfirmOpenChange={onConfirmOpenChange}
          onSignedOutTap={onSignedOutTap}
          onRequestErase={vi.fn()}
          error={null}
        />,
      )
    })

    const button = host.querySelector(
      '[data-testid="erase-old-meals-button"]',
    ) as HTMLButtonElement
    await act(async () => {
      button.click()
    })

    expect(onSignedOutTap).toHaveBeenCalled()
    expect(onConfirmOpenChange).not.toHaveBeenCalled()

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          count={0}
          signedOut
          confirmOpen={false}
          onConfirmOpenChange={onConfirmOpenChange}
          onSignedOutTap={onSignedOutTap}
          onRequestErase={vi.fn()}
          error={ERASE_MEALS_CONNECT_MESSAGE}
        />,
      )
    })

    expect(host.querySelector('[data-testid="erase-old-meals-signed-out-error"]')?.textContent).toBe(
      ERASE_MEALS_CONNECT_MESSAGE,
    )
    expect(document.body.textContent).not.toContain('Oui, tout effacer')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
