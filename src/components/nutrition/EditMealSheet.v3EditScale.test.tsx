/** @vitest-environment jsdom */
/**
 * V3-02 — EditMealSheet hideNutritionNumbers : Enregistrer renvoie kcal/macros
 * recalculés (Nutella 30→100 = 539, pas 162).
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditMealSheet } from './EditMealSheet'
import type { MealEntry } from '../../types/nutrition'
import {
  clearFoodOfflineCache,
  rememberFoodHits,
} from '../../services/foodOfflineCache'

const nutella30: MealEntry = {
  id: 'm-nutella',
  name: 'Nutella',
  mealType: 'snack',
  calories: 162,
  proteinG: 1.9,
  carbsG: 17.3,
  fatG: 9.3,
  grams: 30,
  portionLabel: '30 g',
  offCode: '3017620422003',
  entrySource: 'v3',
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

describe('EditMealSheet — V3-02 rescale hideNutritionNumbers', () => {
  let host: HTMLDivElement
  let root: Root
  const prevFlag = import.meta.env.VITE_ENABLE_FOOD_ADD_V3

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', 'true')
    clearFoodOfflineCache()
    rememberFoodHits([
      {
        nom: 'Nutella',
        barcode: '3017620422003',
        brands: 'Ferrero',
        calories: 539,
        proteines: 6.3,
        glucides: 57.5,
        lipides: 30.9,
        servingSize: '15 g',
        provenance: 'open_food_facts',
        fetchedAt: 1,
      },
    ])
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
    clearFoodOfflineCache()
    if (prevFlag == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prevFlag)
  })

  it('30→100 g : onSave calories 539 + macros (pas 162)', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={nutella30}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
          hideNutritionNumbers
        />,
      )
    })
    await flushPortal()

    await setGramsInput('100')
    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    await act(async () => {
      save.click()
    })

    expect(onSave).toHaveBeenCalledWith(
      'm-nutella',
      expect.objectContaining({
        grams: 100,
        portionLabel: '100 g',
        calories: 539,
        proteinG: 6.3,
        carbsG: 57.5,
        fatG: 30.9,
        entrySource: 'v3',
      }),
    )
  })

  it('30→250 g : onSave calories 1348 + macros', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={nutella30}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
          hideNutritionNumbers
        />,
      )
    })
    await flushPortal()

    await setGramsInput('250')
    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    await act(async () => {
      save.click()
    })

    expect(onSave).toHaveBeenCalledWith(
      'm-nutella',
      expect.objectContaining({
        grams: 250,
        calories: 1348,
        proteinG: 15.8,
        carbsG: 143.8,
        fatG: 77.3,
      }),
    )
  })
})
