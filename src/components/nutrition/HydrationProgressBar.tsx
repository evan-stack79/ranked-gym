import { Droplets, Info } from 'lucide-react'
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
  /** Masque la note longue « Objectif atteint » (Accueil). */
  showGoalReachedNote?: boolean
  className?: string
}

export function HydrationProgressBar({
  consumedMl,
  goalMl,
  showHeader = true,
  compact = false,
  isTrainingDay = false,
  showGoalReachedNote = true,
  className = '',
}: HydrationProgressBarProps) {
  const safeGoal = Math.max(100, goalMl)
  const progress = Math.min(Math.max(0, consumedMl) / safeGoal, 1)
  const remaining = Math.max(0, safeGoal - consumedMl)
  const overGoal = consumedMl > safeGoal
  const goalReached = consumedMl >= safeGoal

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

      {goalReached && showGoalReachedNote ? (
        <div
          className={`flex items-start gap-2 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.06] ${
            compact ? 'mt-2 px-2.5 py-2' : 'mt-2.5 px-3 py-2.5'
          }`}
          role="note"
        >
          <Info
            className={`mt-0.5 shrink-0 text-[#7DD3FC]/80 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
            strokeWidth={2}
            aria-hidden
          />
          <p
            className={`leading-snug text-[#8E8E93] ${
              compact ? 'text-[11px]' : 'text-sm'
            }`}
          >
            Objectif atteint ! Mais l&apos;algorithme n&apos;est qu&apos;une base. Reste à l&apos;écoute
            de ton corps : si tu as soif, continue de t&apos;hydrater.
          </p>
        </div>
      ) : null}

      {!compact && isTrainingDay && !goalReached ? (
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
