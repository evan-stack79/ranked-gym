import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Search, ScanBarcode, X } from 'lucide-react'
import type { MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import { FoodTextSearchResults } from './FoodTextSearchResults'
import { MealPhotoAnalyzer } from './MealPhotoAnalyzer'

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
      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
        active
          ? 'border-[#34C759]/45 bg-[#34C759]/20 text-[#30D158]'
          : 'border-white/10 bg-black/25 text-[#8E8E93]'
      }`}
    >
      {MEAL_TYPE_LABELS[type]}
    </button>
  )
}

interface AddFoodScreenProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  searchLoading: boolean
  searchError: string | null
  searchHits: OpenFoodFactsSearchHit[]
  onSelectHit: (hit: OpenFoodFactsSearchHit) => void
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
}

/**
 * Plein écran « Ajouter un aliment » (PWA — pas de React Navigation).
 * Insets via env(safe-area-inset-*) pour encoche / Dynamic Island.
 */
export function AddFoodScreen({
  searchQuery,
  onSearchQueryChange,
  searchLoading,
  searchError,
  searchHits,
  onSelectHit,
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
}: AddFoodScreenProps) {
  const [manualOpen, setManualOpen] = useState(false)

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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-title"
      className="fixed inset-0 z-[90] flex h-[100dvh] w-screen flex-col bg-[#0C0C0E]"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-3">
        <h1 id="add-food-title" className="min-w-0 flex-1 text-[20px] font-bold tracking-tight text-white">
          Ajouter un aliment
        </h1>
        <button
          type="button"
          onClick={onClose}
          className="ios-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#EBEBF5]"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
      </header>

      <div className="flex shrink-0 flex-col gap-3 px-4 pb-3">
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
            placeholder="Rechercher un aliment, une marque..."
            className="w-full rounded-2xl border border-white/10 bg-[#1C1C1E] py-3.5 pl-10 pr-3.5 text-[15px] text-white placeholder:text-[#636366] outline-none focus:border-[#FF2B2B]/45"
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
            className="ios-press flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#30D158]/40 bg-[#30D158]/15 px-3 py-3.5 text-[13px] font-semibold text-[#30D158]"
          >
            <ScanBarcode className="h-4 w-4 shrink-0" aria-hidden />
            Scan Code-Barre
          </button>
          <MealPhotoAnalyzer
            variant="button"
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

      <div className="relative mx-4 mb-3 flex min-h-0 flex-1 flex-col">
        <FoodTextSearchResults
          query={searchQuery}
          loading={searchLoading}
          error={searchError}
          hits={searchHits}
          onSelect={onSelectHit}
          fill
        />
        {scannerSlot ? (
          <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain">
            {scannerSlot}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/8 px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="ios-press w-full py-2 text-left text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]"
          aria-expanded={manualOpen}
        >
          {manualOpen ? 'Masquer la saisie manuelle' : 'Ou saisie manuelle'}
        </button>

        {manualOpen ? (
          <form onSubmit={onSubmitManual} className="mt-2 max-h-[42vh] space-y-3 overflow-y-auto overscroll-contain">
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
                className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#34C759]/40"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Calories</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5000}
                  value={calories}
                  onChange={(e) => onCaloriesChange(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#FF9F0A]/40"
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
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF9F0A]/40"
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
                  onChange={(e) => onFatChange(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Optionnel"
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#00B4FF]/40"
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
    </div>,
    document.body,
  )
}
