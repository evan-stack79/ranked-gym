// @vitest-environment jsdom
import { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdaptiveBottomNav } from './useAdaptiveBottomNav'

function Harness({ resetKey }: { resetKey: string }) {
  const mainRef = useRef<HTMLElement>(null)
  const { mode, keyboardOpen } = useAdaptiveBottomNav({
    mainRef,
    resetKey,
  })

  return (
    <main ref={mainRef} data-mode={mode} data-keyboard-state={keyboardOpen ? 'open' : 'closed'}>
      <input aria-label="Champ éditable" />
      <div style={{ height: '2000px' }} />
    </main>
  )
}

describe('useAdaptiveBottomNav', () => {
  let container: HTMLDivElement
  let root: Root
  let viewport: { height: number; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> }
  let rafQueue: FrameRequestCallback[]
  const raf = (callback: FrameRequestCallback) => {
    rafQueue.push(callback)
    return rafQueue.length
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    rafQueue = []
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: raf })
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: vi.fn() })
    viewport = {
      height: 900,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  function main(): HTMLElement {
    return container.querySelector('main') as HTMLElement
  }

  function render(resetKey = 'home') {
    act(() => root.render(<Harness resetKey={resetKey} />))
  }

  function flushRaf() {
    const pending = rafQueue.splice(0)
    pending.forEach((callback) => callback(0))
  }

  function scrollTo(value: number) {
    act(() => {
      Object.defineProperty(main(), 'scrollTop', { configurable: true, value })
      main().dispatchEvent(new Event('scroll'))
      flushRaf()
    })
  }

  it('reste déployée au chargement et sous le seuil descendant', () => {
    render()
    scrollTo(51)
    expect(main().dataset.mode).toBe('expanded')
    expect(main().dataset.keyboardState).toBe('closed')
  })

  it('se compacte après 52 px descendants cumulés', () => {
    render()
    scrollTo(30)
    scrollTo(52)
    expect(main().dataset.mode).toBe('compact')
  })

  it('se redéploie après 22 px montants et près du haut', () => {
    render()
    scrollTo(60)
    scrollTo(112)
    expect(main().dataset.mode).toBe('compact')
    scrollTo(90)
    scrollTo(68)
    expect(main().dataset.mode).toBe('expanded')
    scrollTo(0)
    expect(main().dataset.mode).toBe('expanded')
  })

  it('réinitialise l’accumulation quand la direction change', () => {
    render()
    scrollTo(40)
    scrollTo(20)
    scrollTo(60)
    expect(main().dataset.mode).toBe('expanded')
    scrollTo(92)
    expect(main().dataset.mode).toBe('compact')
  })

  it('réinitialise le mode après changement d’onglet', () => {
    render('home')
    scrollTo(60)
    expect(main().dataset.mode).toBe('compact')
    render('nutrition')
    expect(main().dataset.mode).toBe('expanded')
  })

  it('ne masque le clavier qu’avec un champ éditable et une baisse significative', () => {
    render()
    act(() => {
      viewport.height = 760
      viewport.addEventListener.mock.calls.forEach(([type, listener]) => {
        if (type === 'resize') listener()
      })
      flushRaf()
    })
    expect(main().dataset.keyboardState).toBe('closed')

    const input = container.querySelector('input') as HTMLInputElement
    act(() => {
      input.focus()
      viewport.height = 620
      viewport.addEventListener.mock.calls.forEach(([type, listener]) => {
        if (type === 'resize') listener()
      })
      flushRaf()
    })
    expect(main().dataset.keyboardState).toBe('open')

    act(() => {
      input.blur()
      flushRaf()
    })
    expect(main().dataset.keyboardState).toBe('closed')
  })
})
