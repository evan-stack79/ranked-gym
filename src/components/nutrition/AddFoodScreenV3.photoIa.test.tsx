/** @vitest-environment jsdom */
/**
 * V3-05 — Photo IA :
 * - adultes (≥18, hors grossesse/allaitement) : MealPhotoAnalyzer → estimation
 *   labellisée, éditable, ajout seulement après confirm ;
 * - mineur / âge inconnu / grossesse / allaitement : focus recherche, 0 kcal.
 * V3-06 — loupe visible (z-10) dans le champ recherche.
 */
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { AddFoodScreenV3, PHOTO_IA_ESTIMATE_LABEL } from './AddFoodScreenV3'
import { canUseMealPhotoEstimate } from '../../services/nutritionSafetyRules'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import type { MealType } from '../../types/nutrition'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    isAuthenticated: true,
    requireAuth: (fn: () => void) => fn(),
  }),
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

vi.mock('./MealPhotoAnalyzer', () => ({
  MealPhotoAnalyzer: ({
    onAnalyzed,
  }: {
    onAnalyzed: (macros: {
      calories: number
      proteines: number
      glucides: number
      lipides: number
      name: string
      mealType: MealType
      scansRemaining: number
      dailyLimit: number
    }) => void
  }) => (
    <button
      type="button"
      data-mock-meal-photo-analyzer
      onClick={() =>
        onAnalyzed({
          calories: 450,
          proteines: 20,
          glucides: 40,
          lipides: 15,
          name: 'Repas (IA)',
          mealType: 'lunch',
          scansRemaining: 4,
          dailyLimit: 5,
        })
      }
    >
      Photo IA
    </button>
  ),
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

function renderScreen(
  root: Root,
  props: {
    photoEstimateAllowed?: boolean
    onPhotoAnalyzed?: ReturnType<typeof vi.fn>
    onValidateSelection?: ReturnType<typeof vi.fn>
  } = {},
) {
  const onPhotoAnalyzed = props.onPhotoAnalyzed ?? vi.fn()
  const onValidateSelection = props.onValidateSelection ?? vi.fn()
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
      photoEstimateAllowed={props.photoEstimateAllowed ?? false}
      onPhotoAnalyzed={onPhotoAnalyzed}
      name=""
      onNameChange={vi.fn()}
      mealType="lunch"
      onMealTypeChange={vi.fn()}
      onSubmitManual={(e) => e.preventDefault()}
      onClose={vi.fn()}
      forceOfflineImages
    />,
  )
  return { onPhotoAnalyzed, onValidateSelection }
}

describe('canUseMealPhotoEstimate (V3-05 gate)', () => {
  it('adulte hors grossesse/allaitement → true', () => {
    expect(
      canUseMealPhotoEstimate({
        age: 25,
        sex: 'female',
        weightKg: 60,
        heightCm: 165,
        declaredPregnancy: false,
        declaredBreastfeeding: false,
        healthAnswer: 'none',
      }),
    ).toBe(true)
  })

  it('mineur / âge inconnu → false', () => {
    expect(canUseMealPhotoEstimate({ age: 16, sex: 'male', weightKg: 60, heightCm: 170 })).toBe(
      false,
    )
    expect(
      canUseMealPhotoEstimate({ age: undefined, sex: 'male', weightKg: 60, heightCm: 170 }),
    ).toBe(false)
    expect(canUseMealPhotoEstimate(null)).toBe(false)
  })

  it('grossesse / allaitement → false', () => {
    expect(
      canUseMealPhotoEstimate({
        age: 28,
        sex: 'female',
        weightKg: 60,
        heightCm: 165,
        declaredPregnancy: true,
        declaredBreastfeeding: false,
        healthAnswer: 'situations',
      }),
    ).toBe(false)
    expect(
      canUseMealPhotoEstimate({
        age: 28,
        sex: 'female',
        weightKg: 60,
        heightCm: 165,
        declaredPregnancy: false,
        declaredBreastfeeding: true,
        healthAnswer: 'situations',
      }),
    ).toBe(false)
  })
})

describe('AddFoodScreenV3 — V3-05 Photo IA', () => {
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

  it('adulte : estimation affichée, labellisée, éditable, pas d’ajout avant confirm', async () => {
    const onPhotoAnalyzed = vi.fn()
    const onValidateSelection = vi.fn()
    await act(async () => {
      renderScreen(root, {
        photoEstimateAllowed: true,
        onPhotoAnalyzed,
        onValidateSelection,
      })
    })

    expect(document.querySelector('[data-mock-meal-photo-analyzer]')).toBeTruthy()
    expect(document.querySelector('[data-food-photo-search-only]')).toBeNull()

    await act(async () => {
      ;(document.querySelector('[data-mock-meal-photo-analyzer]') as HTMLButtonElement).click()
    })

    expect(onPhotoAnalyzed).not.toHaveBeenCalled()
    expect(onValidateSelection).not.toHaveBeenCalled()

    const panel = document.querySelector('[data-photo-ia-estimate]') as HTMLElement
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain(PHOTO_IA_ESTIMATE_LABEL)
    expect(document.querySelector('[data-photo-ia-estimate-label]')?.textContent).toBe(
      'estimation IA, à vérifier',
    )

    const kcal = document.querySelector('[data-photo-ia-kcal]') as HTMLInputElement
    expect(kcal).toBeTruthy()
    expect(Number(kcal.value)).toBe(450)
    expect(kcal.disabled).toBe(false)

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(kcal, '380')
      kcal.dispatchEvent(new Event('input', { bubbles: true }))
      kcal.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(onPhotoAnalyzed).not.toHaveBeenCalled()
    expect(Number((document.querySelector('[data-photo-ia-kcal]') as HTMLInputElement).value)).toBe(
      380,
    )

    await act(async () => {
      ;(document.querySelector('[data-photo-ia-confirm]') as HTMLButtonElement).click()
    })

    expect(onPhotoAnalyzed).toHaveBeenCalledTimes(1)
    expect(onPhotoAnalyzed.mock.calls[0][0].calories).toBe(380)
    expect(onValidateSelection).not.toHaveBeenCalled()
    expect(document.querySelector('[data-photo-ia-estimate]')).toBeNull()
  })

  it('mineur / âge inconnu / grossesse / allaitement : recherche seulement, 0 kcal', async () => {
    expect(
      canUseMealPhotoEstimate({ age: 15, sex: 'female', weightKg: 50, heightCm: 160 }),
    ).toBe(false)
    expect(
      canUseMealPhotoEstimate({ age: undefined, sex: 'female', weightKg: 50, heightCm: 160 }),
    ).toBe(false)
    expect(
      canUseMealPhotoEstimate({
        age: 30,
        sex: 'female',
        weightKg: 60,
        heightCm: 165,
        declaredPregnancy: true,
        healthAnswer: 'situations',
      }),
    ).toBe(false)
    expect(
      canUseMealPhotoEstimate({
        age: 30,
        sex: 'female',
        weightKg: 60,
        heightCm: 165,
        declaredBreastfeeding: true,
        healthAnswer: 'situations',
      }),
    ).toBe(false)

    const onPhotoAnalyzed = vi.fn()
    await act(async () => {
      renderScreen(root, { photoEstimateAllowed: false, onPhotoAnalyzed })
    })

    expect(document.querySelector('[data-mock-meal-photo-analyzer]')).toBeNull()
    expect(document.querySelector('[data-food-photo-search-only]')).toBeTruthy()

    const search = document.querySelector(
      'input[aria-label="Rechercher un aliment Open Food Facts"]',
    ) as HTMLInputElement
    search.blur()
    expect(document.activeElement).not.toBe(search)

    await act(async () => {
      ;(document.querySelector('[data-food-scan-photo]') as HTMLButtonElement).click()
    })

    expect(document.activeElement).toBe(search)
    expect(onPhotoAnalyzed).not.toHaveBeenCalled()
    expect(document.querySelector('[data-photo-ia-estimate]')).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/estimation IA/i)
  })

  it('V3-06 : loupe z-10 dans le champ recherche', () => {
    const source = readFileSync('src/components/nutrition/AddFoodScreenV3.tsx', 'utf8')
    expect(source).toContain('data-food-search-loupe')
    expect(source).toMatch(/data-food-search-loupe[\s\S]*?z-10/)
    expect(source).toContain("from './MealPhotoAnalyzer'")
  })
})
