/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NutritionDayMealsCard } from './NutritionDayMealsCard'
import type { MealEntry } from '../../types/nutrition'
import { getByText } from './testGetByText'

describe('NutritionDayMealsCard — Pas enregistré (file refus définitif)', () => {
  it('affiche « Pas enregistré » quand syncRejected', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const meal: MealEntry = {
      id: 'm1',
      name: 'Riz',
      mealType: 'lunch',
      calories: 200,
      grams: 150,
      createdAt: 1,
      syncRejected: true,
      syncRejectCode: 'FOOD_ADD_QUANTITY_INVALID',
    }

    await act(async () => {
      root.render(
        <NutritionDayMealsCard meals={[meal]} onAddMeal={vi.fn()} hideNutritionNumbers />,
      )
    })

    const toggle = host.querySelector('[data-meal-toggle="lunch"]') as HTMLButtonElement
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(getByText(host, 'Pas enregistré').textContent).toBe('Pas enregistré')
    expect(host.querySelector('[data-meal-sync-rejected]')).toBeTruthy()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
