import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ScanBarcode, Search, WifiOff, X } from 'lucide-react'
import type { MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import type { OpenFoodFactsSearchHit } from '../../services/alimentsService'
import {
  FOOD_CATEGORIES,
  hitMatchesFoodCategory,
  type FoodCategoryId,
} from '../../utils/foodCategories'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { PHOTO_IA_ESTIMATE_LABEL } from '../../services/nutritionSafetyRules'
import {
  foodAddQuantityUserMessage,
  formatGramsCountLabel,
  formatPiecesCountLabel,
  resolveUnitGramsForPieces,
  validateFoodQuantity,
  type FoodQuantityUnit,
} from '../../../convex/lib/foodAddQuantity'
import {
  MAX_MEAL_PHOTO_KCAL,
  MEAL_KCAL_ABOVE_MAX_MSG,
  scaleMealPhotoMacrosForEditedKcal,
  validateMealPhotoConfirmCalories,
} from '../../../convex/lib/mealPhotoEstimateAccess'

export { MEAL_KCAL_ABOVE_MAX_MSG }
import { FoodCategoryWheel } from './FoodCategoryWheel'
import { FoodProductCard } from './FoodProductCard'
import { FoodSelectionBar } from './FoodSelectionBar'
import { MealPhotoAnalyzer } from './MealPhotoAnalyzer'

export { PHOTO_IA_ESTIMATE_LABEL }

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export type FoodAddV3QuantityUnit = FoodQuantityUnit

/** Sélection validée V3 — name + quantité (jamais de kcal dans l’UI). */
export type FoodAddV3Selection = {
  hit: OpenFoodFactsSearchHit
  /** mealId créé une fois à l’ouverture de l’étape quantité (PC-07). */
  mealId: string
  /** Id stable pour retries / selectedCount (PC-09). */
  selectionEventId: string
  grams?: number
  pieces?: number
  unit: FoodAddV3QuantityUnit
  portionLabel?: string
}

/** Texte hors ligne V3 — à faire relire par le Vérificateur. */
export const FOOD_ADD_V3_OFFLINE_REQUIRED_MSG =
  'Connexion requise pour ajouter un aliment.' as const

type QtyState = { unit: FoodAddV3QuantityUnit; value: number | '' }

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
  /** Ajoute les aliments choisis après saisie de quantité. */
  onValidateSelection: (items: FoodAddV3Selection[]) => void
  /** Scan code-barres (maquette V3 — pastille rouge + icône). */
  onOpenScanner?: () => void
  scannerSlot?: ReactNode
  onToast?: (message: string, variant?: 'success' | 'error') => void
  /**
   * V3-05 — appelée seulement après confirmation utilisateur de l’estimation IA
   * (jamais automatiquement à la fin de l’analyse).
   */
  onPhotoAnalyzed?: (result: {
    name: string
    mealType: MealType
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }) => void
  /**
   * V3-05 — true uniquement pour adultes ≥18 hors grossesse / allaitement
   * (`canUseMealPhotoEstimate`). Sinon Photo IA ouvre seulement la recherche.
   */
  photoEstimateAllowed?: boolean
  name: string
  onNameChange: (value: string) => void
  calories?: number
  onCaloriesChange?: (value: number) => void
  proteinG?: number | ''
  onProteinChange?: (value: number | '') => void
  carbsG?: number | ''
  onCarbsChange?: (value: number | '') => void
  fatG?: number | ''
  onFatChange?: (value: number | '') => void
  mealType: MealType
  onMealTypeChange: (type: MealType) => void
  onSubmitManual: (event: FormEvent) => void
  onClose: () => void
  /** Tests : force icônes neutres. */
  forceOfflineImages?: boolean
  /** Quantité manuelle (grammes) — parent. */
  manualGrams?: number | ''
  onManualGramsChange?: (value: number | '') => void
}

type PhotoIaPending = {
  name: string
  mealType: MealType
  /** Baseline IA — macros scalées depuis ces valeurs (V3-09). */
  baseCalories: number
  baseProteinG: number
  baseCarbsG: number
  baseFatG: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

/**
 * Plein écran « Ajouter un aliment » v3 (maquette) :
 * recherche + Scan / Photo IA + roue ARC + cartes photo.
 * Photo IA (adultes) : estimation éditable, confirmée par l’utilisateur.
 */
export function AddFoodScreenV3({
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
  photoEstimateAllowed = false,
  name,
  onNameChange,
  mealType,
  onMealTypeChange,
  onSubmitManual,
  onClose,
  forceOfflineImages = false,
  manualGrams = '',
  onManualGramsChange,
}: AddFoodScreenProps) {
  const [manualOpen, setManualOpen] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [quantityStep, setQuantityStep] = useState(false)
  const [qtyByKey, setQtyByKey] = useState<Record<string, QtyState>>({})
  const [qtyError, setQtyError] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  /** mealId + selectionEventId figés à l’ouverture de l’étape quantité. */
  const [addIdsByKey, setAddIdsByKey] = useState<
    Record<string, { mealId: string; selectionEventId: string }>
  >({})
  const [submitting, setSubmitting] = useState(false)
  /** B3-05 : verrou synchrone (useState seul laisse passer 2 clics même tick). */
  const submittingRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  /** V3-05 — estimation Photo IA en attente de confirmation (pas d’ajout auto). */
  const [photoPending, setPhotoPending] = useState<PhotoIaPending | null>(null)
  const online = useOnlineStatus()
  // forceOfflineImages simule aussi le hors-ligne (tests empty / fixture).
  // Les tests quantité / e2e ne passent PAS forceOfflineImages.
  const networkOk = online && !forceOfflineImages
  const searchActive = searchQuery.trim().length > 0

  const filteredHits = useMemo(() => {
    if (category === 'all') return searchHits
    return searchHits.filter((hit) => hitMatchesFoodCategory(category, hit.categoriesTags))
  }, [searchHits, category])

  const selectedHits = useMemo(() => {
    const map = new Map(filteredHits.map((h) => [hitKey(h), h] as const))
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
      if (event.key === 'Escape') {
        if (photoPending) {
          setPhotoPending(null)
          return
        }
        if (quantityStep) {
          setQuantityStep(false)
          return
        }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, quantityStep, photoPending])

  const focusSearchField = () => {
    searchInputRef.current?.focus()
  }

  const confirmPhotoEstimate = () => {
    if (!photoPending || !onPhotoAnalyzed) return
    // V3-08 — même plafond 5000 kcal (UI + serveur).
    const checked = validateMealPhotoConfirmCalories(photoPending.calories)
    if (!checked.ok) return
    onPhotoAnalyzed({
      name: photoPending.name,
      mealType: photoPending.mealType,
      calories: checked.calories,
      proteinG: photoPending.proteinG,
      carbsG: photoPending.carbsG,
      fatG: photoPending.fatG,
    })
    setPhotoPending(null)
  }

  const updatePhotoEstimateCalories = (raw: number) => {
    setPhotoPending((prev) => {
      if (!prev) return prev
      const scaled = scaleMealPhotoMacrosForEditedKcal({
        baseCalories: prev.baseCalories,
        baseProteinG: prev.baseProteinG,
        baseCarbsG: prev.baseCarbsG,
        baseFatG: prev.baseFatG,
        nextCalories: raw,
      })
      return { ...prev, ...scaled }
    })
  }

  const toggleHit = (hit: OpenFoodFactsSearchHit) => {
    const key = hitKey(hit)
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const openQuantityStep = () => {
    if (selectedHits.length === 0) return
    if (!networkOk) return
    const next: Record<string, QtyState> = {}
    const ids: Record<string, { mealId: string; selectionEventId: string }> = {}
    for (const hit of selectedHits) {
      const key = hitKey(hit)
      next[key] = { unit: 'g', value: '' }
      // PC-07 / PC-09 : ids créés une seule fois à l’ouverture (pas à chaque Valider).
      ids[key] = {
        mealId: crypto.randomUUID(),
        selectionEventId: crypto.randomUUID(),
      }
    }
    setQtyByKey(next)
    setAddIdsByKey(ids)
    setQtyError(null)
    submittingRef.current = false
    setSubmitting(false)
    setQuantityStep(true)
  }

  const servingGramsFor = (hit: OpenFoodFactsSearchHit) =>
    resolveUnitGramsForPieces(hit.servingSize)

  const qtyMessageFor = (hit: OpenFoodFactsSearchHit, qty: QtyState): string | null => {
    // Champ vide : Valider grisé, aucun message (jamais 0) — B111-10.
    if (qty.value === '') return null
    const checked = validateFoodQuantity({
      unit: qty.unit,
      value: qty.value,
      servingGrams: qty.unit === 'pieces' ? servingGramsFor(hit) : null,
    })
    if (checked.ok) return null
    return foodAddQuantityUserMessage(checked.reason, checked.unit)
  }

  const allQuantitiesValid = selectedHits.every((hit) => {
    const qty = qtyByKey[hitKey(hit)]
    if (!qty || qty.value === '') return false
    return validateFoodQuantity({
      unit: qty.unit,
      value: qty.value,
      servingGrams: qty.unit === 'pieces' ? servingGramsFor(hit) : null,
    }).ok
  })

  const confirmQuantities = () => {
    if (!networkOk || submitting || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    const items: FoodAddV3Selection[] = []
    for (const hit of selectedHits) {
      const key = hitKey(hit)
      const qty = qtyByKey[key] ?? { unit: 'g' as const, value: '' as const }
      const ids = addIdsByKey[key]
      if (!ids) {
        setQtyError(FOOD_ADD_V3_OFFLINE_REQUIRED_MSG)
        submittingRef.current = false
        setSubmitting(false)
        return
      }
      const checked = validateFoodQuantity({
        unit: qty.unit,
        value: qty.value,
        servingGrams: qty.unit === 'pieces' ? servingGramsFor(hit) : null,
      })
      if (!checked.ok) {
        setQtyError(foodAddQuantityUserMessage(checked.reason, checked.unit))
        submittingRef.current = false
        setSubmitting(false)
        return
      }
      if (checked.unit === 'pieces') {
        const n = checked.pieces
        items.push({
          hit,
          mealId: ids.mealId,
          selectionEventId: ids.selectionEventId,
          pieces: n,
          unit: 'pieces',
          portionLabel: formatPiecesCountLabel(n),
        })
      } else {
        items.push({
          hit,
          mealId: ids.mealId,
          selectionEventId: ids.selectionEventId,
          grams: checked.grams,
          unit: 'g',
          portionLabel: formatGramsCountLabel(checked.grams),
        })
      }
    }
    setQtyError(null)
    onValidateSelection(items)
    setSelectedKeys([])
    setQuantityStep(false)
    setQtyByKey({})
    setAddIdsByKey({})
    // Ref reste true jusqu’à une nouvelle ouverture d’étape quantité (B3-05).
    setSubmitting(false)
  }

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    if (manualGrams === '') {
      setManualError(foodAddQuantityUserMessage('below_min'))
      return
    }
    const checked = validateFoodQuantity({ unit: 'g', value: manualGrams })
    if (!checked.ok) {
      setManualError(foodAddQuantityUserMessage(checked.reason, checked.unit))
      return
    }
    setManualError(null)
    onSubmitManual(event)
  }

  const manualSubmitEnabled =
    name.trim().length > 0 &&
    manualGrams !== '' &&
    validateFoodQuantity({ unit: 'g', value: manualGrams }).ok

  const idleBrowse = !searchActive && filteredHits.length === 0 && !searchLoading
  const categoryLabel = FOOD_CATEGORIES.find((c) => c.id === category)?.label ?? 'Tout'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-title"
      data-add-food-screen
      data-food-add-v3-court="true"
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
          {/* V3-06 : loupe au-dessus du champ (z-index), jamais sous le fond. */}
          <Search
            data-food-search-loupe
            className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8E8E93]"
            strokeWidth={2.25}
            aria-hidden
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Rechercher un aliment, une marque…"
            className="relative z-0 w-full rounded-2xl border border-white/12 bg-white/[0.06] py-3.5 pl-10 pr-3.5 text-[15px] text-white placeholder:text-[#636366] outline-none focus:border-[#FF2B2B]/45 [-webkit-appearance:none] [appearance:none]"
            style={{
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
            autoComplete="off"
            autoFocus
            role="searchbox"
            aria-label="Rechercher un aliment Open Food Facts"
          />
        </label>

        <div className="flex gap-2" data-food-scan-actions>
          <button
            type="button"
            data-food-scan-barcode
            onClick={() => onOpenScanner?.()}
            disabled={!onOpenScanner}
            aria-disabled={!onOpenScanner}
            className="ios-press flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
                onOpenScanner ? 'bg-[#FF2B2B]' : 'bg-[#48484A]'
              }`}
            >
              <ScanBarcode className="h-4 w-4" aria-hidden />
            </span>
            Scan Code-Barre
          </button>
          {/*
            V3-05 : adultes → MealPhotoAnalyzer + confirmation ;
            mineur / âge inconnu / grossesse / allaitement → focus recherche seulement.
          */}
          {photoEstimateAllowed ? (
            <div data-food-scan-photo className="min-w-0 flex-1">
              <MealPhotoAnalyzer
                variant="button"
                deferAddToast
                buttonClassName="ios-press flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[13px] font-semibold text-white disabled:opacity-50"
                iconSlot={
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF2B2B] text-white">
                    <Camera className="h-4 w-4" aria-hidden />
                  </span>
                }
                onToast={onToast}
                onAnalyzed={(result) => {
                  // Jamais d’ajout auto : estimation éditable, confirmée ensuite.
                  const calories = result.calories
                  const proteinG = result.proteines
                  const carbsG = result.glucides
                  const fatG = result.lipides
                  setPhotoPending({
                    name: result.name,
                    mealType: result.mealType,
                    baseCalories: calories,
                    baseProteinG: proteinG,
                    baseCarbsG: carbsG,
                    baseFatG: fatG,
                    calories,
                    proteinG,
                    carbsG,
                    fatG,
                  })
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              data-food-scan-photo
              data-food-photo-search-only
              onClick={focusSearchField}
              className="ios-press flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[13px] font-semibold text-white"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF2B2B] text-white">
                <Camera className="h-4 w-4" aria-hidden />
              </span>
              Photo IA
            </button>
          )}
        </div>

        {scannerSlot}

        {!networkOk ? (
          <p
            data-food-offline-banner
            className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12px] text-[#AEAEB2]"
            role="status"
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {FOOD_ADD_V3_OFFLINE_REQUIRED_MSG}
          </p>
        ) : null}
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
            <p
              className="py-8 text-center text-[13px] text-[#8E8E93]"
              data-food-empty-state
              role="status"
            >
              {!online || forceOfflineImages
                ? 'Pas de connexion. Réessaie quand tu as du réseau.'
                : 'Aucun produit trouvé.'}
            </p>
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
              className="grid grid-cols-2 gap-x-3 gap-y-3.5 pt-2"
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

          <footer
            className="mt-8 space-y-1.5 pb-4 text-center"
            data-off-licence
            aria-label="Licence Open Food Facts"
          >
            <p className="text-[12px] leading-snug text-[#AEAEB2]">
              Données Open Food Facts · licence ODbL
            </p>
            <p className="text-[12px] leading-snug text-[#8E8E93]">
              Photos : contributeurs Open Food Facts · CC BY-SA 3.0
            </p>
          </footer>

          {!searchActive ? (
            <div className="border-t border-white/8 pb-4 pt-2">
              <button
                type="button"
                data-manual-toggle
                onClick={() => setManualOpen((v) => !v)}
                className="ios-press w-full py-2 text-left text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]"
                aria-expanded={manualOpen}
              >
                {manualOpen ? 'Masquer la saisie manuelle' : 'Ou saisie manuelle'}
              </button>

              {manualOpen ? (
                <form
                  onSubmit={handleManualSubmit}
                  className="mt-2 max-h-[42vh] space-y-3 overflow-y-auto overscroll-contain"
                  data-manual-form
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
                      data-testid="food-add-manual-name"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                      Quantité (g)
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={2000}
                      step={1}
                      value={manualGrams}
                      onChange={(e) => {
                        const next = e.target.value === '' ? '' : Number(e.target.value)
                        onManualGramsChange?.(next)
                        if (next === '') {
                          setManualError(null)
                          return
                        }
                        const checked = validateFoodQuantity({ unit: 'g', value: next })
                        setManualError(
                          checked.ok
                            ? null
                            : foodAddQuantityUserMessage(checked.reason, checked.unit),
                        )
                      }}
                      placeholder="ex. 120"
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/40"
                      data-testid="food-add-manual-grams"
                    />
                  </label>
                  {manualError ? (
                    <p className="text-[12px] text-[#FF6961]" role="alert" data-food-qty-error>
                      {manualError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={!manualSubmitEnabled}
                    className="btn-brand w-full rounded-xl border border-white/15 py-3 text-[15px] font-semibold text-white disabled:opacity-40"
                    data-testid="food-add-manual-submit"
                  >
                    Enregistrer
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>

        {photoPending ? (
          <div
            className="absolute inset-0 z-50 flex flex-col justify-end bg-black/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3"
            data-photo-ia-estimate
            role="dialog"
            aria-label="Estimation Photo IA"
          >
            <div className="rounded-3xl border border-white/12 bg-[#141416] p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold text-white">{photoPending.name}</p>
                  <p
                    className="mt-1 text-[12px] font-medium text-[#AEAEB2]"
                    data-photo-ia-estimate-label
                  >
                    {PHOTO_IA_ESTIMATE_LABEL}
                  </p>
                </div>
                <button
                  type="button"
                  className="ios-press shrink-0 text-[13px] font-semibold text-[#8E8E93]"
                  onClick={() => setPhotoPending(null)}
                >
                  Annuler
                </button>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                  Calories (kcal)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_MEAL_PHOTO_KCAL}
                  step={1}
                  value={photoPending.calories}
                  onChange={(e) => {
                    const next = e.target.value === '' ? 0 : Number(e.target.value)
                    updatePhotoEstimateCalories(Number.isFinite(next) ? next : 0)
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#FF2B2B]/40"
                  data-photo-ia-kcal
                  aria-label="Calories estimées, modifiables"
                  aria-invalid={
                    !validateMealPhotoConfirmCalories(photoPending.calories).ok || undefined
                  }
                />
              </label>
              {!validateMealPhotoConfirmCalories(photoPending.calories).ok &&
              photoPending.calories > MAX_MEAL_PHOTO_KCAL ? (
                <p
                  className="mt-1.5 text-[12px] text-[#FF6961]"
                  role="alert"
                  data-photo-ia-kcal-error
                >
                  {MEAL_KCAL_ABOVE_MAX_MSG}
                </p>
              ) : null}
              <button
                type="button"
                data-photo-ia-confirm
                onClick={confirmPhotoEstimate}
                disabled={!validateMealPhotoConfirmCalories(photoPending.calories).ok}
                className="btn-brand mt-4 w-full rounded-xl border border-white/15 py-3 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                Confirmer l’ajout
              </button>
            </div>
          </div>
        ) : null}

        {quantityStep ? (
          <div
            className="absolute inset-0 z-40 flex flex-col bg-[#0C0C0E]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3"
            data-food-quantity-step
            role="dialog"
            aria-label="Choisir la quantité"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold text-white">Quantité</h2>
              <button
                type="button"
                className="ios-press text-[13px] font-semibold text-[#8E8E93]"
                onClick={() => setQuantityStep(false)}
              >
                Retour
              </button>
            </div>
            <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {selectedHits.map((hit) => {
                const key = hitKey(hit)
                const qty = qtyByKey[key] ?? { unit: 'g' as const, value: '' as const }
                return (
                  <li
                    key={key}
                    className="rounded-2xl border border-white/10 bg-black/30 p-3"
                    data-food-quantity-row
                  >
                    <p className="truncate text-[14px] font-semibold text-white">{hit.nom}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                          qty.unit === 'g'
                            ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-white'
                            : 'border-white/10 text-[#8E8E93]'
                        }`}
                        onClick={() => {
                          setQtyError(null)
                          setQtyByKey((prev) => ({
                            ...prev,
                            [key]: { unit: 'g', value: '' },
                          }))
                        }}
                      >
                        Grammes
                      </button>
                      <button
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                          qty.unit === 'pieces'
                            ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-white'
                            : 'border-white/10 text-[#8E8E93]'
                        }`}
                        onClick={() => {
                          setQtyError(null)
                          setQtyByKey((prev) => ({
                            ...prev,
                            [key]: { unit: 'pieces', value: '' },
                          }))
                        }}
                      >
                        Pièces
                      </button>
                    </div>
                    <label className="mt-2 block">
                      <span className="sr-only">
                        {qty.unit === 'pieces' ? 'Nombre de pièces' : 'Grammes'}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={qty.unit === 'pieces' ? 0.5 : 1}
                        max={qty.unit === 'pieces' ? 50 : 2000}
                        step={qty.unit === 'pieces' ? 0.5 : 1}
                        value={qty.value}
                        onChange={(e) => {
                          const raw = e.target.value
                          setQtyByKey((prev) => ({
                            ...prev,
                            [key]: {
                              unit: qty.unit,
                              value: raw === '' ? '' : Number(raw),
                            },
                          }))
                          setQtyError(null)
                        }}
                        className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#FF2B2B]/40"
                        data-testid={`food-qty-input-${key}`}
                      />
                    </label>
                    {qtyMessageFor(hit, qty) ? (
                      <p
                        className="mt-1.5 text-[12px] text-[#FF6961]"
                        role="alert"
                        data-food-qty-error
                      >
                        {qtyMessageFor(hit, qty)}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {qtyError ? (
              <p className="mt-2 text-[12px] text-[#FF6961]" role="alert" data-food-qty-error>
                {qtyError}
              </p>
            ) : null}
            {!networkOk ? (
              <p
                className="mt-2 text-[12px] text-[#FF6961]"
                role="alert"
                data-food-offline-required
              >
                {FOOD_ADD_V3_OFFLINE_REQUIRED_MSG}
              </p>
            ) : null}
            <button
              type="button"
              onClick={confirmQuantities}
              disabled={!allQuantitiesValid || !networkOk || submitting}
              className="btn-brand mt-3 w-full rounded-xl border border-white/15 py-3 text-[15px] font-semibold text-white disabled:opacity-40"
              data-testid="food-quantity-confirm"
            >
              Valider
            </button>
          </div>
        ) : null}

        <FoodSelectionBar
          selected={selectedHits}
          onValidate={openQuantityStep}
          forceOfflineImages={forceOfflineImages}
          disabled={!networkOk}
        />
      </div>
    </div>,
    document.body,
  )
}
