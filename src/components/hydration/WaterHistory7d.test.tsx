/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { lastNDayKeys, localDayKey } from '../../shared/hydration'

const fetchHydrationHistory = vi.fn()

vi.mock('../../services/hydration/hydrationService', () => ({
  fetchHydrationHistory: (...args: unknown[]) => fetchHydrationHistory(...args),
}))

describe('WaterHistory7d', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    fetchHydrationHistory.mockReset()
    const today = localDayKey()
    fetchHydrationHistory.mockResolvedValue(
      lastNDayKeys(today, 7).map((dayKey, i) => ({
        dayKey,
        drunkMl: i === 6 ? 1200 : 400,
      })),
    )
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('recharge à l’ouverture (active true)', async () => {
    const { WaterHistory7d } = await import('./WaterHistory7d')
    await act(async () => {
      root.render(<WaterHistory7d goalMl={1500} active={false} />)
    })
    expect(fetchHydrationHistory).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<WaterHistory7d goalMl={1500} active />)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(fetchHydrationHistory).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[data-hydration-history]')).toBeTruthy()
    expect(host.textContent).toContain('7 derniers jours')
  })
})
