/** @vitest-environment jsdom */
/**
 * B111-11 — EditMealSheet : messages rendus (getByText) + journal « 200 g ».
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditMealSheet } from './EditMealSheet'
import { NutritionDayMealsCard } from './NutritionDayMealsCard'
import type { MealEntry } from '../../types/nutrition'
import {
  FOOD_ADD_QTY_MSG_ABOVE_MAX,
  FOOD_ADD_QTY_MSG_BELOW_MIN,
  FOOD_ADD_QTY_MSG_INVALID_GRAMS,
} from '../../../convex/lib/foodAddQuantity'
import { getByText, queryByText } from './testGetByText'

const meal120: MealEntry = {
  id: 'm-edit',
  name: 'Yaourt',
  mealType: 'breakfast',
  calories: 90,
  grams: 120,
  portionLabel: '120 g',
  createdAt: 1,
}

async function flushPortal() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

async function setGramsInput(value: string) {
  const input = document.querySelector(
    'input[aria-label="Quantité en grammes"]',
  ) as HTMLInputElement | null
  expect(input).toBeTruthy()
  await act(async () => {
    input!.focus()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input!, value)
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    input!.dispatchEvent(new Event('change', { bubbles: true }))
  })
  return input!
}

describe('EditMealSheet — B111-11', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
    document.body.innerHTML = ''
  })

  it('edit 120 → 200 : onSave + journal affiche « 200 g » (getByText)', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={meal120}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    await setGramsInput('200')
    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    await act(async () => {
      save.click()
    })
    expect(onSave).toHaveBeenCalledWith(
      'm-edit',
      expect.objectContaining({
        grams: 200,
        portionLabel: '200 g',
      }),
    )

    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    const updated: MealEntry = { ...meal120, ...patch }
    await act(async () => {
      root.render(
        <NutritionDayMealsCard
          meals={[updated]}
          onAddMeal={vi.fn()}
          hideNutritionNumbers
        />,
      )
    })
    const breakfastToggle = host.querySelector(
      '[data-meal-toggle="breakfast"]',
    ) as HTMLButtonElement
    await act(async () => {
      breakfastToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(getByText(host, '200 g').textContent).toBe('200 g')
    expect(queryByText(host, '120 g')).toBeNull()
  })

  it('rejette 0 / 99999 / 1.5 : messages rendus (getByText)', async () => {
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={meal120}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    const cases: Array<[string, string]> = [
      ['0', FOOD_ADD_QTY_MSG_BELOW_MIN],
      ['99999', FOOD_ADD_QTY_MSG_ABOVE_MAX],
      ['1.5', FOOD_ADD_QTY_MSG_INVALID_GRAMS],
    ]
    for (const [value, msg] of cases) {
      await setGramsInput(value)
      const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
      expect(save.disabled, `expected disabled for ${value}`).toBe(true)
      expect(getByText(document.body, msg).textContent).toBe(msg)
      expect(getByText(document.body, msg).getAttribute('data-food-qty-error')).not.toBeNull()
    }
  })
})
