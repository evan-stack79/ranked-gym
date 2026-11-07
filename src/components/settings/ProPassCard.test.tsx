import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProPassCard } from './ProPassCard'

describe('ProPassCard', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    host.remove()
  })

  it('affiche le copy Ranked Pro validé (essai 9,99 €, bénéfices, CTAs)', async () => {
    const onTryFree = vi.fn()
    const onDismiss = vi.fn()
    const onViewFreeOffer = vi.fn()
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <ProPassCard
          onTryFree={onTryFree}
          onDismiss={onDismiss}
          onViewFreeOffer={onViewFreeOffer}
        />,
      )
    })

    const text = host.textContent ?? ''
    expect(text).toContain('Ranked Pro')
    expect(text).toContain(
      "7 jours d'essai gratuit, ensuite 9,99 euros par mois, résiliable à tout moment",
    )
    expect(text).toContain('classements illimités')
    expect(text).toContain('duels sans publicité')
    expect(text).toContain('statistiques détaillées')
    expect(text).toContain('Essayer gratuitement')
    expect(text).toContain("Voir l'offre gratuite")
    expect(text).not.toContain('6,99')
    expect(text).not.toContain('Passe Pro')
    expect(text).not.toContain('Pass Pro')
    expect(text).not.toContain('Débloque')

    const buttons = Array.from(host.querySelectorAll('button'))
    const secondary = buttons.find((b) => b.textContent === "Voir l'offre gratuite")
    expect(secondary).toBeTruthy()
    await act(async () => {
      secondary?.click()
    })
    expect(onViewFreeOffer).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.unmount()
    })
  })
})
