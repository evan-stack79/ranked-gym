/**
 * @vitest-environment jsdom
 * B15 — verrous TCA / Aucune + clear grossesse + copy connecte-toi.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BREASTFEEDING_CLEAR_CONFIRM,
  DIABETES_CLEAR_CONFIRM,
  PREGNANCY_CLEAR_CONFIRM,
  SAFETY_CLEAR_SIGN_IN,
  TCA_LOCKED_MESSAGE,
} from '../../content/safetyCopy'
import {
  HealthSituationsForm,
  type HealthSituationsValue,
  type ServerHealthLocks,
} from './HealthSituationsForm'

describe('B15 — HealthSituationsForm verrous / clear', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
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
    onMessage?: (m: string) => void
  }) {
    const value = opts.value ?? baseValue()
    act(() => {
      root.render(
        <HealthSituationsForm
          value={value}
          onChange={opts.onChange ?? (() => {})}
          sex="female"
          serverLocks={opts.locks}
          isAuthenticated={opts.isAuthenticated ?? false}
          onClearSafetyField={opts.onClear as never}
          onMessage={opts.onMessage}
        />,
      )
    })
  }

  it('TCA true serveur : case cochée, disabled, hint exact', () => {
    renderForm({
      value: baseValue({
        declaredEatingDisorder: true,
        healthAnswer: 'situations',
      }),
      locks: { declaredEatingDisorder: true },
      isAuthenticated: true,
    })
    const row = container.querySelector('[data-testid="health-tca"]')
    expect(row?.getAttribute('data-disabled')).toBe('true')
    const input = row?.querySelector('input') as HTMLInputElement
    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(true)
    expect(container.querySelector('[data-testid="health-tca-lock-hint"]')?.textContent).toBe(
      TCA_LOCKED_MESSAGE,
    )
  })

  it('Aucune disabled si au moins une situation true serveur ; rien n’est effacé', () => {
    const onChange = vi.fn()
    renderForm({
      value: baseValue({
        declaredDiabetes: true,
        healthAnswer: 'situations',
        declaredPregnancy: true,
      }),
      locks: { declaredDiabetes: true, declaredPregnancy: true },
      isAuthenticated: true,
      onChange,
    })
    const none = container.querySelector('[data-testid="health-none"]')
    expect(none?.getAttribute('data-disabled')).toBe('true')
    act(() => {
      ;(none?.querySelector('input') as HTMLInputElement).click()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('décocher grossesse connecté + confirm → clearSafetyFlag', async () => {
    const onClear = vi.fn(async () => true)
    const onChange = vi.fn()
    renderForm({
      value: baseValue({ declaredPregnancy: true, healthAnswer: 'situations' }),
      locks: { declaredPregnancy: true },
      isAuthenticated: true,
      onClear,
      onChange,
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="health-pregnancy"] input') as HTMLInputElement).click()
    })
    expect(window.confirm).toHaveBeenCalledWith(PREGNANCY_CLEAR_CONFIRM)
    expect(onClear).toHaveBeenCalledWith('declaredPregnancy')
    expect(onChange).toHaveBeenCalled()
  })

  it('décocher allaitement : confirm verbatim', async () => {
    const onClear = vi.fn(async () => true)
    renderForm({
      value: baseValue({ declaredBreastfeeding: true, healthAnswer: 'situations' }),
      locks: { declaredBreastfeeding: true },
      isAuthenticated: true,
      onClear,
    })
    await act(async () => {
      ;(
        container.querySelector('[data-testid="health-breastfeeding"] input') as HTMLInputElement
      ).click()
    })
    expect(window.confirm).toHaveBeenCalledWith(BREASTFEEDING_CLEAR_CONFIRM)
  })

  it('décocher diabète : confirm verbatim', async () => {
    const onClear = vi.fn(async () => true)
    renderForm({
      value: baseValue({ declaredDiabetes: true }),
      locks: { declaredDiabetes: true },
      isAuthenticated: true,
      onClear,
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="health-diabetes"] input') as HTMLInputElement).click()
    })
    expect(window.confirm).toHaveBeenCalledWith(DIABETES_CLEAR_CONFIRM)
  })

  it('déconnecté + grossesse serveur true : message Connecte-toi, case reste cochée', async () => {
    const onMessage = vi.fn()
    const onChange = vi.fn()
    renderForm({
      value: baseValue({ declaredPregnancy: true, healthAnswer: 'situations' }),
      locks: { declaredPregnancy: true },
      isAuthenticated: false,
      onMessage,
      onChange,
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="health-pregnancy"] input') as HTMLInputElement).click()
    })
    expect(onMessage).toHaveBeenCalledWith(SAFETY_CLEAR_SIGN_IN)
    expect(onChange).not.toHaveBeenCalled()
    expect(
      (container.querySelector('[data-testid="health-pregnancy"] input') as HTMLInputElement).checked,
    ).toBe(true)
  })
})
