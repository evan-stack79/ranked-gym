/** @vitest-environment jsdom */
/**
 * Vérificateur — fiche Modifier ne change jamais les pièces d’une ligne V3.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditMealSheet } from './EditMealSheet'
import type { MealEntry } from '../../types/nutrition'

const mealPieces: MealEntry = {
  id: 'v3-pieces',
  name: 'Nugget',
  mealType: 'lunch',
  calories: 90,
  pieces: 1,
  grams: undefined,
  portionLabel: '1 pièce',
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

describe('EditMealSheet — pièces V3 (garde-fou Vérificateur)', () => {
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

  it('ligne V3 pieces:1 : Enregistrer envoie pieces=1 ou undefined, jamais une autre valeur', async () => {
    const onSave = vi.fn()
    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={mealPieces}
          onClose={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
          hideNutritionNumbers
        />,
      )
    })
    await flushPortal()

    const save = document.querySelector('[data-testid="edit-meal-save"]') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    await act(async () => {
      save.click()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    const patch = onSave.mock.calls[0]![1] as Partial<MealEntry>
    // upsertMeal / file reçoit pieces 1 ou undefined — jamais 2 ni autre.
    expect(patch.pieces === 1 || patch.pieces === undefined).toBe(true)
    if (patch.pieces !== undefined) expect(patch.pieces).toBe(1)
    expect(patch.entrySource).toBe('v3')
  })
})
