/**
 * @vitest-environment jsdom
 *
 * Garantit que V3 OFF (défaut) conserve le rendu legacy : kcal dans l’historique,
 * liste de recherche, formulaire manuel — inchangé vs d33b724.
 */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FoodTextSearchResults } from './FoodTextSearchResults'
import { NutritionDayMealsCard } from './NutritionDayMealsCard'
import { AddFoodScreenLegacy } from './AddFoodScreenLegacy'
import { EditMealSheet } from './EditMealSheet'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import type { MealEntry } from '../../types/nutrition'
import { isFoodAddV3Enabled } from '../../backend/foodAddV3FeatureFlag'

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
  barcode: '1',
  nom: 'Yaourt nature',
  brands: 'Danone',
  calories: 54,
  proteines: 4,
  glucides: 6,
  lipides: 1,
  servingSize: '125 g',
  categoriesTags: ['en:yogurts'],
  provenance: 'open_food_facts',
  fetchedAt: 1,
}

const meal: MealEntry = {
  id: 'm1',
  name: 'Yaourt nature',
  mealType: 'breakfast',
  calories: 54,
  proteinG: 4,
  grams: 125,
  createdAt: 1,
}

function noop() {}

describe('V3 OFF — history / legacy list / manual form inchangés', () => {
  const prev = import.meta.env.VITE_ENABLE_FOOD_ADD_V3

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
  })

  afterEach(() => {
    if (prev == null) vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', '')
    else vi.stubEnv('VITE_ENABLE_FOOD_ADD_V3', prev)
  })

  it('flag OFF par défaut', () => {
    expect(isFoodAddV3Enabled()).toBe(false)
  })

  it('liste legacy FoodTextSearchResults affiche kcal/100g (sans hideNutritionNumbers)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <FoodTextSearchResults
          query="yaourt"
          loading={false}
          error={null}
          hits={[hit]}
          onSelect={noop}
        />,
      )
    })

    expect(host.textContent).toContain('Yaourt nature')
    expect(host.textContent).toContain('54')
    expect(host.textContent).toMatch(/kcal\/100g/)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('historique NutritionDayMealsCard affiche kcal (sans hideNutritionNumbers)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <NutritionDayMealsCard
          meals={[meal]}
          onAddMeal={noop}
          onEditMeal={noop}
        />,
      )
    })

    // Ouvre le panneau petit-déj s’il est replié
    const header = host.querySelector('[data-meal-add="breakfast"]')?.previousElementSibling
      ?? host.querySelector('button[aria-controls]')
    if (header instanceof HTMLElement) {
      await act(async () => {
        header.click()
      })
    }

    expect(host.textContent).toMatch(/54/)
    expect(host.textContent).toMatch(/\bkcal\b/)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('formulaire manuel legacy : Calories + Protéines présents', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <AddFoodScreenLegacy
          searchQuery=""
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={[]}
          onSelectHit={noop}
          onToggleFavorite={noop}
          onOpenScanner={noop}
          onToast={noop}
          onPhotoAnalyzed={noop}
          name=""
          onNameChange={noop}
          calories={350}
          onCaloriesChange={noop}
          proteinG=""
          onProteinChange={noop}
          carbsG=""
          onCarbsChange={noop}
          fatG=""
          onFatChange={noop}
          mealType="lunch"
          onMealTypeChange={noop}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={noop}
        />,
      )
    })

    const toggle = Array.from(document.querySelectorAll('button')).find((b) =>
      /Ou saisie manuelle|Masquer la saisie manuelle/.test(b.textContent ?? ''),
    ) as HTMLButtonElement | undefined
    expect(toggle).toBeTruthy()
    await act(async () => {
      toggle!.click()
    })

    const text = document.body.textContent ?? ''
    expect(text).toContain('Calories')
    expect(text).toContain('Protéines')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('EditMealSheet sans hideNutritionNumbers : Calories + macros', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <EditMealSheet
          open
          meal={meal}
          onClose={noop}
          onSave={noop}
          onDelete={noop}
        />,
      )
    })

    const text = document.body.textContent ?? ''
    expect(text).toContain('Calories')
    expect(text).toContain('Protéines')
    expect(text).toContain('Glucides')
    expect(text).toContain('Lipides')

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
