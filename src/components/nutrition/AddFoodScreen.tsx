import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ScanBarcode, Search, X } from 'lucide-react'
import type { MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import {
  FOOD_CATEGORIES,
  hitMatchesFoodCategory,
  type FoodCategoryId,
} from '../../utils/foodCategories'
import { MealPhotoAnalyzer } from './MealPhotoAnalyzer'
import { FoodCategoryWheel } from './FoodCategoryWheel'
import { FoodProductCard } from './FoodProductCard'
import { FoodSelectionBar } from './FoodSelectionBar'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function MealTypeChip({
  type,
  active,
  onClick,
}: {
  type: MealType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        active
          ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-white'
          : 'border-white/10 bg-black/25 text-[#8E8E93]'
      }`}
    >
      {MEAL_TYPE_LABELS[type]}
    </button>
  )
}

function hitKey(hit: OpenFoodFactsSearchHit): string {
  return `${hit.barcode}::${hit.nom}`
}

interface AddFoodScreenProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  searchLoading: boolean
  searchError: string | null
  searchHits: OpenFoodFactsSearchHit[]
  category: FoodCategoryId
  onCategoryChange: (id: FoodCategoryId) => void
  /** Ajoute immédiatement les aliments choisis (snapshots). */
  onValidateSelection: (hits: OpenFoodFactsSearchHit[]) => void
  onOpenScanner: () => void
  scannerSlot?: ReactNode
  onToast: (message: string, variant?: 'success' | 'error') => void
  onPhotoAnalyzed: (result: {
    name: string
    mealType: MealType
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => void
  name: string
  onNameChange: (value: string) => void
  calories: number
  onCaloriesChange: (value: number) => void
  proteinG: number | ''
  onProteinChange: (value: number | '') => void
  carbsG: number | ''
  onCarbsChange: (value: number | '') => void
  fatG: number | ''
  onFatChange: (value: number | '') => void
  mealType: MealType
  onMealTypeChange: (type: MealType) => void
  onSubmitManual: (event: FormEvent) => void
  onClose: () => void
  /** Tests : force icônes neutres. */
  forceOfflineImages?: boolean
}

/**
 * Plein écran « Ajouter un aliment » — design v3 (roue ARC + cartes 2 col).
 * Insets via env(safe-area-inset-*) pour encoche / Dynamic Island.
 */
export function AddFoodScreen({
  searchQuery,
  onSearchQueryChange,
  searchLoading,
  searchError,
  searchHits,
  category,
  onCategoryChange,
  onValidateSelection,
  onOpenScanner,
  scannerSlot,
  onToast,
  onPhotoAnalyzed,
  name,
  onNameChange,
  calories,
  onCaloriesChange,
  proteinG,
  onProteinChange,
  carbsG,
  onCarbsChange,
  fatG,
  onFatChange,
  mealType,
  onMealTypeChange,
  onSubmitManual,
  onClose,
  forceOfflineImages = false,
}: AddFoodScreenProps) {
  const [manualOpen, setManualOpen] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const searchActive = searchQuery.trim().length > 0

  const filteredHits = useMemo(() => {
    if (category === 'all') return searchHits
    return searchHits.filter((hit) => hitMatchesFoodCategory(category, hit.categoriesTags))
  }, [searchHits, category])

  const selectedHits = useMemo(() => {
    const map = new Map(filteredHits.map((h) => [hitKey(h), h] as const))
    // Keep selection even if filtered out of current view
    for (const h of searchHits) map.set(hitKey(h), h)
    return selectedKeys.map((k) => map.get(k)).filter((h): h is OpenFoodFactsSearchHit => Boolean(h))
  }, [selectedKeys, filteredHits, searchHits])

  useEffect(() => {
    if (searchActive) setManualOpen(false)
  }, [searchActive])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleHit = (hit: OpenFoodFactsSearchHit) => {
    const key = hitKey(hit)
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleValidate = () => {
    if (selectedHits.length === 0) return
    onValidateSelection(selectedHits)
    setSelectedKeys([])
  }

  const idleBrowse = !searchActive && filteredHits.length === 0 && !searchLoading
  const categoryLabel = FOOD_CATEGORIES.find((c) => c.id === category)?.label ?? 'Tout'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-title"
      data-add-food-screen
      className="fixed inset-0 z-[90] flex h-[100dvh] w-screen flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background:
          'radial-gradient(ellipse 120% 55% at 50% -8%, rgb(90 18 22 / 0.55) 0%, transparent 58%), #0C0C0E',
      }}
    >
      <header className="flex shrink-0 items-start gap-3 px-4 pb-1 pt-3">
        <h1
          id="add-food-title"
          className="min-w-0 flex-1 text-[28px] font-bold leading-[1.05] tracking-tight text-white"
        >
          Ajouter
          <br />
          un aliment
        </h1>
        <button
          type="button"
          onClick={onClose}
          className="ios-press mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#EBEBF5]"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
      </header>

      <div className="flex shrink-0 flex-col gap-3 px-4 pb-1 pt-2">
        <label className="relative block">
          <span className="sr-only">Rechercher un aliment</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]"
            strokeWidth={2.25}
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Rechercher un aliment, une marque…"
            className="w-full rounded-2xl border border-white/12 py-3.5 pl-10 pr-3.5 text-[15px] text-white placeholder:text-[#636366] outline-none focus:border-[#FF2B2B]/45"
            style={{
              background: 'rgb(255 255 255 / 0.06)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
            autoComplete="off"
            autoFocus
            role="searchbox"
            aria-label="Rechercher un aliment Open Food Facts"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenScanner}
            className="ios-press flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[13px] font-semibold text-white"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF2B2B] text-white">
              <ScanBarcode className="h-4 w-4" aria-hidden />
            </span>
            Scan Code-Barre
          </button>
          <MealPhotoAnalyzer
            variant="button"
            buttonClassName="ios-press flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[13px] font-semibold text-white disabled:opacity-50"
            iconSlot={
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF2B2B] text-white">
                <Camera className="h-4 w-4" aria-hidden />
              </span>
            }
            onToast={onToast}
            onAnalyzed={(result) => {
              onPhotoAnalyzed({
                name: result.name,
                mealType: result.mealType,
                calories: result.calories,
                proteinG: result.proteines,
                carbsG: result.glucides,
                fatG: result.lipides,
              })
            }}
          />
        </div>
      </div>

      <FoodCategoryWheel value={category} onChange={onCategoryChange} />

      <div className="relative mx-0 mb-0 flex min-h-0 flex-1 flex-col px-4">
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] ${
            selectedHits.length > 0 ? 'pb-[calc(7rem+env(safe-area-inset-bottom,0px))]' : ''
          }`}
          data-food-results
        >
          {searchLoading && filteredHits.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#8E8E93]">Recherche Open Food Facts…</p>
          ) : null}

          {searchError && !searchLoading ? (
            <p className="py-8 text-center text-[13px] text-[#FF6961]" role="alert">
              {searchError}
            </p>
          ) : null}

          {!searchLoading && !searchError && searchActive && filteredHits.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#8E8E93]">Aucun produit trouvé.</p>
          ) : null}

          {idleBrowse ? (
            <p className="py-8 text-center text-[13px] text-[#8E8E93]">
              {category === 'all'
                ? 'Recherche un aliment ou choisis une catégorie.'
                : `Charge les produits « ${categoryLabel} »…`}
            </p>
          ) : null}

          {filteredHits.length > 0 ? (
            <ul
              className="grid grid-cols-2 gap-x-3 gap-y-8 pt-8"
              role="listbox"
              aria-label="Résultats Open Food Facts"
              aria-multiselectable="true"
            >
              {filteredHits.map((hit) => {
                const key = hitKey(hit)
                return (
                  <li key={key}>
                    <FoodProductCard
                      hit={hit}
                      selected={selectedKeys.includes(key)}
                      onToggle={() => toggleHit(hit)}
                      forceOfflineImages={forceOfflineImages}
                    />
                  </li>
                )
              })}
            </ul>
          ) : null}

          <footer className="mt-8 space-y-1 pb-4 text-center">
            <p className="text-[11px] text-[#636366]">Données Open Food Facts</p>
            <p className="text-[10px] leading-snug text-[#48484A]">
              Photos : contributeurs Open Food Facts · CC BY-SA 3.0
            </p>
          </footer>

          {!searchActive ? (
            <div className="border-t border-white/8 pb-4 pt-2">
              <button
                type="button"
                onClick={() => setManualOpen((v) => !v)}
                className="ios-press w-full py-2 text-left text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]"
                aria-expanded={manualOpen}
              >
                {manualOpen ? 'Masquer la saisie manuelle' : 'Ou saisie manuelle'}
              </button>

              {manualOpen ? (
                <form
                  onSubmit={onSubmitManual}
                  className="mt-2 max-h-[42vh] space-y-3 overflow-y-auto overscroll-contain"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {MEAL_TYPES.map((type) => (
                      <MealTypeChip
                        key={type}
                        type={type}
                        active={mealType === type}
                        onClick={() => onMealTypeChange(type)}
                      />
                    ))}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Nom</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Poulet riz brocoli…"
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/40"
                      required
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                        Calories
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={5000}
                        value={calories}
                        onChange={(e) => onCaloriesChange(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#FF2B2B]/40"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                        Protéines (g)
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={400}
                        value={proteinG}
                        onChange={(e) =>
                          onProteinChange(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="Optionnel"
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                        Glucides (g)
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={400}
                        value={carbsG}
                        onChange={(e) =>
                          onCarbsChange(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="Optionnel"
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                        Lipides (g)
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={400}
                        value={fatG}
                        onChange={(e) =>
                          onFatChange(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="Optionnel"
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/40"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="btn-brand w-full rounded-xl border border-white/15 py-3 text-[15px] font-semibold text-white"
                  >
                    Enregistrer
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>

        {scannerSlot ? (
          <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain">{scannerSlot}</div>
        ) : null}

        <FoodSelectionBar
          selected={selectedHits}
          onValidate={handleValidate}
          forceOfflineImages={forceOfflineImages}
        />
      </div>
    </div>,
    document.body,
  )
}
