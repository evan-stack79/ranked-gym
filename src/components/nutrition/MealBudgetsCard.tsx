import { Coffee, Cookie, Moon, Sun } from 'lucide-react'
import type { BodyMorphology, MealType } from '../../types/nutrition'
import { MEAL_TYPE_LABELS } from '../../utils/calories'
import { allMealBudgets, formatFrInteger } from '../../utils/portionGuide'

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
  // Sans cible journalière valide, la carte affiche des « 0 kcal » absurdes.
  if (!(Number.isFinite(targetCalories) && targetCalories > 0)) {
    return null
  }

  const { rows, sumBudgets, dailyTarget } = allMealBudgets(targetCalories, morphology, meals)

  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Repères par repas
        </p>
        <h3 className="text-[17px] font-bold text-white">Répartition indicative</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#AEAEB2]">
          Repères pour les 4 repas (environ {formatFrInteger(dailyTarget)} kcal au total).
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
                  {formatFrInteger(row.budget)}{' '}
                  <span className="font-medium text-[#636366]">kcal</span>
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="motion-progress-fill h-full rounded-full bg-[#AEAEB2]"
                  style={{
                    transform: `scaleX(${Math.max(progress, row.used > 0 ? 0.06 : 0)})`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-[#8E8E93]">
                Noté {formatFrInteger(row.used)} kcal
                {row.remaining > 0
                  ? ` · reste indicatif ${formatFrInteger(row.remaining)} kcal`
                  : ' · repas au repère'}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="text-center text-[13px] text-[#AEAEB2]">
        Total repères{' '}
        <span className="font-semibold text-white">{formatFrInteger(sumBudgets)} kcal</span>
        {' · '}
        jour{' '}
        <span className="font-semibold text-white">{formatFrInteger(dailyTarget)} kcal</span>
      </p>
    </section>
  )
}
