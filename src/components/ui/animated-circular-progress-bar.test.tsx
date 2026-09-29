/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ANIMATED_CIRCULAR_PROGRESS_DURATION,
  circularProgressTransition,
} from './animated-circular-progress-bar.tokens'
import { AnimatedCircularProgressBar } from './animated-circular-progress-bar'
import AnimatedCircularProgressBarDemo from './animated-circular-progress-bar.demo'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('AnimatedCircularProgressBar', () => {
  it('affiche le pourcentage et le fill Magic UI', async () => {
    await act(async () => {
      root.render(
        <AnimatedCircularProgressBar
          value={42}
          gaugePrimaryColor="#FF2B2B"
          gaugeSecondaryColor="#2A2A2E"
        />,
      )
    })
    const rootEl = host.querySelector('[data-animated-circular-progress]') as HTMLElement
    const primary = host.querySelector('[data-gauge-primary]') as SVGCircleElement
    expect(rootEl.getAttribute('data-motion')).toBe('animated')
    expect(rootEl.style.getPropertyValue('--transition-length')).toBe(
      ANIMATED_CIRCULAR_PROGRESS_DURATION,
    )
    expect(host.querySelector('[data-current-value="42"]')?.textContent).toBe('42')
    expect(primary.style.strokeDasharray).toContain('var(--percent-to-px)')
    expect(primary.style.transition).toContain('stroke-dasharray')
    expect(primary.style.transition).toContain('var(--transition-length)')
  })

  it('coupe la transition en reduced motion', async () => {
    await act(async () => {
      root.render(
        <AnimatedCircularProgressBar
          value={70}
          reducedMotion
          gaugePrimaryColor="#FF2B2B"
          gaugeSecondaryColor="#2A2A2E"
        />,
      )
    })
    const rootEl = host.querySelector('[data-animated-circular-progress]') as HTMLElement
    expect(rootEl.getAttribute('data-motion')).toBe('static')
    expect(rootEl.style.getPropertyValue('--transition-length')).toBe('0s')
  })

  it('exporte la transition 1s ease de Magic UI', () => {
    expect(circularProgressTransition(false)).toBe('none')
    expect(circularProgressTransition(true)).toContain('stroke-dasharray 1s ease')
    expect(circularProgressTransition(true)).toContain('transform 1s ease')
  })

  it('démo Magic UI monte le jauge', async () => {
    await act(async () => {
      root.render(<AnimatedCircularProgressBarDemo />)
    })
    expect(host.querySelector('[data-animated-circular-progress]')).toBeTruthy()
    expect(host.querySelector('[data-current-value]')?.textContent).toBe('13')
  })
})
