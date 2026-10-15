/**
 * @vitest-environment jsdom
 * B16 — prefer_not verrouillé comme Aucune ; grossesse Annuler conserve.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUCUNE_LOCKED_HINT,
  PREGNANCY_CLEAR_CONFIRM,
  SAFETY_CLEAR_CONFIRM_CANCEL,
  SAFETY_CLEAR_CONFIRM_YES,
} from '../../content/safetyCopy'
import {
  HealthSituationsForm,
  type HealthSituationsValue,
  type ServerHealthLocks,
} from './HealthSituationsForm'

describe('B16 — HealthSituationsForm prefer_not + grossesse Annuler', () => {
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

  const baseValue = (over: Partial<HealthSituationsValue> = {}): HealthSituationsValue => ({
    declaredPregnancy: false,
    declaredBreastfeeding: false,
    declaredEatingDisorder: false,
    declaredDiabetes: false,
    preferNotAnswerHealth: false,
    healthAnswer: null,
    ...over,
  })

  function renderForm(opts: {
    value?: HealthSituationsValue
    locks?: ServerHealthLocks
    isAuthenticated?: boolean
    onChange?: (v: HealthSituationsValue) => void
    onClear?: (field: string) => boolean | Promise<boolean>
  }) {
    act(() => {
      root.render(
        <HealthSituationsForm
          value={opts.value ?? baseValue()}
          onChange={opts.onChange ?? (() => {})}
          sex="female"
          serverLocks={opts.locks}
          isAuthenticated={opts.isAuthenticated ?? true}
          onClearSafetyField={opts.onClear as never}
        />,
      )
    })
  }

  it('prefer_not disabled + AUCUNE_LOCKED_HINT verbatim si situation true serveur', () => {
    const onChange = vi.fn()
    renderForm({
      value: baseValue({
        declaredEatingDisorder: true,
        healthAnswer: 'situations',
      }),
      locks: { declaredEatingDisorder: true },
      onChange,
    })
    const prefer = container.querySelector('[data-testid="health-prefer-not"]')
    expect(prefer?.getAttribute('data-disabled')).toBe('true')
    expect(
      container.querySelector('[data-testid="health-prefer-not-lock-hint"]')?.textContent,
    ).toBe(AUCUNE_LOCKED_HINT)
    act(() => {
      ;(prefer?.querySelector('input') as HTMLInputElement).click()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('décocher grossesse : PREGNANCY_CLEAR_CONFIRM ; Annuler conserve', async () => {
    const onClear = vi.fn(async () => true)
    const onChange = vi.fn()
    renderForm({
      value: baseValue({ declaredPregnancy: true, healthAnswer: 'situations' }),
      locks: { declaredPregnancy: true },
      onClear,
      onChange,
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="health-pregnancy"] input') as HTMLInputElement).click()
    })
    expect(container.querySelector('[data-testid="health-clear-confirm-text"]')?.textContent).toBe(
      PREGNANCY_CLEAR_CONFIRM,
    )
    expect(container.querySelector('[data-testid="health-clear-confirm-yes"]')?.textContent).toBe(
      SAFETY_CLEAR_CONFIRM_YES,
    )
    expect(container.querySelector('[data-testid="health-clear-confirm-cancel"]')?.textContent).toBe(
      SAFETY_CLEAR_CONFIRM_CANCEL,
    )
    await act(async () => {
      ;(
        container.querySelector('[data-testid="health-clear-confirm-cancel"]') as HTMLButtonElement
      ).click()
    })
    expect(onClear).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(
      (container.querySelector('[data-testid="health-pregnancy"] input') as HTMLInputElement).checked,
    ).toBe(true)
  })
})
