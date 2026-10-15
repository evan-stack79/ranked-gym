/** @vitest-environment jsdom */
/**
 * R4-02 — V3 OFF : kcal/macros vides → null (jamais Number('')→0) ;
 * case touchée puis vidée → règles d33b724.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditMealSheet } from './EditMealSheet'
import type { MealEntry } from '../../types/nutrition'

const emptyMeal: MealEntry = {
  id: 'plat-vide',
  name: 'Plat sans kcal',
  mealType: 'lunch',
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  grams: 200,
  createdAt: 1,
}

async function flushPortal() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

async function setLabeledInput(ariaLabel: string, value: string) {
  const input = document.querySelector(
    `input[aria-label="${ariaLabel}"]`,
  ) as HTMLInputElement | null
  expect(input).toBeTruthy()
  await act(async () => {
    input!.focus()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input!, value)
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    input!.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await act(async () => {
    input!.blur()
    input!.dispatchEvent(new Event('blur', { bubbles: true }))
  })
  return input!
}

describe('EditMealSheet — R4-02 V3 OFF kcal/macros vides', () => {
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

  it('kcal + macros vides, seul le type change → onSave envoie null (jamais 0)', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={emptyMeal}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)

    const dinner = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Dîner',
    ) as HTMLButtonElement
    await act(async () => {
      dinner.click()
    })
    await act(async () => {
      save.click()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    expect(patch.mealType).toBe('dinner')
    expect(patch.calories).toBeNull()
    expect(patch.proteinG).toBeNull()
    expect(patch.carbsG).toBeNull()
    expect(patch.fatG).toBeNull()
    expect(patch.calories).not.toBe(0)
    expect(patch.proteinG).not.toBe(0)
  })

  it('macros vides non touchées → envoyées en null, jamais 0', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={emptyMeal}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    await act(async () => {
      save.click()
    })
    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    expect(patch.proteinG).toBeNull()
    expect(patch.carbsG).toBeNull()
    expect(patch.fatG).toBeNull()
    expect(Object.is(patch.proteinG, 0)).toBe(false)
    expect(Object.is(patch.carbsG, 0)).toBe(false)
    expect(Object.is(patch.fatG, 0)).toBe(false)
  })

  it('case Calories touchée puis vidée → Enregistrer désactivé (d33b724), jamais 0 silencieux', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={emptyMeal}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    await setLabeledInput('Calories', '120')
    let save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)

    await setLabeledInput('Calories', '')
    save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)

    await act(async () => {
      save.click()
    })
    expect(onSave).not.toHaveBeenCalled()
  })
})
