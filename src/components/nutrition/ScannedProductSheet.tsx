import { useEffect, useMemo, useState } from 'react'
import {
  Coffee,
  Cookie,
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
import type { OpenFoodFactsProduct } from '../../services/alimentsService'
import { IosSheet } from '../ui/IosSheet'
import { ClearableNumberInput } from './ClearableNumberInput'

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
  const [grams, setGrams] = useState<number | null>(null)

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
  }, [open, product, preferredMealType, meals])

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
    if (!product || grams == null || grams <= 0) return null
    return scaleNutrition(
      {
        calories: product.calories,
        proteines: product.proteines,
        glucides: product.glucides,
        lipides: product.lipides,
      },
      grams,
    )
  }, [product, grams])

  const afterAddRemaining = nutrition
    ? Math.max(0, remaining - nutrition.calories)
    : remaining

  if (!product) return null

  const canSave = grams != null && grams > 0 && nutrition != null && nutrition.calories > 0

  const handleSave = () => {
    if (!canSave || grams == null || nutrition == null) return
    onSave({
      name: product.nom,
      mealType,
      calories: Math.max(1, nutrition.calories),
      proteinG: nutrition.proteines,
      carbsG: nutrition.glucides,
      fatG: nutrition.lipides,
      grams,
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
          <p className="mb-2 text-[13px] font-semibold text-white">3. Poids sur la balance</p>
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

          {suggested != null && (
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
                  : `Portion pour laisser ~${Math.round(remaining * (1 - 0.55))} kcal à l’accompagnement.`}
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
