/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act, type ComponentProps } from 'react'
import { NutritionCalorieRing } from './NutritionCalorieRing'
import { M_INFO_1 } from '../../content/safetyCopy'

async function renderRing(props: Partial<ComponentProps<typeof NutritionCalorieRing>>) {
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
        {...props}
      />,
    )
  })
  return { host, root }
}

describe('QA BUG-07 — TCA : pas de CTA objectif calorique', () => {
  it('allowGoalSetup=false n’affiche pas Définir mon objectif ni M_INFO_1 (porté par SafetyNote)', async () => {
    const { host, root } = await renderRing({ allowGoalSetup: false })
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeNull()
    expect(host.textContent).not.toContain('Définir mon objectif')
    expect(host.textContent).not.toContain('Fixer un objectif')
    expect(host.textContent).toContain('Suivi sans objectif chiffré')
    expect(host.textContent).not.toContain(M_INFO_1)
    root.unmount()
    host.remove()
  })

  it('drapeau éteint (flag_off) → pas de bouton Fixer un objectif', async () => {
    const { host, root } = await renderRing({
      allowGoalSetup: false,
      lockReason: 'flag_off',
    })
    const ring = host.querySelector('[data-testid="nutrition-calorie-ring"]')
    expect(ring?.getAttribute('data-calorie-lock')).toBe('flag_off')
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeNull()
    expect(host.textContent).not.toContain('Fixer un objectif')
    expect(host.textContent).toContain('Suivi sans objectif chiffré')
    root.unmount()
    host.remove()
  })

  it('TCA (lockReason=tca) → pas de bouton Fixer un objectif', async () => {
    const { host, root } = await renderRing({
      allowGoalSetup: false,
      lockReason: 'tca',
    })
    const ring = host.querySelector('[data-testid="nutrition-calorie-ring"]')
    expect(ring?.getAttribute('data-calorie-lock')).toBe('tca')
    expect(host.querySelector('[data-testid="define-calorie-goal"]')).toBeNull()
    expect(host.textContent).not.toContain('Fixer un objectif')
    expect(host.textContent).toMatch(/Situations de santé/)
    root.unmount()
    host.remove()
  })

  it('allowGoalSetup=true propose le CTA Fixer un objectif (adulte éligible, drapeau ON)', async () => {
    const { host, root } = await renderRing({ allowGoalSetup: true, lockReason: 'none' })
    const btn = host.querySelector('[data-testid="define-calorie-goal"]')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toMatch(/Fixer un objectif/)
    root.unmount()
    host.remove()
  })
})
