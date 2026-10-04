/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { HealthSituationsForm } from './HealthSituationsForm'
import { M_INFO_1 } from '../../content/safetyCopy'
import {
  clearTcaReactivationInfoPending,
  peekTcaReactivationInfoPending,
} from '../../services/nutritionStorage'

describe('QA BUG-22 — rappel M_INFO_1 une fois à la réactivation TCA', () => {
  beforeEach(() => {
    clearTcaReactivationInfoPending()
    localStorage.clear()
  })

  afterEach(() => {
    clearTcaReactivationInfoPending()
  })

  async function renderForm(
    initial: {
      declaredPregnancy: boolean
      declaredBreastfeeding: boolean
      declaredEatingDisorder: boolean
      preferNotAnswerHealth: boolean
    },
  ) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let value = { ...initial }
    const onChange = vi.fn((next: typeof value) => {
      value = next
      root.render(
        <HealthSituationsForm
          value={value}
          onChange={onChange}
        />,
      )
    })
    await act(async () => {
      root.render(<HealthSituationsForm value={value} onChange={onChange} />)
    })
    return {
      host,
      onChange,
      getValue: () => value,
      rerender: async () => {
        await act(async () => {
          root.render(<HealthSituationsForm value={value} onChange={onChange} />)
        })
      },
      cleanup: () => {
        root.unmount()
        host.remove()
      },
    }
  }

  function tcaCheckbox(host: HTMLElement) {
    const row = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Trouble du comportement alimentaire'),
    )
    return row?.querySelector('input[type="checkbox"]') as HTMLInputElement
  }

  it('décocher TCA affiche M_INFO_1 une fois et mémorise (plus de pending)', async () => {
    const { host, cleanup, rerender, getValue } = await renderForm({
      declaredPregnancy: false,
      declaredBreastfeeding: false,
      declaredEatingDisorder: true,
      preferNotAnswerHealth: false,
    })

    expect(host.textContent).not.toContain(M_INFO_1)

    await act(async () => {
      tcaCheckbox(host).click()
    })
    await rerender()

    expect(getValue().declaredEatingDisorder).toBe(false)
    expect(host.textContent).toContain(M_INFO_1)
    expect(host.querySelectorAll('[data-testid="m-info-1-notice"]').length).toBe(1)
    expect(peekTcaReactivationInfoPending()).toBe(false)

    // Remount : ne doit pas réafficher via pending (déjà consommé).
    cleanup()
    const second = await renderForm({
      declaredPregnancy: false,
      declaredBreastfeeding: false,
      declaredEatingDisorder: false,
      preferNotAnswerHealth: false,
    })
    expect(second.host.querySelector('[data-testid="m-info-1-notice"]')).toBeNull()
    second.cleanup()
  })

  it('BUG-23 : « Je préfère ne pas répondre » n’affiche M_INFO_1 qu’une fois', async () => {
    const { host, cleanup, rerender } = await renderForm({
      declaredPregnancy: false,
      declaredBreastfeeding: false,
      declaredEatingDisorder: false,
      preferNotAnswerHealth: false,
    })

    const prefer = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Je préfère ne pas répondre'),
    )
    await act(async () => {
      ;(prefer?.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
    })
    await rerender()

    const matches = host.textContent?.split(M_INFO_1).length ?? 0
    expect(matches - 1).toBe(1)
    cleanup()
  })
})
