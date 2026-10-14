/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { YourDataMealsErasePanel } from './YourDataMealsEraseCard'
import { ERASE_MEALS_CONNECT_MESSAGE } from '../../services/eraseUserMeals'

describe('YourDataMealsErasePanel', () => {
  it('affiche le compteur sans détails de repas ; masqué si 0', async () => {
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

    expect(host.querySelector('[data-testid="your-data-meals-section"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="erase-old-meals-count"]')?.textContent).toMatch(
      /12 repas gardés/,
    )
    expect(host.textContent).toContain('Effacer mes anciens repas')
    expect(host.textContent).not.toContain('Skyr')
    expect(host.textContent).not.toContain('Pomme')
    expect(host.textContent).not.toMatch(/export/i)

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
    expect(host.querySelector('[data-testid="your-data-meals-section"]')).toBeNull()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('affiche Connecte-toi pour effacer quand fourni en erreur', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          count={3}
          confirmOpen
          onConfirmOpenChange={vi.fn()}
          onRequestErase={vi.fn()}
          error={ERASE_MEALS_CONNECT_MESSAGE}
        />,
      )
    })

    // IosSheet porte via createPortal → document.body
    expect(document.body.textContent).toContain(ERASE_MEALS_CONNECT_MESSAGE)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
