import { Plus } from 'lucide-react'
import type { MealEntry, MealType } from '../../types/nutrition'

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const MEAL_ROW_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
}

interface NutritionDayMealsCardProps {
  meals: MealEntry[]
  onAddMeal: (mealType: MealType) => void
}

export function NutritionDayMealsCard({ meals, onAddMeal }: NutritionDayMealsCardProps) {
  const kcalByType = MEAL_ORDER.reduce(
    (acc, type) => {
      acc[type] = meals
        .filter((meal) => meal.mealType === type)
        .reduce((sum, meal) => sum + meal.calories, 0)
      return acc
    },
    {} as Record<MealType, number>,
  )

  return (
    <section aria-label="Repas du jour">
      <h2 className="mb-3 text-[20px] font-bold tracking-tight text-white">Repas du jour</h2>
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]">
        <ul>
          {MEAL_ORDER.map((type, index) => {
            const kcal = kcalByType[type]
            return (
              <li key={type}>
                {index > 0 ? <div className="mx-4 h-px bg-white/[0.06]" /> : null}
                <div className="flex min-h-11 items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 text-[15px] font-medium text-white">
                    {MEAL_ROW_LABELS[type]}
                  </span>
                  <span className="shrink-0 text-[14px] tabular-nums text-[#8E8E93]">
                    {Math.round(kcal).toLocaleString('fr-FR')} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddMeal(type)}
                    className="ios-press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#FF2B2B]"
                    aria-label={`Ajouter un aliment · ${MEAL_ROW_LABELS[type]}`}
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
