import { MacroRing } from './MacroRing'

interface NutritionCalorieRingProps {
  remainingCalories: number
  consumedCalories: number
  targetCalories: number
  progress: number
}

function formatKcal(n: number): string {
  return Math.round(n).toLocaleString('fr-FR')
}

/**
 * Anneau calorique Wave 2 — panthère couronnée locale + hiérarchie restantes / consommé.
 */
export function NutritionCalorieRing({
  remainingCalories,
  consumedCalories,
  targetCalories,
  progress,
}: NutritionCalorieRingProps) {
  return (
    <div className="flex flex-col items-center">
      <MacroRing
        progress={progress}
        size={220}
        stroke={6}
        color="#FF2B2B"
        trackColor="#2A2A2E"
      >
        <div className="flex flex-col items-center px-4 pt-1 text-center">
          <img
            src="/panther-trim.png"
            alt=""
            width={32}
            height={32}
            className="mb-1.5 h-8 w-8 object-contain"
            draggable={false}
          />
          <p className="text-[40px] font-bold leading-none tracking-tight text-white tabular-nums">
            {formatKcal(remainingCalories)}
          </p>
          <p className="mt-1.5 text-[15px] font-medium text-[#8E8E93]">kcal restantes</p>
          <p className="mt-3 text-[12px] font-medium tabular-nums text-white/90">
            {formatKcal(consumedCalories)} / {formatKcal(targetCalories)} kcal
          </p>
        </div>
      </MacroRing>
    </div>
  )
}
