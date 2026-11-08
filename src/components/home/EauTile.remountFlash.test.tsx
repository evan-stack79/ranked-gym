/** @vitest-environment jsdom */
/**
 * Eau tile must never paint « 0 L » on remount when a value exists,
 * and must show a neutral placeholder (not 0) while water is still loading.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCountUpStableCacheForTests } from '../motion/CountUpNumber'

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))

vi.mock('../../hooks/useInViewOnce', () => ({
  useInViewOnce: () => ({ ref: { current: null }, inView: true }),
}))

describe('EauTile remount / loading flash', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    resetCountUpStableCacheForTests()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    resetCountUpStableCacheForTests()
  })

  it('never renders 0 L on remount when a value exists', async () => {
    const { EauTile } = await import('./AccueilMetricTiles')
    const { deriveWaterTileModel } = await import('../../utils/accueilWidgetTiles')
    const model = deriveWaterTileModel(1200, null, true)

    await act(async () => {
      root.render(
        <EauTile
          model={model}
          motion={{ coldEntering: false, prefersReducedMotion: true, freezeCountUp: true }}
          onSetGoal={() => {}}
        />,
      )
    })
    expect(host.textContent).toContain('1,2')
    expect(host.textContent).not.toMatch(/\b0\s*L\b/)

    await act(async () => {
      root.render(<span data-gap />)
    })
    await act(async () => {
      root.render(
        <EauTile
          model={model}
          motion={{ coldEntering: false, prefersReducedMotion: true, freezeCountUp: true }}
          onSetGoal={() => {}}
        />,
      )
    })

    const text = host.textContent ?? ''
    expect(text).toContain('1,2')
    expect(text).not.toMatch(/\b0\s*L\b/)
    expect(host.querySelector('[data-rg-count="water"]')?.textContent).toContain('1,2')
  })

  it('shows neutral placeholder (not 0 L) while water is loading', async () => {
    const { EauTile } = await import('./AccueilMetricTiles')
    const { deriveWaterTileModel } = await import('../../utils/accueilWidgetTiles')
    const loading = deriveWaterTileModel(0, null, false)

    await act(async () => {
      root.render(
        <EauTile
          model={loading}
          motion={{ coldEntering: false, prefersReducedMotion: true }}
          onSetGoal={() => {}}
        />,
      )
    })

    expect(host.querySelector('[data-accueil-eau-placeholder="1"]')).toBeTruthy()
    expect(host.textContent).toContain('—')
    expect(host.querySelector('[data-rg-count="water"]')).toBeNull()
  })
})
