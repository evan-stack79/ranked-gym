/** @vitest-environment jsdom */
/**
 * QA 6 / PC-05 — EditMealSheet V3 OFF ≡ d33b724 :
 * 120,5 g et 2500 g OK ; pieces intact ; pas de message quantité V3.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditMealSheet } from './EditMealSheet'
import type { MealEntry } from '../../types/nutrition'
import { queryByText } from './testGetByText'
import {
  FOOD_ADD_QTY_MSG_ABOVE_MAX,
  FOOD_ADD_QTY_MSG_INVALID_GRAMS,
} from '../../../convex/lib/foodAddQuantity'

const mealNuggets: MealEntry = {
  id: 'nuggets',
  name: 'Nuggets',
  mealType: 'lunch',
  calories: 280,
  grams: 120,
  pieces: 6,
  portionLabel: '6 pièces',
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

describe('EditMealSheet — V3 OFF (= d33b724)', () => {
  let host: HTMLDivElement
  let root: Root
  const prevFlag = import.meta.env.VITE_ENABLE_FOOD_ADD_V3

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
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
    if (prevFlag == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prevFlag)
  })

  it('120,5 g : Enregistrer actif ; pas de message « entier »', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={mealNuggets}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    await setGramsInput('120.5')
    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    expect(queryByText(document.body, FOOD_ADD_QTY_MSG_INVALID_GRAMS)).toBeNull()

    await act(async () => {
      save.click()
    })
    expect(onSave).toHaveBeenCalledWith(
      'nuggets',
      expect.objectContaining({
        grams: 120.5,
      }),
    )
    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    expect(patch.pieces).toBeUndefined()
    expect(patch.portionLabel).toBeUndefined()
  })

  it('2500 g acceptés (pas above_max V3)', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={mealNuggets}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    await setGramsInput('2500')
    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    expect(queryByText(document.body, FOOD_ADD_QTY_MSG_ABOVE_MAX)).toBeNull()
    await act(async () => {
      save.click()
    })
    expect(onSave).toHaveBeenCalledWith(
      'nuggets',
      expect.objectContaining({ grams: 2500 }),
    )
  })

  it('Enregistrer sans changer grams : pieces non touchés dans le patch', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={mealNuggets}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    await act(async () => {
      save.click()
    })
    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    expect(patch).not.toHaveProperty('pieces')
    expect(patch).not.toHaveProperty('portionLabel')
    expect(patch.grams).toBe(120)
  })
})
