/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AddFoodScreen } from './AddFoodScreen'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

const hits: OpenFoodFactsSearchHit[] = [
  {
    barcode: '1',
    nom: 'BANANE 250g',
    brands: 'Bio',
    calories: 89,
    proteines: 1,
    glucides: 23,
    lipides: 0,
    imageUrl: 'https://example.com/banane.jpg',
    servingSize: '1 serving (120g)',
    categoriesTags: ['en:fruits'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: '2',
    nom: 'Cola',
    brands: 'X',
    calories: 42,
    proteines: 0,
    glucides: 10,
    lipides: 0,
    servingSize: null,
    categoriesTags: ['en:beverages'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
]

function noop() {}

describe('AddFoodScreen content rules', () => {
  it('cartes : photo/nom/portion seulement — pas de kcal, Nutri-Score, prix, promo', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <AddFoodScreen
          searchQuery=""
          onSearchQueryChange={noop}
          searchLoading={false}
          searchError={null}
          searchHits={hits}
          category="all"
          onCategoryChange={noop}
          onValidateSelection={noop}
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
          forceOfflineImages
        />,
      )
    })

    const screen = document.querySelector('[data-add-food-screen]')
    expect(screen).toBeTruthy()
    expect(screen?.textContent).toContain('Ajouter')
    expect(screen?.textContent).toContain('un aliment')
    expect(screen?.textContent).toContain('Banane')
    expect(screen?.textContent).toContain('1 portion (120 g)')
    expect(screen?.textContent).toContain('pour 100 g')
    expect(screen?.textContent).toContain('Données Open Food Facts')
    expect(screen?.textContent).toContain('CC BY-SA 3.0')
    expect(screen?.textContent).toContain('Ou saisie manuelle')

    const text = screen?.textContent ?? ''
    expect(text).not.toMatch(/\bkcal\b/i)
    expect(text).not.toMatch(/Nutri-?Score/i)
    expect(text).not.toMatch(/Eco-?score/i)
    expect(text).not.toMatch(/€|promo|bon marché|mauvais|excellent/i)
    expect(text).not.toContain('Touchez pour revoir')

    // Offline → icônes neutres
    expect(document.querySelectorAll('[data-off-image="fallback"]').length).toBeGreaterThan(0)

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
