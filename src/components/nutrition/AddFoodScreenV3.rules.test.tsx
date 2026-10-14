/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AddFoodScreenV3 } from './AddFoodScreenV3'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

const FORBIDDEN =
  /\bkcal\b|Nutri-?Score|Eco-?score|€|promo|mauvais|excellent|sans sucre|léger|sain|à éviter|bon pour/i

const hits: OpenFoodFactsSearchHit[] = [
  {
    barcode: '20753030',
    nom: 'bananes Cavendish',
    brands: 'Oaklands',
    calories: 89,
    proteines: 1,
    glucides: 23,
    lipides: 0.3,
    imageUrl: 'https://x.convex.cloud/bananes.png',
    servingSize: '1 serving (100 g)',
    categoriesTags: ['en:fruits'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: '3228020232028',
    nom: 'le Brie président',
    brands: 'Président',
    calories: 350,
    proteines: 20,
    glucides: 0,
    lipides: 30,
    imageUrl: 'https://x.convex.cloud/brie.png',
    servingSize: '0.5 wedge (100 g)',
    categoriesTags: ['en:dairies'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
]

function noop() {}

describe('AddFoodScreenV3 — règles produit', () => {
  it('cartes : photo + nom + portion seulement ; attribution OFF ; pas de jugement', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <AddFoodScreenV3
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
    const text = screen?.textContent ?? ''
    expect(text).toContain('Bananes Cavendish')
    expect(text).toContain('1 portion (100 g)')
    expect(text).toContain('Le Brie président')
    expect(text).toContain('0,5 pointe (100 g)')
    expect(text).toContain('Données Open Food Facts')
    expect(text).toContain('CC BY-SA 3.0')
    expect(text).toContain('Tout')
    expect(text).toContain('Fruits')
    expect(text).toMatch(/Hors ligne/)
    expect(text).not.toMatch(FORBIDDEN)
    expect(document.querySelector('[data-food-offline-banner]')).toBeTruthy()

    await act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
