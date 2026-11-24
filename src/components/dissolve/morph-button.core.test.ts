/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMorphButton } from './morph-button.core'

function flushFrames(n = 3) {
  return new Promise<void>((resolve) => {
    let left = n
    const step = () => {
      left -= 1
      if (left <= 0) resolve()
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

describe('createMorphButton — états', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    host.style.width = '280px'
    document.body.appendChild(host)
    Object.defineProperty(host, 'clientWidth', { configurable: true, get: () => 280 })
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
  })

  afterEach(() => {
    host.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('état normal : label idle visible, phase idle', () => {
    const btn = createMorphButton(host, {
      label: 'Payer 9,99 €',
      doneLabel: 'Payé',
      onPress: async () => undefined,
    })
    expect(btn.getPhase()).toBe('idle')
    expect(host.dataset.phase).toBe('idle')
    expect(host.textContent).toContain('Payer 9,99 €')
    expect(host.getAttribute('aria-busy')).toBeNull()
    btn.destroy()
  })

  it('chargement : phase loading + aria-busy après press', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => {
      release = res
    })
    const btn = createMorphButton(host, {
      label: 'Payer 9,99 €',
      doneLabel: 'Payé',
      onPress: () => gate,
      resetAfter: 0,
    })
    host.click()
    await flushFrames(2)
    expect(btn.getPhase()).toBe('loading')
    expect(host.dataset.phase).toBe('loading')
    expect(host.getAttribute('aria-busy')).toBe('true')
    release()
    await flushFrames(4)
    expect(btn.getPhase()).toBe('done')
    btn.destroy()
  })

  it('payé : phase done + libellé Payé + fond vert succès', async () => {
    // Snap immédiat pour lire le fond succès sans attendre le fade tone.
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: String(query).includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
    host.style.setProperty('--dissolve-primary', '#ff0702')
    host.style.setProperty('--dissolve-success', '#16a34a')
    host.style.setProperty('--dissolve-primary-foreground', '#ffffff')
    const btn = createMorphButton(host, {
      label: 'Payer 89,99 €',
      doneLabel: 'Payé',
      onPress: async () => undefined,
      resetAfter: 0,
    })
    host.click()
    await flushFrames(4)
    expect(btn.getPhase()).toBe('done')
    expect(host.dataset.phase).toBe('done')
    expect(host.textContent).toContain('Payé')
    const pill = host.querySelector('.dissolve-morph-pill') as HTMLElement
    const bg = pill.style.background.replace(/\s/g, '').toLowerCase()
    expect(bg).toMatch(/#16a34a|rgb\(22,?163,?74\)|var\(--dissolve-success/)
    btn.destroy()
  })

  it('échec : rejet → retour idle', async () => {
    const btn = createMorphButton(host, {
      label: 'Payer 9,99 €',
      doneLabel: 'Payé',
      onPress: async () => {
        throw new Error('USER_CANCELLED')
      },
      resetAfter: 0,
    })
    host.click()
    await flushFrames(8)
    expect(btn.getPhase()).toBe('idle')
    expect(host.dataset.phase).toBe('idle')
    expect(host.getAttribute('aria-busy')).toBe('false')
    expect(host.textContent).toContain('Payer 9,99 €')
    btn.destroy()
  })

  it('retour au normal après done via resetAfter', async () => {
    const btn = createMorphButton(host, {
      label: 'Payer 9,99 €',
      doneLabel: 'Payé',
      onPress: async () => undefined,
      resetAfter: 120,
    })
    host.click()
    const started = Date.now()
    while (btn.getPhase() !== 'done' && Date.now() - started < 2000) {
      await flushFrames(2)
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(btn.getPhase()).toBe('done')
    while (btn.getPhase() !== 'idle' && Date.now() - started < 3000) {
      await flushFrames(2)
      await new Promise((r) => setTimeout(r, 20))
    }
    expect(btn.getPhase()).toBe('idle')
    expect(host.dataset.phase).toBe('idle')
    expect(host.textContent).toContain('Payer 9,99 €')
    btn.destroy()
  })

  it('disabled : ignore le press, reste idle', async () => {
    const onPress = vi.fn(async () => undefined)
    const btn = createMorphButton(host, {
      label: 'Payer 9,99 €',
      doneLabel: 'Payé',
      onPress,
      disabled: true,
    })
    host.click()
    await flushFrames(4)
    expect(onPress).not.toHaveBeenCalled()
    expect(btn.getPhase()).toBe('idle')
    expect(host.getAttribute('aria-disabled')).toBe('true')
    btn.destroy()
  })
})
