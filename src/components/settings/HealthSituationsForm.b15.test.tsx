/**
 * @vitest-environment jsdom
 * B15 — verrous TCA / Aucune + clear Oui/Annuler + copy.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUCUNE_LOCKED_HINT,
  BREASTFEEDING_CLEAR_CONFIRM,
  DIABETES_CLEAR_CONFIRM,
  PREGNANCY_CLEAR_CONFIRM,
  SAFETY_CLEAR_CONFIRM_CANCEL,
  SAFETY_CLEAR_CONFIRM_YES,
  SAFETY_CLEAR_SIGN_IN,
  TCA_LOCKED_MESSAGE,
} from '../../content/safetyCopy'
import { SUPPORT_EMAIL, WRITE_TO_US_LABEL } from '../../config/contact'
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

  it('TCA true serveur : case cochée, disabled, message + Nous écrire + adresse texte', () => {
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
    expect(container.querySelector('[data-testid="health-tca-contact-message"]')?.textContent).toBe(
      TCA_LOCKED_MESSAGE,
    )
    expect(container.querySelector('[data-testid="health-tca-contact-write-btn"]')?.textContent).toBe(
      WRITE_TO_US_LABEL,
    )
    expect(container.querySelector('[data-testid="health-tca-contact-address"]')?.textContent).toBe(
      SUPPORT_EMAIL,
    )
  })

  it('Aucune disabled + hint verbatim si situation true serveur', () => {
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
    expect(container.querySelector('[data-testid="health-none-lock-hint"]')?.textContent).toBe(
      AUCUNE_LOCKED_HINT,
    )
    act(() => {
      ;(none?.querySelector('input') as HTMLInputElement).click()
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('décocher grossesse + Oui → clearSafetyFlag', async () => {
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
      ;(container.querySelector('[data-testid="health-clear-confirm-yes"]') as HTMLButtonElement).click()
    })
    expect(onClear).toHaveBeenCalledWith('declaredPregnancy')
    expect(onChange).toHaveBeenCalled()
  })

  it('décocher allaitement : confirm verbatim', async () => {
    renderForm({
      value: baseValue({ declaredBreastfeeding: true, healthAnswer: 'situations' }),
      locks: { declaredBreastfeeding: true },
      isAuthenticated: true,
      onClear: async () => true,
    })
    await act(async () => {
      ;(
        container.querySelector('[data-testid="health-breastfeeding"] input') as HTMLInputElement
      ).click()
    })
    expect(container.querySelector('[data-testid="health-clear-confirm-text"]')?.textContent).toBe(
      BREASTFEEDING_CLEAR_CONFIRM,
    )
  })

  it('décocher diabète : confirm verbatim', async () => {
    renderForm({
      value: baseValue({ declaredDiabetes: true }),
      locks: { declaredDiabetes: true },
      isAuthenticated: true,
      onClear: async () => true,
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="health-diabetes"] input') as HTMLInputElement).click()
    })
    expect(container.querySelector('[data-testid="health-clear-confirm-text"]')?.textContent).toBe(
      DIABETES_CLEAR_CONFIRM,
    )
  })

  it('décocher diabète puis Annuler : serveur reste true, case reste cochée', async () => {
    const onClear = vi.fn(async () => true)
    const onChange = vi.fn()
    renderForm({
      value: baseValue({ declaredDiabetes: true }),
      locks: { declaredDiabetes: true },
      isAuthenticated: true,
      onClear,
      onChange,
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="health-diabetes"] input') as HTMLInputElement).click()
    })
    await act(async () => {
      ;(
        container.querySelector('[data-testid="health-clear-confirm-cancel"]') as HTMLButtonElement
      ).click()
    })
    expect(onClear).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(
      (container.querySelector('[data-testid="health-diabetes"] input') as HTMLInputElement).checked,
    ).toBe(true)
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
