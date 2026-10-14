/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { YourDataMealsErasePanel } from './YourDataMealsEraseCard'

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
})
