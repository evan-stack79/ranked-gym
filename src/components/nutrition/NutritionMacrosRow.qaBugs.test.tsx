/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionMacrosRow } from './NutritionMacrosRow'

describe('QA BUG-21 — macros sans cible (drapeau OFF)', () => {
  it('affiche le consommé sans « 0 / 0 g » quand target = 0', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <NutritionMacrosRow
          protein={{ label: 'Protéines', consumedG: 42, targetG: 0 }}
          carbs={{ label: 'Glucides', consumedG: 10, targetG: 0 }}
          fat={{ label: 'Lipides', consumedG: 5, targetG: 0 }}
        />,
      )
    })
    expect(host.textContent).toContain('42 g')
    expect(host.textContent).not.toContain('0 / 0 g')
    expect(host.textContent).not.toMatch(/42 \/ 0 g/)
    root.unmount()
    host.remove()
  })

  it('cas limite : avec cible, conserve le format consommé / cible', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <NutritionMacrosRow
          protein={{ label: 'Protéines', consumedG: 40, targetG: 120 }}
          carbs={{ label: 'Glucides', consumedG: 0, targetG: 200 }}
          fat={{ label: 'Lipides', consumedG: 0, targetG: 60 }}
        />,
      )
    })
    expect(host.textContent).toContain('40 / 120 g')
    root.unmount()
    host.remove()
  })
})
