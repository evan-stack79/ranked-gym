import { useId, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import type { MealEntry, MealType } from '../../types/nutrition'

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const MEAL_ROW_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
}

export function formatMealPortionLabel(meal: Pick<MealEntry, 'grams' | 'pieces'>): string | null {
  if (typeof meal.pieces === 'number' && Number.isFinite(meal.pieces) && meal.pieces > 0) {
    const n = Math.round(meal.pieces)
    return n === 1 ? '1 pièce' : `${n} pièces`
  }
  if (typeof meal.grams === 'number' && Number.isFinite(meal.grams) && meal.grams > 0) {
    const g = meal.grams
    const label = Number.isInteger(g) ? String(g) : g.toFixed(1).replace(/\.0$/, '')
    return `${label} g`
  }
  return null
}

interface NutritionDayMealsCardProps {
  meals: MealEntry[]
  onAddMeal: (mealType: MealType) => void
  /** Ouvre l’édition existante (EditMealSheet). */
  onEditMeal?: (meal: MealEntry) => void
}

export function NutritionDayMealsCard({
  meals,
  onAddMeal,
  onEditMeal,
}: NutritionDayMealsCardProps) {
  const baseId = useId()
  const [openTypes, setOpenTypes] = useState<Partial<Record<MealType, boolean>>>({})

  const mealsByType = MEAL_ORDER.reduce(
    (acc, type) => {
      acc[type] = meals.filter((meal) => meal.mealType === type)
      return acc
    },
    {} as Record<MealType, MealEntry[]>,
  )

  const kcalByType = MEAL_ORDER.reduce(
    (acc, type) => {
      acc[type] = mealsByType[type].reduce((sum, meal) => sum + meal.calories, 0)
      return acc
    },
    {} as Record<MealType, number>,
  )

  const toggle = (type: MealType) => {
    setOpenTypes((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  return (
    <section aria-label="Repas du jour">
      <h2 className="mb-3 text-[20px] font-bold tracking-tight text-white">Repas du jour</h2>
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]">
        <ul>
          {MEAL_ORDER.map((type, index) => {
            const items = mealsByType[type]
            const kcal = kcalByType[type]
            const hasItems = items.length > 0
            const expanded = Boolean(openTypes[type]) && hasItems
            const panelId = `${baseId}-panel-${type}`
            const headerId = `${baseId}-header-${type}`

            return (
              <li key={type}>
                {index > 0 ? <div className="mx-4 h-px bg-white/[0.06]" /> : null}
                <div className="flex min-h-11 items-center gap-1 px-2 py-1.5 sm:px-3">
                  {hasItems ? (
                    <button
                      type="button"
                      id={headerId}
                      data-meal-toggle={type}
                      onClick={() => toggle(type)}
                      className="ios-press flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#8E8E93] transition-transform duration-200 motion-reduce:transition-none ${
                          expanded ? 'rotate-0' : '-rotate-90'
                        }`}
                        strokeWidth={2.25}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">
                        {MEAL_ROW_LABELS[type]}
                      </span>
                      <span className="shrink-0 text-[14px] tabular-nums text-[#8E8E93]">
                        {Math.round(kcal).toLocaleString('fr-FR')} kcal
                      </span>
                    </button>
                  ) : (
                    <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 py-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">
                        {MEAL_ROW_LABELS[type]}
                      </span>
                      <span className="shrink-0 text-[14px] tabular-nums text-[#8E8E93]">
                        {Math.round(kcal).toLocaleString('fr-FR')} kcal
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    data-meal-add={type}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddMeal(type)
                    }}
                    className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#FF2B2B]"
                    aria-label={`Ajouter un aliment · ${MEAL_ROW_LABELS[type]}`}
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                </div>

                {hasItems ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    hidden={!expanded}
                    className="motion-reduce:transition-none"
                  >
                    <ul className="space-y-0.5 px-3 pb-3 pt-0.5" data-meal-panel={type}>
                      {items.map((meal) => {
                        const portion = formatMealPortionLabel(meal)
                        return (
                          <li key={meal.id}>
                            <button
                              type="button"
                              onClick={() => onEditMeal?.(meal)}
                              className="ios-press flex w-full min-h-11 items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left"
                              aria-label={`Modifier ${meal.name}`}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-semibold text-white">
                                  {meal.name}
                                </span>
                                <span className="mt-0.5 block text-[12px] text-[#8E8E93]">
                                  {Math.round(meal.calories).toLocaleString('fr-FR')} kcal
                                  {portion ? ` · ${portion}` : ''}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
