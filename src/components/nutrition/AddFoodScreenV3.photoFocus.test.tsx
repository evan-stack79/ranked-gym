/** @vitest-environment jsdom */
/**
 * V3-05 — Photo IA : focus recherche uniquement.
 * Jamais MealPhotoAnalyzer, jamais mutation repas / kcal.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
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

vi.mock('./MealPhotoAnalyzer', () => ({
  MealPhotoAnalyzer: () => {
    throw new Error('MealPhotoAnalyzer must not mount on V3 Photo IA')
  },
}))

const hit: OpenFoodFactsSearchHit = {
  barcode: '1',
  nom: 'Banane',
  brands: '',
  calories: 89,
  proteines: 1,
  glucides: 23,
  lipides: 0,
  servingSize: '100 g',
  categoriesTags: ['en:fruits'],
  provenance: 'open_food_facts',
  fetchedAt: 1,
}

describe('AddFoodScreenV3 — V3-05 Photo IA → focus recherche', () => {
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

  it('clic Photo IA : focus search, pas de MealPhotoAnalyzer, pas de validate/kcal', async () => {
    const onValidateSelection = vi.fn()
    const onPhotoAnalyzed = vi.fn()
    const onSubmitManual = vi.fn((e: Event) => e.preventDefault())

    await act(async () => {
      root.render(
        <AddFoodScreenV3
          searchQuery=""
          onSearchQueryChange={vi.fn()}
          searchLoading={false}
          searchError={null}
          searchHits={[hit]}
          category="all"
          onCategoryChange={vi.fn()}
          onValidateSelection={onValidateSelection}
          onOpenScanner={vi.fn()}
          onPhotoAnalyzed={onPhotoAnalyzed}
          name=""
          onNameChange={vi.fn()}
          mealType="lunch"
          onMealTypeChange={vi.fn()}
          onSubmitManual={onSubmitManual}
          onClose={vi.fn()}
          forceOfflineImages
        />,
      )
    })

    const source = readFileSync('src/components/nutrition/AddFoodScreenV3.tsx', 'utf8')
    expect(source).not.toMatch(/from ['\"]\.\/MealPhotoAnalyzer['\"]/)
    expect(source).not.toContain('<MealPhotoAnalyzer')

    const photo = document.querySelector('[data-food-scan-photo]') as HTMLButtonElement
    expect(photo).toBeTruthy()
    expect(photo.disabled).toBe(false)

    const search = document.querySelector(
      'input[aria-label="Rechercher un aliment Open Food Facts"]',
    ) as HTMLInputElement
    expect(search).toBeTruthy()
    search.blur()
    expect(document.activeElement).not.toBe(search)

    await act(async () => {
      photo.click()
    })

    expect(document.activeElement).toBe(search)
    expect(onValidateSelection).not.toHaveBeenCalled()
    expect(onPhotoAnalyzed).not.toHaveBeenCalled()
    expect(onSubmitManual).not.toHaveBeenCalled()
    expect(document.body.textContent ?? '').not.toMatch(/\bkcal\b/i)
  })

  it('V3-06 : loupe a z-10 au-dessus du champ', () => {
    const source = readFileSync('src/components/nutrition/AddFoodScreenV3.tsx', 'utf8')
    expect(source).toContain('data-food-search-loupe')
    expect(source).toMatch(/data-food-search-loupe[\s\S]*?z-10/)
  })
})
