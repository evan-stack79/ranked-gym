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
  remainingMealBudget,
  scaleNutrition,
  suggestedGramsForScan,
} from '../../utils/portionGuide'
import type { PortionMode } from '../../utils/morphology'
import { MORPHOLOGY_LABELS } from '../../utils/morphology'
import type { OpenFoodFactsProduct } from '../../services/alimentsService'
import { IosSheet } from '../ui/IosSheet'
import { ClearableNumberInput } from './ClearableNumberInput'

interface ScannedProductSheetProps {
  open: boolean
  product: OpenFoodFactsProduct | null
  targetCalories: number
  morphology: BodyMorphology
  meals: Array<{ mealType: MealType; calories: number }>
  onClose: () => void
  onSave: (entry: {
    name: string
    mealType: MealType
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
    grams: number
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
  onClose,
  onSave,
}: ScannedProductSheetProps) {
  const [mealType, setMealType] = useState<MealType>(guessMealType)
  const [mode, setMode] = useState<PortionMode>('with_sides')
  const [grams, setGrams] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !product) return
    setMealType(guessMealType())
    setMode('with_sides')
    setGrams(null)
  }, [open, product])

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
        {/* 1. Meal */}
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

        {/* 2. Solo vs sides */}
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
                Uniquement ça
              </p>
              <p className="mt-1 text-[12px] text-[#AEAEB2]">
                Ce produit couvre presque tout le repas ({remaining} kcal restantes).
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
                On laisse de la place pour accompagner (protéines, veggies…) — plus simple à
                digérer, surtout en {MORPHOLOGY_LABELS[morphology].toLowerCase()}.
              </p>
            </button>
          </div>
        </div>

        {/* 3. Scale grams */}
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
                  ? `Pour atteindre ~${remaining} kcal avec uniquement ce produit.`
                  : `Portion adaptée pour laisser de la place au reste du repas.`}
                {isCalorieDense(product.calories) && mode === 'with_sides'
                  ? ' Aliment dense : une petite part + accompagnement, c’est top.'
                  : ''}
              </p>
            </button>
          )}

          {nutrition && (
            <p className="mt-2 text-center text-[13px] text-[#8E8E93]">
              ≈ <span className="font-semibold text-white">{nutrition.calories} kcal</span>
              {' · '}
              P {nutrition.proteines}g · G {nutrition.glucides}g · L {nutrition.lipides}g
            </p>
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
