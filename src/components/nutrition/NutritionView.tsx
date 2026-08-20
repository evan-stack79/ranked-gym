import { useCallback, useState } from 'react'
import { Leaf, Droplets } from 'lucide-react'
import { CalorieCalculator } from './CalorieCalculator'
import { MealJournal } from './MealJournal'
import { IconBadge } from '../ui/IconBadge'
import { computeCaloriePlan } from '../../utils/calories'
import { getCalorieProfile } from '../../services/nutritionStorage'

export function NutritionView() {
  const [targetCalories, setTargetCalories] = useState(
    () => computeCaloriePlan(getCalorieProfile()).targetCalories,
  )

  const handleTargetChange = useCallback((value: number) => {
    setTargetCalories(value)
  }, [])

  return (
    <div className="flex flex-col gap-8 pb-4">
      <header className="relative">
        <div
          className="pointer-events-none absolute -left-8 -top-6 h-28 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #34C75944 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <IconBadge icon={Leaf} variant="green" size="sm" />
              <span className="rounded-full border border-[#34C759]/30 bg-[#34C759]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#30D158]">
                Fuel
              </span>
            </div>
            <h1 className="text-[34px] font-bold tracking-tight text-white">Nutrition</h1>
            <p className="mt-2 text-[17px] text-[#8E8E93]">
              Calcule ta cible et suis tes repas, style Apple Health.
            </p>
          </div>
          <IconBadge icon={Droplets} variant="blue" />
        </div>
      </header>

      <CalorieCalculator onTargetChange={handleTargetChange} />
      <MealJournal targetCalories={targetCalories} />
    </div>
  )
}
