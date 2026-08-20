import { useEffect, useMemo, useState } from 'react'
import {
  Coffee,
  Cookie,
  Hash,
  Moon,
  Scale,
  Sun,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react'
import type { BodyMorphology, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import {
  formatGrams,
  isCalorieDense,
  mealCalorieBudget,
  mealCalorieRange,
  remainingMealBudget,
  scaleNutrition,
  suggestedGramsForScan,
  usedMealCalories,
} from '../../utils/portionGuide'
import type { PortionMode } from '../../utils/morphology'
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

type MeasureMode = 'scale' | 'pieces'

interface ScannedProductSheetProps {
  open: boolean
  product: OpenFoodFactsProduct | null
  targetCalories: number
  morphology: BodyMorphology
  meals: Array<{ mealType: MealType; calories: number; name?: string }>
  preferredMealType?: MealType | null
  onClose: () => void
  onSave: (entry: {
    name: string
    mealType: MealType
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
    grams: number
    pieces?: number
    portionMode: PortionMode
  }) => void
}

const MEAL_OPTIONS: Array<{ type: MealType; icon: typeof Coffee }> = [
  { type: 'breakfast', icon: Coffee },
  { type: 'lunch', icon: Sun },
  { type: 'dinner', icon: Moon },
  { type: 'snack', icon: Cookie },
]

function guessMealType(): MealType {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 18) return 'snack'
  return 'dinner'
}

export function ScannedProductSheet({
  open,
  product,
  targetCalories,
  morphology,
  meals,
  preferredMealType,
  onClose,
  onSave,
}: ScannedProductSheetProps) {
  const [mealType, setMealType] = useState<MealType>(guessMealType)
  const [mode, setMode] = useState<PortionMode>('with_sides')
  const [measure, setMeasure] = useState<MeasureMode>('scale')
  const [grams, setGrams] = useState<number | null>(null)

  const [pieceMode, setPieceMode] = useState<PieceInputMode>('pack')
  const [packGrams, setPackGrams] = useState<number | null>(null)
  const [packPieces, setPackPieces] = useState<number | null>(null)
  const [eatenPieces, setEatenPieces] = useState<number | null>(null)

  const pieceKind = useMemo(
    () => (product ? detectPieceKind(product.nom) : 'generic'),
    [product],
  )

  const foodsAlready = useMemo(
    () => meals.filter((m) => m.mealType === mealType),
    [meals, mealType],
  )
  const isFollowUp = foodsAlready.length > 0

  useEffect(() => {
    if (!open || !product) return
    const nextMeal = preferredMealType ?? guessMealType()
    setMealType(nextMeal)
    const already = meals.filter((m) => m.mealType === nextMeal).length
    setMode(already > 0 ? 'solo' : 'with_sides')
    setGrams(null)
    setEatenPieces(null)
    const kind = detectPieceKind(product.nom)
    const preset = loadPackPreset(product.barcode)
    // Auto-open piece counter for nuggets / boulettes / etc.
    setMeasure(kind !== 'generic' || preset ? 'pieces' : 'scale')
    setPieceMode(preset ? 'pack' : kind !== 'generic' ? 'typical' : 'pack')
    if (preset) {
      setPackGrams(preset.packGrams)
      setPackPieces(preset.packPieces)
    } else {
      setPackGrams(null)
      setPackPieces(null)
    }
  }, [open, product, preferredMealType, meals])

  const computedPieceGrams = useMemo(() => {
    if (eatenPieces == null || eatenPieces <= 0) return null
    if (pieceMode === 'pack') {
      if (packGrams == null || packPieces == null) return null
      return gramsFromPack({
        packGrams,
        packPieces,
        eatenPieces,
      })
    }
    return gramsFromTypical(pieceKind, eatenPieces)
  }, [pieceMode, packGrams, packPieces, eatenPieces, pieceKind])

  const effectiveGrams = measure === 'scale' ? grams : computedPieceGrams

  const budget = useMemo(
    () => mealCalorieBudget(targetCalories, mealType, morphology),
    [targetCalories, mealType, morphology],
  )
  const range = useMemo(() => mealCalorieRange(budget), [budget])
  const used = useMemo(() => usedMealCalories(mealType, meals), [mealType, meals])
  const remaining = useMemo(
    () => remainingMealBudget(targetCalories, mealType, meals, morphology),
    [targetCalories, mealType, meals, morphology],
  )

  const suggested = useMemo(() => {
    if (!product) return null
    return suggestedGramsForScan({
      kcalPer100g: product.calories,
      remainingKcal: remaining,
      mode,
      morphology,
    })
  }, [product, remaining, mode, morphology])

  const nutrition = useMemo(() => {
    if (!product || effectiveGrams == null || effectiveGrams <= 0) return null
    return scaleNutrition(
      {
        calories: product.calories,
        proteines: product.proteines,
        glucides: product.glucides,
        lipides: product.lipides,
      },
      effectiveGrams,
    )
  }, [product, effectiveGrams])

  const afterAddRemaining = nutrition
    ? Math.max(0, remaining - nutrition.calories)
    : remaining

  const gramsPerPiece =
    pieceMode === 'pack' && packGrams != null && packPieces != null && packPieces > 0
      ? Math.round((packGrams / packPieces) * 10) / 10
      : TYPICAL_GRAMS_PER_PIECE[pieceKind]

  if (!product) return null

  const canSave =
    effectiveGrams != null &&
    effectiveGrams > 0 &&
    nutrition != null &&
    nutrition.calories > 0

  const handleSave = () => {
    if (!canSave || effectiveGrams == null || nutrition == null) return
    if (
      measure === 'pieces' &&
      pieceMode === 'pack' &&
      packGrams != null &&
      packPieces != null
    ) {
      savePackPreset(product.barcode, { packGrams, packPieces })
    }
    onSave({
      name: product.nom,
      mealType,
      calories: Math.max(1, nutrition.calories),
      proteinG: nutrition.proteines,
      carbsG: nutrition.glucides,
      fatG: nutrition.lipides,
      grams: effectiveGrams,
      pieces:
        measure === 'pieces' && eatenPieces != null && eatenPieces > 0
          ? eatenPieces
          : undefined,
      portionMode: mode,
    })
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={product.nom}
      subtitle={`Open Food Facts · ${product.calories} kcal / 100 g`}
      leading={<UtensilsCrossed className="mt-0.5 h-5 w-5 text-[#30D158]" />}
    >
      <div className="space-y-5 pb-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3">
          <p className="text-[12px] font-semibold text-white">
            {MEAL_TYPE_LABELS[mealType]} · vise {range.min}–{range.max} kcal
          </p>
          <p className="mt-1 text-[12px] text-[#AEAEB2]">
            Déjà noté : <span className="font-semibold text-white">{used} kcal</span>
            {' · '}
            Il reste{' '}
            <span className="font-semibold text-[#30D158]">{remaining} kcal</span> pour un bon
            repas.
          </p>
          {isFollowUp && (
            <p className="mt-1 text-[11px] text-[#8E8E93]">
              Avec : {foodsAlready.map((f) => f.name ?? 'aliment').join(', ')}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-white">1. Pour quel repas ?</p>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_OPTIONS.map(({ type, icon: Icon }) => {
              const active = mealType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  className={`ios-press flex items-center gap-2 rounded-2xl border px-3 py-3 text-left ${
                    active
                      ? 'border-[#30D158]/45 bg-[#30D158]/15 text-white'
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

        <div>
          <p className="mb-2 text-[13px] font-semibold text-white">2. Tu manges comment ?</p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setMode('solo')}
              className={`ios-press rounded-2xl border px-3.5 py-3 text-left ${
                mode === 'solo'
                  ? 'border-[#00B4FF]/45 bg-[#00B4FF]/15'
                  : 'border-white/10 bg-black/25'
              }`}
            >
              <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
                <Cookie className="h-4 w-4 text-[#64D2FF]" />
                {isFollowUp ? 'Compléter le repas' : 'Uniquement ça'}
              </p>
              <p className="mt-1 text-[12px] text-[#AEAEB2]">
                {isFollowUp
                  ? `On calcule la portion pour utiliser les ~${remaining} kcal qu’il reste avec ce que tu as déjà.`
                  : `Ce produit couvre presque tout le repas (${remaining} kcal restantes).`}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('with_sides')}
              className={`ios-press rounded-2xl border px-3.5 py-3 text-left ${
                mode === 'with_sides'
                  ? 'border-[#00B4FF]/45 bg-[#00B4FF]/15'
                  : 'border-white/10 bg-black/25'
              }`}
            >
              <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
                <Utensils className="h-4 w-4 text-[#64D2FF]" />
                Avec autre chose
              </p>
              <p className="mt-1 text-[12px] text-[#AEAEB2]">
                On laisse de la place pour un 2ᵉ aliment (ex. steak puis frites).
              </p>
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-white">3. Quelle quantité ?</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMeasure('scale')}
              className={`ios-press flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[13px] font-semibold ${
                measure === 'scale'
                  ? 'border-[#FF9F0A]/45 bg-[#FF9F0A]/15 text-white'
                  : 'border-white/10 bg-black/25 text-[#8E8E93]'
              }`}
            >
              <Scale className="h-4 w-4" />
              Balance
            </button>
            <button
              type="button"
              onClick={() => setMeasure('pieces')}
              className={`ios-press flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[13px] font-semibold ${
                measure === 'pieces'
                  ? 'border-[#FF9F0A]/45 bg-[#FF9F0A]/15 text-white'
                  : 'border-white/10 bg-black/25 text-[#8E8E93]'
              }`}
            >
              <Hash className="h-4 w-4" />
              Compter
            </button>
          </div>

          {measure === 'scale' ? (
            <div className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
              <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
                <Scale className="h-3.5 w-3.5" />
                Grammes affichés
              </div>
              <div className="flex items-end gap-2">
                <ClearableNumberInput
                  value={grams}
                  onChange={setGrams}
                  min={0.01}
                  max={5000}
                  step={0.01}
                  required={false}
                  placeholder="Ex. 61,05"
                  placeholderClassName="pointer-events-none absolute inset-0 flex items-center text-[36px] font-bold tracking-tight text-[#636366]"
                  aria-label="Poids en grammes"
                  className="relative z-[1] w-full bg-transparent text-[36px] font-bold tracking-tight text-white outline-none placeholder:text-[#636366]"
                />
                <span className="pb-1 text-[15px] font-medium text-[#8E8E93]">g</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
              <p className="text-[12px] leading-snug text-[#AEAEB2]">
                Nuggets, boulettes, croquettes… tu comptes les pièces. On convertit avec le poids
                de la boîte (ou une estimation typique).
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPieceMode('pack')}
                  className={`ios-press rounded-xl border px-2.5 py-2 text-[12px] font-semibold ${
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
                  className={`ios-press rounded-xl border px-2.5 py-2 text-[12px] font-semibold ${
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
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
                      Poids boîte
                    </span>
                    <div className="mt-1 flex items-end gap-1 border-b border-white/10 pb-1">
                      <ClearableNumberInput
                        value={packGrams}
                        onChange={setPackGrams}
                        min={1}
                        max={10000}
                        step={1}
                        required={false}
                        placeholder="400"
                        aria-label="Poids de la boîte en grammes"
                        className="w-full bg-transparent text-[22px] font-bold text-white outline-none"
                      />
                      <span className="pb-0.5 text-[12px] text-[#8E8E93]">g</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
                      Pièces / boîte
                    </span>
                    <div className="mt-1 border-b border-white/10 pb-1">
                      <ClearableNumberInput
                        value={packPieces}
                        onChange={setPackPieces}
                        min={1}
                        max={500}
                        step={1}
                        required={false}
                        placeholder="20"
                        aria-label="Nombre de pièces dans la boîte"
                        className="w-full bg-transparent text-[22px] font-bold text-white outline-none"
                      />
                    </div>
                  </label>
                </div>
              ) : (
                <p className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-[12px] text-[#AEAEB2]">
                  Détecté : <span className="font-semibold text-white">{PIECE_KIND_LABELS[pieceKind]}</span>
                  {' · '}≈ {TYPICAL_GRAMS_PER_PIECE[pieceKind]} g / pièce (moyenne). Moins précis
                  que la boîte, mais utile sans emballage.
                </p>
              )}

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
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
                    placeholder="Ex. 6"
                    aria-label="Nombre de pièces mangées"
                    className="w-full bg-transparent text-[36px] font-bold tracking-tight text-white outline-none"
                  />
                  <span className="pb-1 text-[14px] text-[#8E8E93]">pièces</span>
                </div>
              </label>

              {computedPieceGrams != null && (
                <p className="text-[13px] text-[#AEAEB2]">
                  ≈ <span className="font-semibold text-white">{formatGrams(computedPieceGrams)} g</span>
                  {' '}({gramsPerPiece} g × {eatenPieces})
                </p>
              )}
            </div>
          )}

          {measure === 'scale' && suggested != null && (
            <button
              type="button"
              onClick={() => setGrams(suggested)}
              className="ios-press mt-2.5 w-full rounded-2xl border border-[#30D158]/35 bg-[#30D158]/12 px-3.5 py-3 text-left"
            >
              <p className="text-[13px] font-semibold text-[#30D158]">
                Suggestion : {formatGrams(suggested)} g
              </p>
              <p className="mt-0.5 text-[12px] text-[#AEAEB2]">
                {mode === 'solo'
                  ? isFollowUp
                    ? `Pour finir le repas avec les ~${remaining} kcal restantes — ça fait un bon combo.`
                    : `Pour atteindre ~${remaining} kcal avec uniquement ce produit.`
                  : `Portion pour laisser de la place à l’accompagnement.`}
                {isCalorieDense(product.calories) && mode === 'with_sides'
                  ? ' Aliment dense : une petite part + accompagnement, c’est top.'
                  : ''}
              </p>
            </button>
          )}

          {nutrition && (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[13px] text-[#8E8E93]">
                Cet aliment ≈{' '}
                <span className="font-semibold text-white">{nutrition.calories} kcal</span>
                {' · '}P {nutrition.proteines}g · G {nutrition.glucides}g · L {nutrition.lipides}g
              </p>
              <p className="mt-1 text-[12px] text-[#AEAEB2]">
                {afterAddRemaining > 40
                  ? `Après ça, il manquera encore ~${afterAddRemaining} kcal pour atteindre la zone du repas.`
                  : afterAddRemaining > 0
                    ? `Presque parfait — il restera ~${afterAddRemaining} kcal (optionnel).`
                    : 'Repas bien rempli — tu es dans la bonne zone.'}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ajouter au journal
        </button>
      </div>
    </IosSheet>
  )
}
