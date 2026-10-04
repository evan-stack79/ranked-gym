/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { OpenFoodFactsProduct } from '../../services/alimentsService'
import { getNutritionTarget, hasMealTargets } from '../../services/nutritionActivity'
import type { CalorieProfile } from '../../types/nutrition'
import { MealBudgetsCard } from './MealBudgetsCard'
import { ScannedProductSheet } from './ScannedProductSheet'

const FORBIDDEN = /budget|zone|cible|restantes?|bonne zone/i

const PRODUCT: OpenFoodFactsProduct = {
  barcode: '3017620422003',
  nom: 'Ketchup',
  calories: 112,
  proteines: 1.2,
  glucides: 25.4,
  lipides: 0.1,
  provenance: 'open_food_facts',
  fetchedAt: Date.now(),
}

const ADULT: CalorieProfile = {
  weightKg: 75,
  goalWeightKg: 72,
  heightCm: 175,
  age: 28,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'maintain',
  weeklyPaceKg: 0,
  onboardingComplete: true,
}

async function renderSheet(opts: {
  hasMealTargets: boolean
  targetCalories: number
}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(
      <ScannedProductSheet
        open
        product={PRODUCT}
        targetCalories={opts.targetCalories}
        hasMealTargets={opts.hasMealTargets}
        morphology="mesomorph"
        meals={[]}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    )
  })
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })

  return {
    text: () => document.body.textContent ?? '',
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

async function renderBudgets(targetCalories: number) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(
      <MealBudgetsCard
        targetCalories={targetCalories}
        morphology="mesomorph"
        meals={[{ mealType: 'breakfast', calories: 250 }]}
      />,
    )
  })
  return {
    host,
    text: host.textContent ?? '',
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

describe('AR-01…AR-04 — pas de budget/zone/cible sans objectifs repas', () => {
  it('drapeau OFF : sheet sans mots budget/zone/cible/restantes/bonne zone', async () => {
    const nutrition = getNutritionTarget(ADULT, { calorieGoalEnabled: false })
    const active = hasMealTargets(nutrition)
    expect(active).toBe(false)
    const sheet = await renderSheet({
      hasMealTargets: active,
      targetCalories: nutrition.targetCalories,
    })
    const text = sheet.text()
    expect(text).toMatch(/ketchup/i)
    expect(text).not.toMatch(FORBIDDEN)
    expect(text).not.toContain('Tu manges comment')
    expect(text).toContain('Ajouter au journal')
    await sheet.cleanup()

    const budgets = await renderBudgets(nutrition.targetCalories)
    expect(budgets.host.childElementCount).toBe(0)
    expect(budgets.text).not.toMatch(FORBIDDEN)
    await budgets.cleanup()
  })

  it('ON sans cible : sheet + MealBudgetsCard silencieux', async () => {
    const active = hasMealTargets({ showCalorieGoal: true, targetCalories: 0 })
    expect(active).toBe(false)
    const sheet = await renderSheet({
      hasMealTargets: active,
      targetCalories: 0,
    })
    expect(sheet.text()).not.toMatch(FORBIDDEN)
    expect(sheet.text()).not.toContain('Tu manges comment')
    await sheet.cleanup()

    const budgets = await renderBudgets(0)
    expect(budgets.host.childElementCount).toBe(0)
    await budgets.cleanup()
  })

  it('ON avec cible : repère neutre, jamais zone/budget/Tu manges comment', async () => {
    const nutrition = getNutritionTarget(ADULT, { calorieGoalEnabled: true })
    const active = hasMealTargets(nutrition)
    expect(active).toBe(true)
    const sheet = await renderSheet({
      hasMealTargets: active,
      targetCalories: nutrition.targetCalories,
    })
    const text = sheet.text()
    expect(text).toMatch(/Repère indicatif/i)
    expect(text).not.toMatch(/budget|zone|bonne zone|Tu manges comment|manquera|parfait/i)
    await sheet.cleanup()

    const budgets = await renderBudgets(nutrition.targetCalories)
    expect(budgets.text).toMatch(/Repères par repas/i)
    expect(budgets.text).not.toMatch(/budget OK|Combien manger|exactement/i)
    await budgets.cleanup()
  })

  it('ON TCA : aucun mot budget/zone/cible/restantes/bonne zone', async () => {
    const nutrition = getNutritionTarget(
      { ...ADULT, declaredEatingDisorder: true },
      { calorieGoalEnabled: true },
    )
    const active = hasMealTargets(nutrition)
    expect(active).toBe(false)
    const sheet = await renderSheet({
      hasMealTargets: active,
      targetCalories: nutrition.targetCalories,
    })
    expect(sheet.text()).not.toMatch(FORBIDDEN)
    await sheet.cleanup()
    const budgets = await renderBudgets(nutrition.targetCalories)
    expect(budgets.host.childElementCount).toBe(0)
    await budgets.cleanup()
  })

  it('ON grossesse : aucun mot budget/zone/cible/restantes/bonne zone', async () => {
    const nutrition = getNutritionTarget(
      { ...ADULT, sex: 'female', declaredPregnancy: true },
      { calorieGoalEnabled: true },
    )
    const active = hasMealTargets(nutrition)
    expect(active).toBe(false)
    const sheet = await renderSheet({
      hasMealTargets: active,
      targetCalories: nutrition.targetCalories,
    })
    expect(sheet.text()).not.toMatch(FORBIDDEN)
    await sheet.cleanup()
    const budgets = await renderBudgets(nutrition.targetCalories)
    expect(budgets.host.childElementCount).toBe(0)
    await budgets.cleanup()
  })

  it('ON mineur : aucun mot budget/zone/cible/restantes/bonne zone', async () => {
    const nutrition = getNutritionTarget(
      { ...ADULT, age: 16 },
      { calorieGoalEnabled: true },
    )
    const active = hasMealTargets(nutrition)
    expect(active).toBe(false)
    const sheet = await renderSheet({
      hasMealTargets: active,
      targetCalories: nutrition.targetCalories,
    })
    expect(sheet.text()).not.toMatch(FORBIDDEN)
    await sheet.cleanup()
    const budgets = await renderBudgets(nutrition.targetCalories)
    expect(budgets.host.childElementCount).toBe(0)
    await budgets.cleanup()
  })
})
