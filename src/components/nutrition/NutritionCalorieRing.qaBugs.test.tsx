/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionCalorieRing } from './NutritionCalorieRing'
import { M_INFO_1 } from '../../content/safetyCopy'

describe('QA BUG-07 — TCA : pas de CTA objectif calorique', () => {
  it('allowGoalSetup=false n’affiche pas Définir mon objectif ni M_INFO_1 (porté par SafetyNote)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <NutritionCalorieRing
          remainingCalories={0}
          consumedCalories={400}
          targetCalories={0}
          progress={0}
          onOpenSetup={() => undefined}
          allowGoalSetup={false}
        />,
      )
    })
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeNull()
    expect(host.textContent).not.toContain('Définir mon objectif')
    expect(host.textContent).toContain('Suivi sans objectif chiffré')
    expect(host.textContent).not.toContain(M_INFO_1)
    root.unmount()
    host.remove()
  })

  it('allowGoalSetup=true propose le CTA (adulte éligible, drapeau ON)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <NutritionCalorieRing
          remainingCalories={0}
          consumedCalories={0}
          targetCalories={0}
          progress={0}
          onOpenSetup={() => undefined}
          allowGoalSetup
        />,
      )
    })
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeTruthy()
    root.unmount()
    host.remove()
  })
})
