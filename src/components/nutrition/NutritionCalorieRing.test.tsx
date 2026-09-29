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
  it('ne joue pas le fill Magic UI sur la première valeur hydratée', async () => {
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0} ready={false} dateKey="2026-09-29" />)
    })
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.4} ready dateKey="2026-09-29" />)
    })
    const ring = host.querySelector('[data-calorie-ring]') as HTMLElement
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    expect(ring.getAttribute('data-motion')).toBe('static')
    expect(fill.style.transition).toBe('none')
    expect(fill.style.getPropertyValue('--stroke-percent')).toBe('40')
  })

  it('anime stroke-dasharray 1s ease quand la progression augmente', async () => {
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.4} ready dateKey="2026-09-29" />)
    })
    await act(async () => {
      root.render(
        <NutritionCalorieRing
          {...base}
          remainingCalories={800}
          consumedCalories={1200}
          progress={0.6}
          ready
          dateKey="2026-09-29"
        />,
      )
    })
    const ring = host.querySelector('[data-calorie-ring]') as HTMLElement
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    const indicator = host.querySelector('[data-calorie-ring-indicator]') as HTMLElement
    expect(ring.getAttribute('data-motion')).toBe('animated')
    expect(fill.style.transition).toContain('stroke-dasharray')
    expect(fill.style.transition).toContain(ANIMATED_CIRCULAR_PROGRESS_DURATION)
    expect(fill.style.transition).toContain('ease')
    expect(fill.style.getPropertyValue('--transition-length')).toBe(
      ANIMATED_CIRCULAR_PROGRESS_DURATION,
    )
    expect(fill.style.getPropertyValue('--stroke-percent')).toBe('60')
    expect(indicator.style.transition).toContain('transform')
  })

  it('ne joue pas l’animation si les calories baissent', async () => {
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.6} ready dateKey="2026-09-29" />)
    })
    await act(async () => {
      root.render(
        <NutritionCalorieRing
          {...base}
          remainingCalories={1600}
          consumedCalories={400}
          progress={0.2}
          ready
          dateKey="2026-09-29"
        />,
      )
    })
    const ring = host.querySelector('[data-calorie-ring]') as HTMLElement
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    expect(ring.getAttribute('data-motion')).toBe('static')
    expect(fill.style.transition).toBe('none')
    expect(fill.style.getPropertyValue('--stroke-percent')).toBe('20')
  })

  it('snap au changement de jour même si le pourcentage monte', async () => {
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.2} ready dateKey="2026-09-28" />)
    })
    await act(async () => {
      root.render(<NutritionCalorieRing {...base} progress={0.8} ready dateKey="2026-09-29" />)
    })
    const ring = host.querySelector('[data-calorie-ring]') as HTMLElement
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    expect(ring.getAttribute('data-motion')).toBe('static')
    expect(fill.style.transition).toBe('none')
    expect(fill.style.getPropertyValue('--stroke-percent')).toBe('80')
  })

  it('reste statique en reduced motion', async () => {
    mockMatchMedia(true)
    await act(async () => {
      root.render(
        <NutritionCalorieRing {...base} progress={0.3} ready dateKey="2026-09-29" reducedMotion />,
      )
    })
    await act(async () => {
      root.render(
        <NutritionCalorieRing {...base} progress={0.7} ready dateKey="2026-09-29" reducedMotion />,
      )
    })
    const ring = host.querySelector('[data-calorie-ring]') as HTMLElement
    const fill = host.querySelector('[data-calorie-ring-fill]') as SVGCircleElement
    expect(ring.getAttribute('data-motion')).toBe('static')
    expect(fill.style.transition).toBe('none')
  })
})
