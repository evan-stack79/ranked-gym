/** @vitest-environment jsdom */
/**
 * QA boucle 2 — clamp min/max à la propagation ; blur vide restaure le max borné.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ClearableNumberInput } from './ClearableNumberInput'

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('ClearableNumberInput — clamp QA boucle 2', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('commitOnInput : 600 kg (max 500) → propage 500 ; vide ne propage pas 0', async () => {
    const seen: Array<number | null> = []
    function Harness() {
      const [v, setV] = useState<number | null>(80)
      return (
        <ClearableNumberInput
          value={v}
          onChange={(n) => {
            seen.push(n)
            if (n == null) return
            setV(n)
          }}
          min={0}
          max={500}
          required
          commitOnInput
          aria-label="poids"
        />
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })
    const input = host.querySelector('input[aria-label="poids"]') as HTMLInputElement

    await act(async () => {
      input.focus()
      typeInto(input, '600')
    })
    expect(seen.at(-1)).toBe(500)

    const before = seen.length
    await act(async () => {
      typeInto(input, '')
    })
    expect(input.value).toBe('')
    expect(seen.length).toBe(before)
    // Aucun 0 silencieux ajouté par le clear.
    expect(seen.filter((n) => n === 0)).toHaveLength(0)
  })

  it('calories : taper 6000 (max 5000), effacer, blur → affiche 5000', async () => {
    function Harness() {
      const [v, setV] = useState<number | null>(200)
      return (
        <ClearableNumberInput
          value={v}
          onChange={setV}
          min={0}
          max={5000}
          required
          aria-label="Calories"
        />
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Calories"]') as HTMLInputElement

    await act(async () => {
      input().focus()
      typeInto(input(), '6000')
    })
    // Propagation clampée (comme attendu vs max).
    expect(input().value).toBe('6000')

    await act(async () => {
      typeInto(input(), '')
      input().blur()
    })
    expect(input().value).toBe('5000')
  })

  it('âge trop grand : taper au-delà du max, effacer, blur → max', async () => {
    function Harness() {
      const [v, setV] = useState<number | null>(30)
      return (
        <ClearableNumberInput
          value={v}
          onChange={setV}
          min={13}
          max={100}
          required
          aria-label="Âge"
        />
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Âge"]') as HTMLInputElement

    await act(async () => {
      input().focus()
      typeInto(input(), '150')
    })
    await act(async () => {
      typeInto(input(), '')
      input().blur()
    })
    expect(input().value).toBe('100')
  })
})
