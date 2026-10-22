/** @vitest-environment jsdom */
/**
 * R4-02 (ajusté R5) — V3 OFF = d33b724 :
 * kcal obligatoires ; effacer après saisie restaure (pas de bouton gris, jamais 0 silencieux).
 * Les envois null « repas déjà vide » restent couverts côté file (foodAdd.r4EmptyNutrientsQueue).
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

const meal300: MealEntry = {
  id: 'plat-300',
  name: 'Plat 300',
  mealType: 'lunch',
  calories: 300,
  proteinG: 10,
  carbsG: 20,
  fatG: 5,
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

describe('EditMealSheet — R4-02 V3 OFF kcal (d33b724 / R5)', () => {
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

  it('repas sans kcal → Enregistrer désactivé (d33b724), jamais envoi 0', async () => {
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
    expect(save.disabled).toBe(true)
    await act(async () => {
      save.click()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('macros déjà null, kcal renseignées → onSave omet les macros (undefined), jamais 0', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={{ ...emptyMeal, calories: 120 }}
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
    expect(patch.calories).toBe(120)
    expect(patch.proteinG).toBeUndefined()
    expect(patch.carbsG).toBeUndefined()
    expect(patch.fatG).toBeUndefined()
    expect(Object.is(patch.proteinG, 0)).toBe(false)
    expect(Object.is(patch.carbsG, 0)).toBe(false)
    expect(Object.is(patch.fatG, 0)).toBe(false)
  })

  it('case Calories vidée → restaure (d33b724), Enregistrer actif, jamais 0 silencieux', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={meal300}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    const input = await setLabeledInput('Calories', '')
    expect(input.value).toBe('300')
    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)

    await act(async () => {
      save.click()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]![1].calories).toBe(300)
  })
})
