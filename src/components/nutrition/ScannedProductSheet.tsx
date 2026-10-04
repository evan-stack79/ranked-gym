import { useEffect, useMemo, useRef, useState } from 'react'
import { Coffee, Cookie, Hash, Moon, Sun, UtensilsCrossed } from 'lucide-react'
import type { BodyMorphology, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import {
  formatFrInteger,
  mealCalorieBudget,
  remainingMealBudget,
  scaleNutrition,
  suggestedGramsForScan,
} from '../../utils/portionGuide'
import {
  detectPieceKind,
  gramsFromPack,
  gramsFromTypical,
  loadPackPreset,
  PIECE_KIND_LABELS,
  savePackPreset,
  TYPICAL_GRAMS_PER_PIECE,
  type PieceInputMode,
} from '../../utils/piecePortion'
import type { OpenFoodFactsProduct } from '../../services/alimentsService'
import { IosSheet } from '../ui/IosSheet'
import { ClearableNumberInput } from './ClearableNumberInput'

const MIN_GRAMS = 1
const MAX_GRAMS = 3000
const DEFAULT_GRAMS = 100
const QUICK_GRAMS = [50, 100, 150, 200] as const

interface ScannedProductSheetProps {
  open: boolean
  product: OpenFoodFactsProduct | null
  targetCalories: number
  /** Objectifs repas affichables (drapeau ON + cible > 0 + profil éligible). */
  hasMealTargets?: boolean
  morphology: BodyMorphology
  meals: Array<{ mealType: MealType; calories: number; name?: string }>
  preferredMealType?: MealType | null
  /** Date du journal où l’ajout sera écrit (libellé déjà formaté). */
  dateLabel?: string
  onClose: () => void
  /** Ouvre la saisie manuelle préremplie (produit sans kcal). */
  onRequestManualEntry?: (product: OpenFoodFactsProduct) => void
  onSave: (entry: {
    name: string
    mealType: MealType
    calories: number
    proteinG: number | null
    carbsG: number | null
    fatG: number | null
    grams: number
    pieces?: number
  }) => void
}

const MEAL_OPTIONS: Array<{ type: MealType; icon: typeof Coffee }> = [
  { type: 'breakfast', icon: Coffee },
  { type: 'lunch', icon: Sun },
  { type: 'dinner', icon: Moon },
  { type: 'snack', icon: Cookie },
]

/** Heures locales : Collation 0–4h59 · Petit-déj 5–10h59 · Déjeuner 11–14h59 · Collation 15–17h59 · Dîner ≥ 18h. */
export function guessMealType(now = new Date()): MealType {
  const hour = now.getHours()
  if (hour < 5) return 'snack'
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'snack'
  return 'dinner'
}

function formatMacroG(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'non renseigné'
  return `${formatFrInteger(Math.round(value))} g`
}

function quantityError(grams: number | null): string | null {
  if (grams == null || !Number.isFinite(grams)) {
    return 'Entre une quantité d’au moins 1 g.'
  }
  if (grams < MIN_GRAMS) return 'Entre une quantité d’au moins 1 g.'
  if (grams > MAX_GRAMS) {
    return 'Quantité trop grande : vérifie la valeur (maximum 3 000 g).'
  }
  return null
}

export function ScannedProductSheet({
  open,
  product,
  targetCalories,
  hasMealTargets = false,
  morphology,
  meals,
  preferredMealType,
  dateLabel,
  onClose,
  onRequestManualEntry,
  onSave,
}: ScannedProductSheetProps) {
  const [mealType, setMealType] = useState<MealType>(guessMealType)
  const [grams, setGrams] = useState<number | null>(DEFAULT_GRAMS)
  const [showPieces, setShowPieces] = useState(false)
  const [pieceMode, setPieceMode] = useState<PieceInputMode>('typical')
  const [packGrams, setPackGrams] = useState<number | null>(null)
  const [packPieces, setPackPieces] = useState<number | null>(null)
  const [eatenPieces, setEatenPieces] = useState<number | null>(null)
  const [manualCalories, setManualCalories] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const initKeyRef = useRef<string | null>(null)

  const pieceKind = useMemo(
    () => (product ? detectPieceKind(product.nom) : 'generic'),
    [product],
  )
  const isPieceProduct = pieceKind !== 'generic'

  const foodsAlready = useMemo(
    () => meals.filter((m) => m.mealType === mealType),
    [meals, mealType],
  )
  const isFollowUp = foodsAlready.length > 0

  // Réinitialiser uniquement quand le produit / l’ouverture / le repas préféré changent vraiment
  // (pas quand `meals` est resynchronisé sur focus — AR-07).
  useEffect(() => {
    if (!open || !product) {
      initKeyRef.current = null
      return
    }
    const key = `${product.barcode}|${product.nom}|${preferredMealType ?? ''}`
    if (initKeyRef.current === key) return
    initKeyRef.current = key

    const nextMeal = preferredMealType ?? guessMealType()
    setMealType(nextMeal)
    setGrams(DEFAULT_GRAMS)
    setEatenPieces(null)
    setManualCalories(null)
    setSaving(false)
    setShowPieces(false)

    const kind = detectPieceKind(product.nom)
    const preset = loadPackPreset(product.barcode)
    setPieceMode(preset ? 'pack' : kind !== 'generic' ? 'typical' : 'pack')
    if (preset) {
      setPackGrams(preset.packGrams)
      setPackPieces(preset.packPieces)
    } else {
      setPackGrams(null)
      setPackPieces(null)
    }
  }, [open, product, preferredMealType])

  const computedPieceGrams = useMemo(() => {
    if (!showPieces) return null
    if (eatenPieces == null || eatenPieces <= 0) return null
    if (pieceMode === 'pack') {
      if (packGrams == null || packPieces == null) return null
      return gramsFromPack({ packGrams, packPieces, eatenPieces })
    }
    return gramsFromTypical(pieceKind, eatenPieces)
  }, [showPieces, pieceMode, packGrams, packPieces, eatenPieces, pieceKind])

  const effectiveGrams = showPieces ? computedPieceGrams : grams

  // Mode interne pour le repère ON (jamais demandé à l’utilisateur, jamais stocké).
  const internalMode = isFollowUp ? 'solo' : 'with_sides'

  const budget = useMemo(
    () => mealCalorieBudget(targetCalories, mealType, morphology),
    [targetCalories, mealType, morphology],
  )
  const used = useMemo(
    () => foodsAlready.reduce((sum, m) => sum + m.calories, 0),
    [foodsAlready],
  )
  const remaining = useMemo(
    () => remainingMealBudget(targetCalories, mealType, meals, morphology),
    [targetCalories, mealType, meals, morphology],
  )

  const suggested = useMemo(() => {
    if (!hasMealTargets || !product) return null
    const kcalPer100 =
      product.calories != null && product.calories > 0
        ? product.calories
        : null
    if (kcalPer100 == null) return null
    const raw = suggestedGramsForScan({
      kcalPer100g: kcalPer100,
      remainingKcal: remaining,
      mode: internalMode,
      morphology,
    })
    return raw == null ? null : Math.round(raw)
  }, [hasMealTargets, product, remaining, internalMode, morphology])

  const hasKnownCalories =
    product != null &&
    product.calories != null &&
    Number.isFinite(product.calories) &&
    product.calories > 0

  const caloriesMissing =
    product != null &&
    (product.calories == null ||
      !Number.isFinite(product.calories) ||
      product.calories === 0)

  const nutrition = useMemo(() => {
    if (!product || effectiveGrams == null || effectiveGrams <= 0) return null

    if (hasKnownCalories) {
      const scaled = scaleNutrition(
        {
          calories: product.calories!,
          proteines: product.proteines ?? 0,
          glucides: product.glucides ?? 0,
          lipides: product.lipides ?? 0,
        },
        effectiveGrams,
      )
      return {
        calories: scaled.calories,
        proteines: product.proteines == null ? null : Math.round(scaled.proteines),
        glucides: product.glucides == null ? null : Math.round(scaled.glucides),
        lipides: product.lipides == null ? null : Math.round(scaled.lipides),
      }
    }

    if (manualCalories != null && manualCalories >= 0 && Number.isFinite(manualCalories)) {
      return {
        calories: Math.round(manualCalories),
        proteines: null as number | null,
        glucides: null as number | null,
        lipides: null as number | null,
      }
    }

    // 0 kcal/100 g connu → 0 kcal pour la portion
    if (product.calories === 0) {
      return {
        calories: 0,
        proteines: product.proteines == null ? null : 0,
        glucides: product.glucides == null ? null : 0,
        lipides: product.lipides == null ? null : 0,
      }
    }

    return null
  }, [product, effectiveGrams, hasKnownCalories, manualCalories])

  const qtyError = quantityError(effectiveGrams)
  const canSave =
    !saving &&
    qtyError == null &&
    effectiveGrams != null &&
    nutrition != null &&
    (hasKnownCalories ||
      product?.calories === 0 ||
      (manualCalories != null && manualCalories >= 0))

  const disabledReason = !canSave
    ? qtyError ??
      (caloriesMissing && manualCalories == null && product?.calories !== 0
        ? 'Les calories de ce produit ne sont pas renseignées.'
        : 'Entre une quantité pour continuer.')
    : null

  const handleSave = () => {
    if (!canSave || !product || effectiveGrams == null || nutrition == null) return
    setSaving(true)
    if (
      showPieces &&
      pieceMode === 'pack' &&
      packGrams != null &&
      packPieces != null
    ) {
      savePackPreset(product.barcode, { packGrams, packPieces })
    }
    onSave({
      name: product.nom,
      mealType,
      calories: Math.max(0, nutrition.calories),
      proteinG: nutrition.proteines,
      carbsG: nutrition.glucides,
      fatG: nutrition.lipides,
      grams: effectiveGrams,
      pieces:
        showPieces && eatenPieces != null && eatenPieces > 0 ? eatenPieces : undefined,
    })
  }

  if (!product) return null

  const subtitle =
    product.calories == null || !Number.isFinite(product.calories)
      ? 'Calories non renseignées'
      : `${formatFrInteger(product.calories)} kcal pour 100 g`

  const footer = (
    <div className="space-y-2">
      {disabledReason ? (
        <p className="text-center text-[13px] text-[#AEAEB2]" role="status">
          {disabledReason}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!canSave}
        onClick={handleSave}
        className="ios-press w-full rounded-2xl bg-[#30D158] py-3.5 text-[16px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        Ajouter au journal
      </button>
      <p className="text-center text-[11px] text-[#636366]">Source : Open Food Facts</p>
    </div>
  )

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={product.nom}
      subtitle={subtitle}
      leading={<UtensilsCrossed className="mt-0.5 h-5 w-5 text-[#AEAEB2]" />}
      footer={footer}
    >
      <div className="space-y-5 pb-2">
        {isFollowUp ? (
          <p className="text-[13px] text-[#AEAEB2]">
            Déjà noté sur ce repas :{' '}
            <span className="font-semibold text-white">{formatFrInteger(used)} kcal</span>
            {foodsAlready.some((f) => f.name) ? (
              <>
                {' · '}
                Avec : {foodsAlready.map((f) => f.name ?? 'aliment').join(', ')}
              </>
            ) : null}
          </p>
        ) : null}

        {caloriesMissing && product.calories !== 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3">
            <p className="text-[13px] text-[#AEAEB2]">
              Les calories de ce produit ne sont pas renseignées.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {onRequestManualEntry ? (
                <button
                  type="button"
                  onClick={() => onRequestManualEntry(product)}
                  className="ios-press min-h-11 rounded-2xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 text-[14px] font-semibold text-white"
                >
                  Saisir les calories moi-même
                </button>
              ) : null}
              <label className="block min-w-0 flex-1">
                <span className="mb-1 block text-[12px] font-semibold text-[#8E8E93]">
                  Ou indique les kcal ici
                </span>
                <ClearableNumberInput
                  value={manualCalories}
                  onChange={setManualCalories}
                  min={0}
                  max={5000}
                  step={1}
                  required={false}
                  clampOnBlur={false}
                  placeholder="ex. 250"
                  aria-label="Calories pour cette quantité"
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-[16px] text-white outline-none"
                />
              </label>
            </div>
          </div>
        ) : null}

        {/* Bloc 1 — Repas */}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-white">Repas</p>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_OPTIONS.map(({ type, icon: Icon }) => {
              const active = mealType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  className={`ios-press flex min-h-12 items-center gap-2 rounded-2xl border px-3 py-3 text-left ${
                    active
                      ? 'border-white/35 bg-white/[0.12] text-white'
                      : 'border-white/10 bg-black/25 text-[#8E8E93]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-[14px] font-semibold">{MEAL_TYPE_LABELS[type]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bloc 2 — Quantité */}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-white">Quantité mangée</p>

          {!showPieces ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Moins 10 grammes"
                  onClick={() =>
                    setGrams((g) => Math.max(MIN_GRAMS, Math.round((g ?? DEFAULT_GRAMS) - 10)))
                  }
                  className="ios-press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-[18px] font-semibold text-white"
                >
                  −
                </button>
                <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-white/10 bg-[#1C1C1E] px-3 py-2">
                  <ClearableNumberInput
                    value={grams}
                    onChange={setGrams}
                    min={MIN_GRAMS}
                    max={MAX_GRAMS}
                    step={0.1}
                    required={false}
                    clampOnBlur={false}
                    sanitizeUnits
                    selectOnFocus
                    enterKeyHint="done"
                    aria-label="Quantité en grammes"
                    className="relative z-[1] w-full bg-transparent text-[28px] font-bold tracking-tight text-white outline-none"
                  />
                  <span className="pb-1 text-[15px] font-medium text-[#8E8E93]">g</span>
                </div>
                <button
                  type="button"
                  aria-label="Plus 10 grammes"
                  onClick={() =>
                    setGrams((g) => Math.min(MAX_GRAMS, Math.round((g ?? DEFAULT_GRAMS) + 10)))
                  }
                  className="ios-press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-[18px] font-semibold text-white"
                >
                  +
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {QUICK_GRAMS.map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setGrams(qty)}
                    className={`ios-press min-h-11 min-w-[4.5rem] rounded-2xl border px-3 text-[14px] font-semibold ${
                      grams === qty
                        ? 'border-white/35 bg-white/[0.12] text-white'
                        : 'border-white/10 bg-black/25 text-[#AEAEB2]'
                    }`}
                  >
                    {qty} g
                  </button>
                ))}
              </div>

              {isPieceProduct ? (
                <button
                  type="button"
                  onClick={() => setShowPieces(true)}
                  className="ios-press flex min-h-11 items-center gap-2 text-[13px] font-semibold text-[#AEAEB2] underline"
                >
                  <Hash className="h-4 w-4" />
                  Compter en pièces
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-[#AEAEB2]">
                  {PIECE_KIND_LABELS[pieceKind]} · compte les pièces
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowPieces(false)
                    setEatenPieces(null)
                  }}
                  className="ios-press min-h-11 px-2 text-[13px] font-semibold text-white underline"
                >
                  Revenir aux grammes
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPieceMode('pack')}
                  className={`ios-press min-h-11 rounded-xl border px-2.5 text-[13px] font-semibold ${
                    pieceMode === 'pack'
                      ? 'border-white/25 bg-white/12 text-white'
                      : 'border-white/8 bg-transparent text-[#8E8E93]'
                  }`}
                >
                  D’après la boîte
                </button>
                <button
                  type="button"
                  onClick={() => setPieceMode('typical')}
                  className={`ios-press min-h-11 rounded-xl border px-2.5 text-[13px] font-semibold ${
                    pieceMode === 'typical'
                      ? 'border-white/25 bg-white/12 text-white'
                      : 'border-white/8 bg-transparent text-[#8E8E93]'
                  }`}
                >
                  Estimation typique
                </button>
              </div>

              {pieceMode === 'pack' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[12px] font-semibold text-[#8E8E93]">
                      Poids de la boîte
                    </span>
                    <div className="mt-1 flex items-end gap-1 border-b border-white/10 pb-1">
                      <ClearableNumberInput
                        value={packGrams}
                        onChange={setPackGrams}
                        min={1}
                        max={10000}
                        step={1}
                        required={false}
                        clampOnBlur={false}
                        aria-label="Poids de la boîte en grammes"
                        className="w-full bg-transparent text-[22px] font-bold text-white outline-none"
                      />
                      <span className="pb-0.5 text-[12px] text-[#8E8E93]">g</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-semibold text-[#8E8E93]">
                      Pièces dans la boîte
                    </span>
                    <div className="mt-1 border-b border-white/10 pb-1">
                      <ClearableNumberInput
                        value={packPieces}
                        onChange={setPackPieces}
                        min={1}
                        max={500}
                        step={1}
                        required={false}
                        clampOnBlur={false}
                        aria-label="Nombre de pièces dans la boîte"
                        className="w-full bg-transparent text-[22px] font-bold text-white outline-none"
                      />
                    </div>
                  </label>
                </div>
              ) : (
                <p className="text-[13px] text-[#AEAEB2]">
                  ≈ {TYPICAL_GRAMS_PER_PIECE[pieceKind]} g par pièce (moyenne).
                </p>
              )}

              <label className="block">
                <span className="text-[12px] font-semibold text-[#8E8E93]">
                  Combien tu manges ?
                </span>
                <div className="mt-1 flex items-end gap-2 border-b border-white/10 pb-1">
                  <ClearableNumberInput
                    value={eatenPieces}
                    onChange={setEatenPieces}
                    min={0.5}
                    max={200}
                    step={0.5}
                    required={false}
                    clampOnBlur={false}
                    selectOnFocus
                    aria-label="Nombre de pièces mangées"
                    className="w-full bg-transparent text-[28px] font-bold tracking-tight text-white outline-none"
                  />
                  <span className="pb-1 text-[14px] text-[#8E8E93]">pièces</span>
                </div>
              </label>

              {computedPieceGrams != null ? (
                <p className="text-[13px] text-[#AEAEB2]">
                  ≈{' '}
                  <span className="font-semibold text-white">
                    {formatFrInteger(Math.round(computedPieceGrams))} g
                  </span>
                </p>
              ) : null}
            </div>
          )}

          {qtyError && effectiveGrams != null ? (
            <p className="mt-2 text-[13px] text-[#AEAEB2]" role="status">
              {qtyError}
            </p>
          ) : null}
        </div>

        {/* Bloc 3 — Résultat */}
        <div className="space-y-1.5">
          {nutrition ? (
            <>
              <p className="text-[16px] font-semibold text-white">
                ≈ {formatFrInteger(nutrition.calories)} kcal
              </p>
              <p className="text-[13px] text-[#AEAEB2]">
                Protéines {formatMacroG(nutrition.proteines)} · Glucides{' '}
                {formatMacroG(nutrition.glucides)} · Lipides {formatMacroG(nutrition.lipides)}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-[#AEAEB2]">
              Le résultat s’affiche dès qu’une quantité est saisie.
            </p>
          )}

          {hasMealTargets && nutrition ? (
            <p className="text-[13px] text-[#8E8E93]">
              Repère indicatif pour ce repas : environ {formatFrInteger(budget)} kcal. Avec cet
              aliment : {formatFrInteger(used + nutrition.calories)} kcal.
            </p>
          ) : null}

          {hasMealTargets && suggested != null && remaining > 0 && !showPieces ? (
            <button
              type="button"
              onClick={() => setGrams(suggested)}
              className="ios-press mt-1 min-h-11 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-2 text-left text-[13px] font-semibold text-[#AEAEB2]"
            >
              Portion repère : {formatFrInteger(suggested)} g
            </button>
          ) : null}

          {dateLabel ? (
            <p className="pt-1 text-[13px] text-[#8E8E93]">Ajouté à : {dateLabel}</p>
          ) : null}
        </div>
      </div>
    </IosSheet>
  )
}
