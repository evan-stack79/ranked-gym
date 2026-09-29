import type { CSSProperties } from 'react'
import { circularProgressTransition } from '../ui/animated-circular-progress-bar.tokens'

interface NutritionCalorieRingProps {
  remainingCalories: number
  consumedCalories: number
  targetCalories: number
  progress: number
  onOpenSetup: () => void
  reducedMotion?: boolean
}

function formatKcal(n: number): string {
  return Math.max(0, Math.round(Number.isFinite(n) ? n : 0)).toLocaleString('fr-FR')
}

const RING_RADIUS = 92
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const RING_SWEEP = 280
const RING_DASH = (RING_SWEEP / 360) * RING_CIRCUMFERENCE
const RING_ROTATION = 130

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function NutritionCalorieRing({
  remainingCalories,
  consumedCalories,
  targetCalories,
  progress,
  onOpenSetup,
  reducedMotion,
}: NutritionCalorieRingProps) {
  const hasTarget = Number.isFinite(targetCalories) && targetCalories > 0
  const safeConsumed = Number.isFinite(consumedCalories) ? Math.max(0, consumedCalories) : 0
  const safeProgress = hasTarget
    ? Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : safeConsumed / targetCalories))
    : 0
  const isOverTarget = hasTarget && remainingCalories < 0
  const staticMotion = reducedMotion === true || prefersReducedMotion()
  const fillLength = Math.max(0, RING_DASH * safeProgress)
  const fillOffset = RING_DASH - fillLength
  const armDeg = RING_ROTATION + RING_SWEEP * safeProgress
  const motionTransition = circularProgressTransition(!staticMotion)

  const heading = (
    <div className="mb-3 flex w-full items-center justify-between gap-3">
      <p className="text-[15px] font-semibold text-white">Calories aujourd’hui</p>
      <p className="text-right text-[12px] tabular-nums text-[#8E8E93]">
        {hasTarget ? `${formatKcal(safeConsumed)} / ${formatKcal(targetCalories)} kcal` : 'Objectif à définir'}
      </p>
    </div>
  )

  if (!hasTarget) {
    return (
      <div className="flex flex-col items-center text-center">
        {heading}
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#19191C]">
          <img src="/panther-trim.png" alt="" width={38} height={38} className="h-10 w-10 object-contain" draggable={false} />
        </div>
        <p className="mt-4 text-[16px] font-semibold text-white">Définis ton objectif calorique</p>
        <p className="mt-1 max-w-[18rem] text-[13px] leading-5 text-[#8E8E93]">
          Ton compteur apparaîtra dès que ton plan nutrition sera renseigné.
        </p>
        <button
          type="button"
          onClick={onOpenSetup}
          className="ios-press mt-5 rounded-xl bg-[#FF2B2B] px-4 py-2.5 text-[13px] font-semibold text-white"
        >
          Définir mon objectif
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {heading}
      <div
        className="relative aspect-square w-full max-w-[282px]"
        data-calorie-ring=""
        data-motion={staticMotion ? 'static' : 'animated'}
        data-ring-progress={safeProgress}
      >
        <svg viewBox="0 0 240 240" className="h-full w-full overflow-visible" role="img" aria-label="Progression calorique">
          <circle
            cx="120"
            cy="120"
            r={RING_RADIUS}
            fill="none"
            stroke="#2A2A2E"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${RING_DASH} ${RING_CIRCUMFERENCE - RING_DASH}`}
            transform={`rotate(${RING_ROTATION} 120 120)`}
          />
          <circle
            cx="120"
            cy="120"
            r={RING_RADIUS - 13}
            fill="none"
            stroke="#45454A"
            strokeWidth="1.5"
            strokeDasharray="1 7"
            strokeLinecap="round"
            strokeDashoffset="-2"
            transform={`rotate(${RING_ROTATION} 120 120)`}
            opacity="0.7"
          />
          <circle
            cx="120"
            cy="120"
            r={RING_RADIUS}
            fill="none"
            stroke="#FF2B2B"
            strokeWidth="14"
            strokeLinecap="round"
            className="nutrition-calorie-ring-fill"
            data-calorie-ring-fill=""
            style={
              {
                '--stroke-percent': safeProgress * 100,
                strokeDasharray: `${RING_DASH}px ${RING_CIRCUMFERENCE}px`,
                strokeDashoffset: `${fillOffset}px`,
                transition: motionTransition,
              } as CSSProperties
            }
            transform={`rotate(${RING_ROTATION} 120 120)`}
          />
        </svg>
        <div className="absolute inset-[18%] flex flex-col items-center justify-center text-center">
          <img
            src="/panther-trim.png"
            alt=""
            width={32}
            height={32}
            className="mb-2 h-9 w-9 object-contain"
            draggable={false}
          />
          <p className="text-[36px] font-bold leading-none tracking-tight text-white tabular-nums">
            {isOverTarget ? formatKcal(Math.abs(remainingCalories)) : formatKcal(remainingCalories)}
          </p>
          <p className={`mt-1 text-[14px] font-medium ${isOverTarget ? 'text-[#FF6B6B]' : 'text-[#8E8E93]'}`}>
            {isOverTarget ? 'kcal dépassées' : 'kcal restantes'}
          </p>
        </div>
        <div
          className="nutrition-calorie-ring-indicator pointer-events-none absolute inset-0"
          data-calorie-ring-indicator=""
          style={{
            transform: `rotate(${armDeg}deg)`,
            transformOrigin: '50% 50%',
            transition: motionTransition,
          }}
        >
          <span
            className="absolute h-[10px] w-[10px] rounded-full border-[3px] border-[#0C0C0E] bg-[#FF2B2B]"
            style={{
              left: `${((120 + RING_RADIUS) / 240) * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
          <span
            className="absolute rounded-full border border-[#FF2B2B]/50 bg-[#171719] px-2 py-1 text-[11px] font-bold tabular-nums text-white"
            style={{
              left: `${((120 + RING_RADIUS) / 240) * 100}%`,
              top: '50%',
              transform: `translate(-50%, -50%) rotate(${-armDeg}deg)`,
              transition: motionTransition,
            }}
          >
            {Math.round(safeProgress * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}
