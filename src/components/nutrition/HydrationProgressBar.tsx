import { Droplets } from 'lucide-react'
import { formatWaterMl } from '../../utils/waterGoal'

interface HydrationProgressBarProps {
  consumedMl: number
  goalMl: number
  /** Affiche le libellé « Hydratation » et l’icône. */
  showHeader?: boolean
  /** Barre plus fine (Accueil). */
  compact?: boolean
  /** Indique le bonus séance du jour. */
  isTrainingDay?: boolean
  className?: string
}

export function HydrationProgressBar({
  consumedMl,
  goalMl,
  showHeader = true,
  compact = false,
  isTrainingDay = false,
  className = '',
}: HydrationProgressBarProps) {
  const safeGoal = Math.max(100, goalMl)
  const progress = Math.min(Math.max(0, consumedMl) / safeGoal, 1)
  const remaining = Math.max(0, safeGoal - consumedMl)
  const overGoal = consumedMl > safeGoal

  return (
    <div className={className}>
      {showHeader ? (
        <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-2.5'}`}>
          <div className="flex min-w-0 items-center gap-2">
            <Droplets
              className={`shrink-0 text-[#22D3EE] ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
              strokeWidth={2.25}
              aria-hidden
            />
            <div className="min-w-0">
              <p
                className={`font-semibold uppercase tracking-wider text-[#8E8E93] ${
                  compact ? 'text-[10px]' : 'text-[11px]'
                }`}
              >
                Hydratation
              </p>
              {!compact ? (
                <p className="truncate text-[13px] font-medium text-white">
                  {overGoal ? (
                    <>
                      Objectif dépassé ·{' '}
                      <span className="text-[#67E8F9]">{formatWaterMl(consumedMl)}</span>
                    </>
                  ) : (
                    <>
                      Encore{' '}
                      <span className="font-semibold text-[#67E8F9]">{formatWaterMl(remaining)}</span>
                    </>
                  )}
                </p>
              ) : null}
            </div>
          </div>
          <span
            className={`shrink-0 tabular-nums text-[#636366] ${
              compact ? 'text-[11px]' : 'text-[12px]'
            }`}
          >
            {Math.round(consumedMl)} / {formatWaterMl(safeGoal)}
          </span>
        </div>
      ) : null}

      <div
        className={`overflow-hidden rounded-full bg-white/10 ${
          compact ? 'h-1.5' : 'h-2 border border-cyan-400/15 bg-black/35'
        }`}
      >
        <div
          className={`hydration-progress-fill h-full rounded-full transition-all duration-500 ${
            overGoal ? 'hydration-progress-fill--over' : ''
          }`}
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>

      {!compact && isTrainingDay ? (
        <p className="mt-1.5 text-[11px] text-[#636366]">
          +700 ml bonus séance · objectif adapté à ton entraînement
        </p>
      ) : null}

      {compact ? (
        <p className="mt-1 text-[11px] text-[#636366]">
          {overGoal ? (
            <span className="text-[#67E8F9]">{formatWaterMl(consumedMl)} bus</span>
          ) : (
            <>
              <span className="font-medium text-[#67E8F9]">{formatWaterMl(remaining)}</span> restants
            </>
          )}
          {isTrainingDay ? ' · jour Train' : null}
        </p>
      ) : null}
    </div>
  )
}
