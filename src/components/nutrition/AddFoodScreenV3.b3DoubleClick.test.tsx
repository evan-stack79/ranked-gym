/** @vitest-environment jsdom */
/**
 * B3-05 — Valider bloqué dès le 1er clic (submittingRef).
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AddFoodScreenV3, type FoodAddV3Selection } from './AddFoodScreenV3'
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

const hit: OpenFoodFactsSearchHit = {
  barcode: '3017620422003',
  nom: 'Nutella',
  brands: 'Ferrero',
  calories: 539,
  proteines: 6,
  glucides: 57,
  lipides: 31,
  imageUrl: 'https://x.convex.cloud/n.png',
  servingSize: '15 g',
  categoriesTags: ['en:spreads'],
  provenance: 'open_food_facts',
  fetchedAt: 1,
}

function noop() {}

describe('AddFoodScreenV3 — B3-05 double clic Valider', () => {
  it('2 clics même tick sur Valider → onValidateSelection appelé 1 seule fois', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onValidate = vi.fn((_items: FoodAddV3Selection[]) => {})

    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="nutella"
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[hit]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={onValidate}
          name=""
          onNameChange={noop}
          mealType="snack"
          onMealTypeChange={noop}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={noop}
        />,
      )
    })

    const choose = document.querySelector(
      '[data-food-card][aria-pressed="false"]',
    ) as HTMLButtonElement
    await act(async () => {
      choose.click()
    })
    const validateBar = document.querySelector(
      '[data-food-selection-bar] button[aria-label="Valider la sélection"]',
    ) as HTMLButtonElement
    await act(async () => {
      validateBar.click()
    })

    const qtyInput = document.querySelector(
      '[data-food-quantity-step] input[type="number"]',
    ) as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(qtyInput, '30')
    await act(async () => {
      qtyInput.dispatchEvent(new Event('input', { bubbles: true }))
      qtyInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const confirm = document.querySelector(
      '[data-testid="food-quantity-confirm"]',
    ) as HTMLButtonElement
    await act(async () => {
      // Même tick : 2 clics sans re-render entre les deux.
      confirm.click()
      confirm.click()
    })

    expect(onValidate).toHaveBeenCalledTimes(1)
    root.unmount()
    host.remove()
  })
})
