/**
 * Train : champ vidé RESTE VIDE (blur / re-render) jusqu’à Valider/Terminer.
 * Repro IPA #131 — avant fix, required+blur restaurait 20.
 */
/** @vitest-environment jsdom */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ClearableNumberInput,
  flushPendingClearableNumberInputs,
} from './ClearableNumberInput'

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('ClearableNumberInput — keep empty (Train fieldKind)', () => {
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

  it('kg 20 → vider → blur → reste vide ; parent reçoit null (pas restore 20)', async () => {
    const seen: Array<number | null> = []
    function Harness() {
      const [value, setValue] = useState<number | null>(20)
      return (
        <ClearableNumberInput
          value={value}
          onChange={(v) => {
            seen.push(v)
            setValue(v)
          }}
          min={0}
          max={500}
          step={0.5}
          required
          clampOnBlur={false}
          fieldKind="weight"
          commitOnBlur
          aria-label="Poids"
        />
      )
    }
    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Poids"]') as HTMLInputElement
    await act(async () => {
      input().focus()
      typeInto(input(), '')
    })
    expect(input().value).toBe('')
    await act(async () => {
      input().blur()
    })
    expect(input().value).toBe('')
    expect(seen.at(-1)).toBeNull()
  })

  it('reps : vider → blur → reste vide', async () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(8)
      return (
        <ClearableNumberInput
          value={value}
          onChange={setValue}
          min={1}
          max={50}
          required
          clampOnBlur={false}
          fieldKind="reps"
          commitOnBlur
          aria-label="Reps"
        />
      )
    }
    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Reps"]') as HTMLInputElement
    await act(async () => {
      input().focus()
      typeInto(input(), '')
      input().blur()
    })
    expect(input().value).toBe('')
  })

  it('vider → re-render parent null → champ toujours vide', async () => {
    function Harness({ value }: { value: number | null }) {
      return (
        <ClearableNumberInput
          value={value}
          onChange={() => {}}
          min={0}
          max={500}
          required
          clampOnBlur={false}
          fieldKind="weight"
          commitOnBlur
          aria-label="Poids-rr"
        />
      )
    }
    await act(async () => {
      root.render(<Harness value={20} />)
    })
    const input = () => host.querySelector('input[aria-label="Poids-rr"]') as HTMLInputElement
    await act(async () => {
      input().focus()
      typeInto(input(), '')
      input().blur()
    })
    await act(async () => {
      root.render(<Harness value={null} />)
    })
    expect(input().value).toBe('')
  })

  it('nutrition required sans fieldKind : blur vide restaure encore (non-régression)', async () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(200)
      return (
        <ClearableNumberInput
          value={value}
          onChange={setValue}
          min={0}
          max={5000}
          required
          clampOnBlur
          commitOnBlur
          aria-label="Kcal"
        />
      )
    }
    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Kcal"]') as HTMLInputElement
    await act(async () => {
      input().focus()
      typeInto(input(), '')
      input().blur()
    })
    expect(input().value).toBe('200')
  })

  it('flush Valider avec vide fieldKind → parent null (refus côté écran)', async () => {
    let last: number | null = 20
    function Harness() {
      const [value, setValue] = useState<number | null>(20)
      return (
        <ClearableNumberInput
          value={value}
          onChange={(v) => {
            last = v
            setValue(v)
          }}
          min={0}
          max={500}
          required
          clampOnBlur={false}
          fieldKind="weight"
          commitOnBlur
          aria-label="Poids-flush"
        />
      )
    }
    await act(async () => {
      root.render(<Harness />)
    })
    const input = () => host.querySelector('input[aria-label="Poids-flush"]') as HTMLInputElement
    await act(async () => {
      input().focus()
      typeInto(input(), '')
    })
    await act(async () => {
      flushPendingClearableNumberInputs()
    })
    expect(input().value).toBe('')
    expect(last).toBeNull()
  })
})
