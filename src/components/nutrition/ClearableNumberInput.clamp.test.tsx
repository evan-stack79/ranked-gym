/** @vitest-environment jsdom */
/**
 * Clamp / restore — nutrition garde le clamp ; Train (clampOnBlur false) non.
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

describe('ClearableNumberInput — clamp / restore', () => {
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

  it('commitOnInput + clampOnBlur : 600 kg (max 500) → propage 500 ; vide ne propage pas 0', async () => {
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
    expect(seen.filter((n) => n === 0)).toHaveLength(0)
  })

  it('commitOnInput + clampOnBlur false : 600 → 600 (pas de clamp silencieux)', async () => {
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
          clampOnBlur={false}
          aria-label="poids-train"
        />
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })
    const input = host.querySelector('input[aria-label="poids-train"]') as HTMLInputElement

    await act(async () => {
      input.focus()
      typeInto(input, '600')
    })
    expect(seen.at(-1)).toBe(600)
    expect(input.value).toBe('600')
  })

  it('calories : taper 6000 (max 5000), effacer, blur → restaure la valeur d’avant focus', async () => {
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
    expect(input().value).toBe('6000')

    await act(async () => {
      typeInto(input(), '')
      input().blur()
    })
    // Blur vide → valeur au focus (200), pas un max inventé.
    expect(input().value).toBe('200')
  })

  it('commitOnInput carnet : 20 → backspace×2 → vide ; taper 5 → 5', async () => {
    const seen: Array<number | null> = []
    function Harness() {
      const [v, setV] = useState<number | null>(20)
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
          step={0.5}
          required
          commitOnInput
          clampOnBlur={false}
          aria-label="Poids"
        />
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    expect(input().value).toBe('20')

    await act(async () => {
      input().focus()
      typeInto(input(), '2')
    })
    expect(input().value).toBe('2')
    expect(seen.at(-1)).toBe(2)

    const beforeClear = seen.length
    await act(async () => {
      typeInto(input(), '')
    })
    expect(input().value).toBe('')
    expect(seen.length).toBe(beforeClear)
    expect(seen.filter((n) => n === 0)).toHaveLength(0)

    await act(async () => {
      typeInto(input(), '5')
      input().blur()
    })
    expect(input().value).toBe('5')
    expect(seen.at(-1)).toBe(5)
  })

  it('kg 20 → tout effacer → blur → 20 (pas 2)', async () => {
    function Harness() {
      const [v, setV] = useState<number | null>(20)
      return (
        <ClearableNumberInput
          value={v}
          onChange={(n) => {
            if (n == null) return
            setV(n)
          }}
          min={0}
          max={500}
          required
          commitOnInput
          clampOnBlur={false}
          aria-label="Poids-restore"
        />
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Poids-restore"]') as HTMLInputElement

    await act(async () => {
      input().focus()
      typeInto(input(), '2')
      typeInto(input(), '')
      input().blur()
    })
    expect(input().value).toBe('20')
  })

  it('âge trop grand : taper au-delà du max, effacer, blur → valeur d’avant focus', async () => {
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
    expect(input().value).toBe('30')
  })
})
