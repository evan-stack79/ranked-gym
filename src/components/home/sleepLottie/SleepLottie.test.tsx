/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const destroy = vi.fn()
const play = vi.fn()
const pause = vi.fn()
const seek = vi.fn()

vi.mock('lottie-web/build/player/lottie_light', () => ({ default: {} }))

vi.mock('lottie-react', () => ({
  LottieLight: function MockLottieLight(props: {
    lottieRef?: { current: unknown }
    loop?: boolean | number
    autoplay?: boolean
  }) {
    if (props.lottieRef) {
      props.lottieRef.current = {
        play,
        pause,
        stop: vi.fn(),
        seek,
        playableFrames: 40,
        animationItem: { destroy },
      }
    }
    return (
      <div
        data-mock-lottie
        data-loop={props.loop ? '1' : '0'}
        data-autoplay={props.autoplay ? '1' : '0'}
      />
    )
  },
}))

vi.mock('../../../assets/lottie/sleep/sleepy-moon.json', () => ({
  default: { v: '5.5.2', fr: 30, ip: 0, op: 40, layers: [] },
}))

describe('SleepLottie', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    destroy.mockClear()
    play.mockClear()
    pause.mockClear()
    seek.mockClear()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('destroy on unmount', async () => {
    const { SleepLottie } = await import('./SleepLottie')
    await act(async () => {
      root.render(<SleepLottie name="sleepy-moon" playing loop={false} />)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(host.querySelector('[data-sleep-lottie="sleepy-moon"]')).toBeTruthy()
    await act(async () => {
      root.unmount()
    })
    expect(destroy).toHaveBeenCalled()
  })

  it('reduced motion → static (no loop / seek+pause)', async () => {
    const { SleepLottie } = await import('./SleepLottie')
    await act(async () => {
      root.render(<SleepLottie name="sleepy-moon" playing loop />)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(host.querySelector('[data-sleep-lottie-state="static"]')).toBeTruthy()
    const mock = host.querySelector('[data-mock-lottie]') as HTMLElement
    expect(mock?.getAttribute('data-loop')).toBe('0')
    expect(seek).toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
  })
})
