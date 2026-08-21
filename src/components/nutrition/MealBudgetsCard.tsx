import { Coffee, Cookie, Moon, Sun } from 'lucide-react'
import type { BodyMorphology, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import { allMealBudgets } from '../../utils/portionGuide'

const ICONS: Record<MealType, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
}

interface MealBudgetsCardProps {
  targetCalories: number
  morphology: BodyMorphology
  meals: Array<{ mealType: MealType; calories: number }>
}

export function MealBudgetsCard({ targetCalories, morphology, meals }: MealBudgetsCardProps) {
  const { rows, sumBudgets, dailyTarget } = allMealBudgets(targetCalories, morphology, meals)

  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Objectifs par repas
        </p>
        <h3 className="text-[17px] font-bold text-white">Combien manger à chaque repas</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[#AEAEB2]">
          La somme des 4 repas = exactement ta cible du jour ({dailyTarget} kcal).
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => {
          const Icon = ICONS[row.mealType]
          const progress = row.budget > 0 ? Math.min(1, row.used / row.budget) : 0
          return (
            <li
              key={row.mealType}
              className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[#8E8E93]" />
                  <p className="text-[14px] font-semibold text-white">
                    {MEAL_TYPE_LABELS[row.mealType]}
                  </p>
                </div>
                <p className="text-[13px] font-bold text-white">
                  {row.budget}{' '}
                  <span className="font-medium text-[#636366]">kcal</span>
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(progress * 100, row.used > 0 ? 6 : 0)}%`,
                    background:
                      progress > 1.05
                        ? 'linear-gradient(90deg, #FF2B2B, #FF9F0A)'
                        : 'linear-gradient(90deg, #00B4FF, #30D158)',
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[#8E8E93]">
                Zone {row.range.min}–{row.range.max} · mangé {row.used}
                {row.remaining > 0 ? (
                  <>
                    {' '}
                    · reste repas{' '}
                    <span className="font-semibold text-[#30D158]">{row.remaining} kcal</span>
                  </>
                ) : (
                  <>
                    {' '}
                    · <span className="font-semibold text-[#FF9F0A]">budget OK</span>
                  </>
                )}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="text-center text-[12px] text-[#AEAEB2]">
        Total repas{' '}
        <span className="font-semibold text-white">{sumBudgets} kcal</span>
        {' = '}
        cible jour{' '}
        <span className="font-semibold text-[#30D158]">{dailyTarget} kcal</span>
      </p>
    </section>
  )
}
