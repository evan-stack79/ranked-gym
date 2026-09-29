/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANIMATED_CIRCULAR_PROGRESS_DURATION } from '../ui/animated-circular-progress-bar.tokens'
import { NutritionCalorieRing } from './NutritionCalorieRing'

let host: HTMLDivElement
let root: Root

const base = {
  remainingCalories: 1200,
  consumedCalories: 800,
  targetCalories: 2000,
  onOpenSetup: () => undefined,
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  mockMatchMedia(false)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('NutritionCalorieRing', () => {
  it('garde la transition Magic UI 1s ease déjà active (sinon le fill snap)', async () => {
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.4} />)
    })
    const ring = host.querySelector('[data-calorie-ring]') as HTMLElement
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    expect(ring.getAttribute('data-motion')).toBe('animated')
    expect(fill.style.transition).toContain('stroke-dashoffset')
    expect(fill.style.transition).toContain(ANIMATED_CIRCULAR_PROGRESS_DURATION)
    expect(fill.style.transition).toContain('ease')
    expect(fill.style.strokeDasharray).toMatch(/px/)
    expect(parseFloat(fill.style.strokeDashoffset)).toBeGreaterThan(0)
  })

  it('met à jour dashoffset quand la progression augmente', async () => {
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.4} />)
    })
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    const before = parseFloat(fill.style.strokeDashoffset)
    await act(async () => {
      root.render(
        <NutritionCalorieRing
          {...base}
          remainingCalories={800}
          consumedCalories={1200}
          progress={0.6}
        />,
      )
    })
    const after = parseFloat(fill.style.strokeDashoffset)
    expect(after).toBeLessThan(before)
    expect(fill.style.transition).toContain('stroke-dashoffset 1s ease')
  })

  it('reste statique en reduced motion', async () => {
    mockMatchMedia(true)
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.3} reducedMotion />)
    })
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.7} reducedMotion />)
    })
    const ring = host.querySelector('[data-calorie-ring]') as HTMLElement
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    expect(ring.getAttribute('data-motion')).toBe('static')
    expect(fill.style.transition).toBe('none')
  })
})
