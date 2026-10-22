/** @vitest-environment jsdom */
/**
 * V3-13 — plafond 5000 kcal à l’étape quantité (Nutella 539 kcal/100 g).
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddFoodScreenV3, MEAL_KCAL_ABOVE_MAX_MSG } from './AddFoodScreenV3'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

/** Nutella ≈ 539 kcal / 100 g → 1000 g = 5390 ; 2000 g = 10780. */
const nutella: OpenFoodFactsSearchHit = {
  barcode: '3017620422003',
  nom: 'Nutella',
  brands: 'Ferrero',
  calories: 539,
  proteines: 6,
  glucides: 57,
  lipides: 31,
  servingSize: '15 g',
  categoriesTags: ['en:spreads'],
  provenance: 'open_food_facts',
  fetchedAt: 1,
}

describe('AddFoodScreenV3 — V3-13 plafond kcal quantité', () => {
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

  async function openQuantityStep() {
    const onValidateSelection = vi.fn()
    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="nutella"
          onSearchQueryChange={vi.fn()}
          searchLoading={false}
          searchError={null}
          searchHits={[nutella]}
          category="all"
          onCategoryChange={vi.fn()}
          onValidateSelection={onValidateSelection}
          name=""
          onNameChange={vi.fn()}
          mealType="snack"
          onMealTypeChange={vi.fn()}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={vi.fn()}
        />,
      )
    })
    const card = document.querySelector('[data-food-card]') as HTMLButtonElement
    await act(async () => {
      card.click()
    })
    const barBtn = document.querySelector(
      '[data-food-selection-bar] button',
    ) as HTMLButtonElement
    await act(async () => {
      barBtn.click()
    })
    expect(document.querySelector('[data-food-quantity-step]')).toBeTruthy()
    return onValidateSelection
  }

  async function typeGrams(value: string) {
    const input = document.querySelector(
      'input[data-testid^="food-qty-input-"]',
    ) as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('1000 g Nutella (5390 kcal) : message + Valider bloqué', async () => {
    const onValidate = await openQuantityStep()
    await typeGrams('1000')
    expect(document.querySelector('[data-food-kcal-cap-error]')?.textContent).toBe(
      MEAL_KCAL_ABOVE_MAX_MSG,
    )
    const validateBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Valider'),
    ) as HTMLButtonElement
    expect(validateBtn.disabled).toBe(true)
    await act(async () => {
      validateBtn.click()
    })
    expect(onValidate).not.toHaveBeenCalled()
  })

  it('2000 g Nutella : même message, confirm bloqué', async () => {
    const onValidate = await openQuantityStep()
    await typeGrams('2000')
    expect(document.body.textContent).toContain(MEAL_KCAL_ABOVE_MAX_MSG)
    const validateBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Valider'),
    ) as HTMLButtonElement
    expect(validateBtn.disabled).toBe(true)
    expect(onValidate).not.toHaveBeenCalled()
  })

  it('500 g Nutella (2695 kcal) : Valider autorisé', async () => {
    const onValidate = await openQuantityStep()
    await typeGrams('500')
    expect(document.querySelector('[data-food-kcal-cap-error]')).toBeNull()
    const validateBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Valider'),
    ) as HTMLButtonElement
    expect(validateBtn.disabled).toBe(false)
    await act(async () => {
      validateBtn.click()
    })
    expect(onValidate).toHaveBeenCalledTimes(1)
  })
})
