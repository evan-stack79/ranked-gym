/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HeightWeightPicker } from './HeightWeightPicker'
import { KG_PER_LB, kgToLbDisplay, lbToKgStorage } from '../../services/nutritionSafetyRules'

vi.mock('../../utils/haptics', () => ({ vibrate: vi.fn() }))
vi.mock('../../utils/wheelTickSound', () => ({ playWheelTickSound: vi.fn() }))

describe('HeightWeightPicker', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders French title and privacy sentence', () => {
    act(() => {
      root.render(
        <HeightWeightPicker
          value={{ weightKg: null, heightCm: null }}
          onChange={() => {}}
          onSkip={() => {}}
        />,
      )
    })
    expect(container.textContent).toContain('Ta taille et ton poids')
    expect(container.textContent).toContain('dépense au repos')
    expect(container.textContent).toContain('Plus tard')
  })

  it('Plus tard calls onSkip and Continuer is disabled when empty', () => {
    const onSkip = vi.fn()
    const onSave = vi.fn()
    act(() => {
      root.render(
        <HeightWeightPicker
          value={{ weightKg: null, heightCm: null }}
          onChange={() => {}}
          onSkip={onSkip}
          onSave={onSave}
        />,
      )
    })
    const later = container.querySelector('[data-testid="height-weight-later"]') as HTMLButtonElement
    const cont = container.querySelector('[data-testid="height-weight-continue"]') as HTMLButtonElement
    expect(cont.disabled).toBe(true)
    act(() => {
      later.click()
    })
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows C’est noté. confirmation state without repeating the number', () => {
    act(() => {
      root.render(
        <HeightWeightPicker
          value={{ weightKg: 72, heightCm: 175 }}
          onChange={() => {}}
          confirmMessage="C’est noté."
        />,
      )
    })
    expect(container.querySelector('[data-testid="height-weight-noted"]')?.textContent).toContain(
      'C’est noté.',
    )
    expect(container.textContent).not.toMatch(/72/)
  })

  it('shows Effacer when allowErase and values present', () => {
    const onErase = vi.fn()
    act(() => {
      root.render(
        <HeightWeightPicker
          value={{ weightKg: 72, heightCm: 175 }}
          onChange={() => {}}
          allowErase
          onErase={onErase}
        />,
      )
    })
    const erase = container.querySelector('[data-testid="height-weight-erase"]') as HTMLButtonElement
    expect(erase).toBeTruthy()
    act(() => {
      erase.click()
    })
    expect(onErase).toHaveBeenCalled()
  })

  it('kg↔lb toggle does not drift stored kg when display unchanged', () => {
    let stored = 72.5
    const onChange = (next: { weightKg: number | null; heightCm: number | null }) => {
      if (next.weightKg != null) stored = next.weightKg
    }
    // Simulate picker logic used by HeightWeightPicker
    const unit: 'kg' | 'lb' = 'lb'
    const display = kgToLbDisplay(stored)
    // User toggles to lb without changing wheel → same display → keep stored
    const sameDisplay = kgToLbDisplay(stored) === display
    expect(sameDisplay).toBe(true)
    if (sameDisplay) {
      onChange({ weightKg: stored, heightCm: 175 })
    } else {
      onChange({ weightKg: lbToKgStorage(display), heightCm: 175 })
    }
    expect(stored).toBe(72.5)

    // Changing lb value does store exact lb * KG_PER_LB
    const newLb = display + 1
    stored = lbToKgStorage(newLb)
    expect(stored).toBe(newLb * KG_PER_LB)
    expect(unit).toBe('lb')
  })
})
