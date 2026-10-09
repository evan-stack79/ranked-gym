/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LivingProgressBar } from './LivingProgressBar'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reduced && String(query).includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('LivingProgressBar', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    vi.useFakeTimers()
    mockMatchMedia(false)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(performance.now()), 0) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('prefers-reduced-motion shows final fill instantly', () => {
    mockMatchMedia(true)
    act(() => {
      root.render(<LivingProgressBar value={0.75} instant={false} />)
    })
    const el = host.querySelector('[data-rg-anim="living-progress"]') as HTMLElement
    expect(el.getAttribute('data-rg-progress')).toBe('75')
    const fill = host.querySelector('.rg-living-progress__fill') as HTMLElement
    expect(fill.style.transform).toContain('0.75')
  })

  it('sparks once at 100%, then marks sparked (no repeat strobe)', async () => {
    act(() => {
      root.render(<LivingProgressBar value={0.5} sparksAtFull />)
    })
    act(() => {
      root.render(<LivingProgressBar value={1} sparksAtFull />)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(host.querySelector('.rg-living-progress__sparks')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })
    const bar = host.querySelector('[data-rg-anim="living-progress"]') as HTMLElement
    expect(bar.getAttribute('data-rg-sparked')).toBe('1')
    expect(host.querySelector('.rg-living-progress__sparks')).toBeNull()
  })

  it('kcal/weight metrics must not use LivingProgressBar', () => {
    const nutrition = readFileSync(
      join(process.cwd(), 'src/components/nutrition/NutritionCalorieRing.tsx'),
      'utf8',
    )
    expect(nutrition).not.toMatch(/LivingProgressBar/)
    const personal = readFileSync(
      join(process.cwd(), 'src/components/settings/PersonalInformationScreen.tsx'),
      'utf8',
    )
    expect(personal).not.toMatch(/LivingProgressBar/)
  })
})
