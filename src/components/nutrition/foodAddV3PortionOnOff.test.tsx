/** @vitest-environment jsdom */
/**
 * B111-13/15 — même rangée journal : V3 OFF ≡ d33b724 (« 2 pièces »),
 * V3 ON seul utilise « 1,5 pièce ».
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NutritionDayMealsCard } from './NutritionDayMealsCard'
import type { MealEntry } from '../../types/nutrition'
import { isFoodAddV3Enabled } from '../../backend/foodAddV3FeatureFlag'
import { getByText, queryByText } from './testGetByText'

const legacyPiecesRow: MealEntry = {
  id: 'm-pieces-legacy',
  name: 'Nuggets',
  mealType: 'snack',
  calories: null,
  pieces: 1.5,
  portionLabel: '1.5 pièces',
  createdAt: 1,
}

describe('B111-13/15 — render V3 ON vs OFF même ligne', () => {
  const prev = import.meta.env.VITE_ENABLE_FOOD_ADD_V3
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
    if (prev == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prev)
  })

  async function renderExpandedSnack() {
    await act(async () => {
      root.render(
        <NutritionDayMealsCard
          meals={[legacyPiecesRow]}
          onAddMeal={vi.fn()}
          hideNutritionNumbers
        />,
      )
    })
    const toggle = host.querySelector('[data-meal-toggle="snack"]') as HTMLButtonElement
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  it('V3 OFF : ancienne ligne pieces=1.5 → getByText « 2 pièces » (pas « 1,5 pièce »)', async () => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    expect(isFoodAddV3Enabled()).toBe(false)
    await renderExpandedSnack()
    expect(getByText(host, '2 pièces').textContent).toBe('2 pièces')
    expect(queryByText(host, '1,5 pièce')).toBeNull()
  })

  it('V3 ON : même ligne → getByText « 1,5 pièce » (pas « 2 pièces »)', async () => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', 'true')
    expect(isFoodAddV3Enabled()).toBe(true)
    await renderExpandedSnack()
    expect(getByText(host, '1,5 pièce').textContent).toBe('1,5 pièce')
    expect(queryByText(host, '2 pièces')).toBeNull()
  })
})
