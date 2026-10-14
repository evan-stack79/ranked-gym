/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { YourDataMealsErasePanel } from './YourDataMealsEraseCard'
import {
  ERASE_MEALS_CONNECT_MESSAGE,
  ERASE_MEALS_COUNT_UNKNOWN_MESSAGE,
  ERASE_MEALS_NONE_MESSAGE,
} from '../../services/eraseUserMeals'

describe('YourDataMealsErasePanel — B6', () => {
  it('toujours visible ; serveur 0 + pending 0 → Aucun ancien repas, bouton disabled', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onConfirm = vi.fn()

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          serverCount={0}
          pendingCount={0}
          countMode="none"
          eraseDisabled
          confirmOpen={false}
          onConfirmOpenChange={onConfirm}
          onRequestErase={vi.fn()}
        />,
      )
    })

    expect(host.querySelector('[data-testid="your-data-meals-section"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="erase-old-meals-count"]')?.textContent).toBe(
      ERASE_MEALS_NONE_MESSAGE,
    )
    const button = host.querySelector(
      '[data-testid="erase-old-meals-button"]',
    ) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    await act(async () => {
      button.click()
    })
    expect(onConfirm).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('count serveur + ligne pending séparée', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          serverCount={12}
          pendingCount={3}
          countMode="ready"
          confirmOpen={false}
          onConfirmOpenChange={vi.fn()}
          onRequestErase={vi.fn()}
        />,
      )
    })

    expect(host.querySelector('[data-testid="erase-old-meals-count"]')?.textContent).toMatch(
      /12 repas gardés/,
    )
    expect(host.querySelector('[data-testid="erase-old-meals-pending"]')?.textContent).toBe(
      '+ 3 repas pas encore envoyés',
    )
    expect(host.textContent).not.toContain('Skyr')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('serveur muet → Nombre inconnu, erase bloqué', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onConfirm = vi.fn()

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          serverCount={0}
          countMode="unknown"
          eraseDisabled
          confirmOpen={false}
          onConfirmOpenChange={onConfirm}
          onRequestErase={vi.fn()}
        />,
      )
    })

    expect(host.querySelector('[data-testid="erase-old-meals-count"]')?.textContent).toBe(
      ERASE_MEALS_COUNT_UNKNOWN_MESSAGE,
    )
    const button = host.querySelector(
      '[data-testid="erase-old-meals-button"]',
    ) as HTMLButtonElement
    expect(button.disabled).toBe(true)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('signé out : tap → Connecte-toi immédiatement', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onConfirmOpenChange = vi.fn()
    const onSignedOutTap = vi.fn()

    await act(async () => {
      root.render(
        <YourDataMealsErasePanel
          serverCount={0}
          countMode="signed_out"
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
          serverCount={0}
          countMode="signed_out"
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

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
