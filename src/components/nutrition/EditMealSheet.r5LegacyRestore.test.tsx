/** @vitest-environment jsdom */
/**
 * R5 — V3 OFF (= d33b724) :
 * R5-01 : effacer kcal → restore (required défaut) ; Enregistrer reste actif.
 * R5-02 : effacer macros → reste vide (required={false}) ; onSave ?? undefined
 *         (comme d33b724 L200–202) → sync envoie null → serveur effacé.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditMealSheet } from './EditMealSheet'
import type { MealEntry } from '../../types/nutrition'

const mealWithNutrients: MealEntry = {
  id: 'repas-300',
  name: 'Poulet riz',
  mealType: 'lunch',
  calories: 300,
  proteinG: 25,
  carbsG: 40,
  fatG: 8,
  grams: 250,
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

describe('EditMealSheet — R5 V3 OFF restore (d33b724)', () => {
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

  it('R5-01 : effacer les kcal restaure 300 ; Enregistrer reste actif', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={mealWithNutrients}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    const calInput = await setLabeledInput('Calories', '')
    expect(calInput.value).toBe('300')

    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)

    await act(async () => {
      save.click()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    expect(patch.calories).toBe(300)
    expect(patch.calories).not.toBeNull()
  })

  it('R5-02 : effacer macros reste vide ; onSave envoie undefined (d33b724 → serveur effacé)', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={mealWithNutrients}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      )
    })
    await flushPortal()

    const protein = await setLabeledInput('Protéines', '')
    const carbs = await setLabeledInput('Glucides', '')
    const fat = await setLabeledInput('Lipides', '')
    // d33b724 required={false} : vide au blur, pas de restore.
    expect(protein.value).toBe('')
    expect(carbs.value).toBe('')
    expect(fat.value).toBe('')

    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    await act(async () => {
      save.click()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    // d33b724 : proteinG: proteinG ?? undefined (idem carbsG / fatG)
    expect(patch.proteinG).toBeUndefined()
    expect(patch.carbsG).toBeUndefined()
    expect(patch.fatG).toBeUndefined()
    expect(patch.calories).toBe(300)
  })
})
