/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))

vi.mock('../../hooks/useInViewOnce', () => ({
  useInViewOnce: () => ({ ref: { current: null }, inView: true }),
}))

const store = new Map<string, string>()

describe('EauTile reads shared userWaterGoal', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      clear: () => store.clear(),
    })
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    vi.unstubAllGlobals()
  })

  it('sans objectif : total + « Choisir mon objectif », pas d’anneau / %', async () => {
    const { EauTile } = await import('./AccueilMetricTiles')
    const { deriveWaterTileModel } = await import('../../utils/accueilWidgetTiles')
    const { getUserWaterGoalMl } = await import('../../utils/userWaterGoal')

    expect(getUserWaterGoalMl()).toBeNull()
    const model = deriveWaterTileModel(1200, getUserWaterGoalMl())

    await act(async () => {
      root.render(
        <EauTile
          model={model}
          motion={{ coldEntering: false, prefersReducedMotion: true }}
          onSetGoal={() => {}}
        />,
      )
    })

    const text = host.textContent ?? ''
    expect(text.replace(/\s/g, '')).toContain('1200')
    expect(text).toContain('Choisir mon objectif')
    expect(text).not.toMatch(/\b250\b/)
    expect(text).not.toMatch(/\b6000\b/)
    expect(host.querySelector('[data-accueil-ring]')).toBeNull()
    expect(text).not.toMatch(/%/)
  })

  it('avec objectif userWaterGoal : anneau + « sur … »', async () => {
    const { setUserWaterGoalMl, getUserWaterGoalMl } = await import('../../utils/userWaterGoal')
    const { EauTile } = await import('./AccueilMetricTiles')
    const { deriveWaterTileModel } = await import('../../utils/accueilWidgetTiles')

    expect(setUserWaterGoalMl(2500)).toBe(true)
    const model = deriveWaterTileModel(1200, getUserWaterGoalMl())

    await act(async () => {
      root.render(
        <EauTile
          model={model}
          motion={{ coldEntering: false, prefersReducedMotion: true }}
          onSetGoal={() => {}}
        />,
      )
    })

    const text = host.textContent ?? ''
    expect(host.querySelector('[data-accueil-ring]')).toBeTruthy()
    expect(text).toContain('sur 2,5 L')
    expect(text).not.toContain('Choisir mon objectif')
    expect(text).not.toMatch(/\b250\b/)
    expect(text).not.toMatch(/\b6000\b/)
  })
})
