/** @vitest-environment jsdom */
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

describe('AddFoodScreenV3 — parcours court (recherche → quantité → valider)', () => {
  it('sélection → étape quantité g/pièces → onValidateSelection sans kcal dans l’UI', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onValidate = vi.fn()

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

    const screen = document.querySelector('[data-add-food-screen]') as HTMLElement
    expect(screen).toBeTruthy()
    expect(screen.getAttribute('data-food-add-v3-court')).toBe('true')
    expect(screen.textContent).not.toMatch(/\bkcal\b/i)
    expect(screen.textContent).not.toContain('Protéines')
    expect(screen.textContent).not.toContain('Scanner')
    expect(screen.textContent).not.toContain('Scan IA')

    const choose = document.querySelector(
      '[data-food-card] button[aria-pressed="false"]',
    ) as HTMLButtonElement
    expect(choose).toBeTruthy()
    await act(async () => {
      choose.click()
    })

    const validateBar = document.querySelector(
      '[data-food-selection-bar] button[aria-label="Valider la sélection"]',
    ) as HTMLButtonElement
    expect(validateBar).toBeTruthy()
    await act(async () => {
      validateBar.click()
    })

    expect(document.querySelector('[data-food-quantity-step]')).toBeTruthy()
    expect(document.querySelector('[data-food-quantity-row]')).toBeTruthy()
    const gramsBtn = Array.from(document.querySelectorAll('[data-food-quantity-step] button')).find(
      (b) => b.textContent === 'Grammes',
    )
    const piecesBtn = Array.from(document.querySelectorAll('[data-food-quantity-step] button')).find(
      (b) => b.textContent === 'Pièces',
    )
    expect(gramsBtn).toBeTruthy()
    expect(piecesBtn).toBeTruthy()

    const qtyInput = document.querySelector(
      '[data-food-quantity-step] input[type="number"]',
    ) as HTMLInputElement
    expect(qtyInput).toBeTruthy()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(qtyInput, '30')
      qtyInput.dispatchEvent(new Event('input', { bubbles: true }))
      qtyInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const confirm = document.querySelector(
      '[data-testid="food-quantity-confirm"]',
    ) as HTMLButtonElement
    await act(async () => {
      confirm.click()
    })

    expect(onValidate).toHaveBeenCalledTimes(1)
    const items = onValidate.mock.calls[0]![0] as FoodAddV3Selection[]
    expect(items).toHaveLength(1)
    expect(items[0]!.hit.nom).toBe('Nutella')
    expect(items[0]!.unit).toBe('g')
    expect(items[0]!.grams).toBe(30)
    expect(items[0]!).not.toHaveProperty('calories')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('saisie manuelle : nom + grammes seulement', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const onName = vi.fn()
    const onGrams = vi.fn()

    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery=""
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[]}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={noop}
          name="Riz"
          onNameChange={onName}
          mealType="lunch"
          onMealTypeChange={noop}
          onSubmitManual={onSubmit}
          onClose={noop}
          manualGrams={120}
          onManualGramsChange={onGrams}
        />,
      )
    })

    const toggle = document.querySelector('[data-manual-toggle]') as HTMLButtonElement
    await act(async () => {
      toggle.click()
    })
    const form = document.querySelector('[data-manual-form]') as HTMLFormElement
    expect(form).toBeTruthy()
    expect(form.textContent).toContain('Nom')
    expect(form.textContent).toContain('Quantité (g)')
    expect(form.textContent).not.toContain('Calories')
    expect(form.textContent).not.toContain('Protéines')
    expect(document.querySelector('[data-testid="food-add-manual-name"]')).toBeTruthy()
    expect(document.querySelector('[data-testid="food-add-manual-grams"]')).toBeTruthy()

    await act(async () => {
      form.requestSubmit()
    })
    expect(onSubmit).toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
