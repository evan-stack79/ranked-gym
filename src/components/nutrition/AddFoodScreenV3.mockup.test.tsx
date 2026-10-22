/** @vitest-environment jsdom */
/**
 * Maquette V3 — contrôles visibles : Scan / Photo IA, roue, cartes, barre.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddFoodScreenV3 } from './AddFoodScreenV3'
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
  barcode: '20753030',
  nom: 'Bananes Cavendish',
  brands: 'Oaklands',
  calories: 89,
  proteines: 1,
  glucides: 23,
  lipides: 0,
  imageUrl: 'https://example.com/banane.jpg',
  servingSize: '1 serving (100 g)',
  categoriesTags: ['en:fruits'],
  provenance: 'open_food_facts',
  fetchedAt: 1,
}

describe('AddFoodScreenV3 — maquette (scan, roue, cartes, barre)', () => {
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

  it('affiche Scan Code-Barre + Photo IA, placeholder loupe, roue, carte sélectionnable', async () => {
    const onOpenScanner = vi.fn()
    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery="banane"
          onSearchQueryChange={vi.fn()}
          searchLoading={false}
          searchError={null}
          searchHits={[hit]}
          category="all"
          onCategoryChange={vi.fn()}
          onValidateSelection={vi.fn()}
          onOpenScanner={onOpenScanner}
          onToast={vi.fn()}
          onPhotoAnalyzed={vi.fn()}
          name=""
          onNameChange={vi.fn()}
          mealType="snack"
          onMealTypeChange={vi.fn()}
          onSubmitManual={(e) => e.preventDefault()}
          onClose={vi.fn()}
          forceOfflineImages
        />,
      )
    })

    const screen = document.querySelector('[data-add-food-screen]') as HTMLElement
    expect(screen.textContent).toContain('Scan Code-Barre')
    expect(screen.textContent).toContain('Photo IA')
    expect(screen.querySelector('[data-food-scan-actions]')).toBeTruthy()

    const search = document.querySelector('input[type="search"]') as HTMLInputElement
    expect(search.placeholder).toBe('Rechercher un aliment, une marque…')

    const wheel = document.querySelector('[data-food-category-wheel]') as HTMLElement
    expect(wheel).toBeTruthy()
    for (const label of ['Fruits', 'Boissons', 'Tout', 'Repas', 'Snacks']) {
      expect(wheel.textContent).toContain(label)
    }
    expect(wheel.querySelector('[data-category="all"]')).toBeTruthy()

    const card = document.querySelector('[data-food-card]') as HTMLButtonElement
    expect(card).toBeTruthy()
    expect(card.querySelector('[data-portion-label]')?.textContent).toMatch(/portion|100/)
    expect(card.querySelector('[data-portion-pill]')).toBeNull()

    await act(async () => {
      card.click()
    })
    expect(card.getAttribute('data-selected')).toBe('true')
    expect(card.querySelector('[data-food-card-check]')).toBeTruthy()
    expect(document.querySelector('[data-food-selection-bar]')?.textContent).toMatch(
      /1 aliment choisi/,
    )
  })
})
