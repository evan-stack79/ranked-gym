/**
 * « Mon objectif de la semaine » — barre + compteur.
 * Remplissage fluide (scaleX ≤400 ms, off si reduced motion).
 * Étincelle rouge une fois à 100 % pour la semaine ; rien de plus si dépassé.
 * Self-contained — pas de vibration, pas de lib motion.
 */
import { useEffect, useId, useRef, useState } from 'react'
import {
  clampWeeklySessionGoal,
  type WeeklySessionGoalTarget,
  WEEKLY_SESSION_GOAL_MAX,
  WEEKLY_SESSION_GOAL_MIN,
} from '../../services/trainWeeklyGoal'
import { parisWeekKey } from '../../utils/parisDate'
import {
  WEEKLY_GOAL_FILL_MS,
  WEEKLY_GOAL_SPARK_MS,
} from './trainWeeklyGoalMotion'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function TrainWeeklyGoalCard({
  doneCount,
  target,
  sparkShownWeekKey,
  onChangeTarget,
  onSparkShown,
}: {
  doneCount: number
  target: WeeklySessionGoalTarget
  sparkShownWeekKey?: string | null
  onChangeTarget: (next: WeeklySessionGoalTarget) => void
  onSparkShown: (weekKey: string) => void
}) {
  const labelId = useId()
  const reduced = prefersReducedMotion()
  const weekKey = parisWeekKey()
  const cappedRatio = Math.min(1, target > 0 ? doneCount / target : 0)
  const reached = doneCount >= target && target > 0
  const [spark, setSpark] = useState(false)
  const prevRatio = useRef(cappedRatio)

  useEffect(() => {
    prevRatio.current = cappedRatio
  }, [cappedRatio])

  useEffect(() => {
    if (!reached) return
    if (sparkShownWeekKey === weekKey) return
    if (reduced) {
      onSparkShown(weekKey)
      return
    }
    setSpark(true)
    onSparkShown(weekKey)
    const t = window.setTimeout(() => setSpark(false), WEEKLY_GOAL_SPARK_MS + 50)
    return () => window.clearTimeout(t)
  }, [reached, sparkShownWeekKey, weekKey, reduced, onSparkShown])

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#141416] p-4"
      data-testid="train-weekly-goal"
      aria-labelledby={labelId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={labelId} className="text-[16px] font-semibold text-white">
            Mon objectif de la semaine
          </h2>
          <p className="mt-1 text-[13px] text-[#8E8E93]" data-testid="train-weekly-goal-progress">
            {doneCount}/{target}
          </p>
        </div>
        <label className="flex flex-col items-end gap-1 text-[12px] text-[#8E8E93]">
          Séances
          <select
            className="min-h-10 rounded-xl border border-white/15 bg-black/40 px-2 text-[14px] font-semibold text-white"
            value={target}
            aria-label="Objectif de séances par semaine"
            data-testid="train-weekly-goal-select"
            onChange={(e) => onChangeTarget(clampWeeklySessionGoal(Number(e.target.value)))}
          >
            {Array.from(
              { length: WEEKLY_SESSION_GOAL_MAX - WEEKLY_SESSION_GOAL_MIN + 1 },
              (_, i) => WEEKLY_SESSION_GOAL_MIN + i,
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10"
        data-testid="train-weekly-goal-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(doneCount, target)}
      >
        <div
          className="train-weekly-goal-fill h-full origin-left rounded-full bg-brand"
          data-testid="train-weekly-goal-fill"
          data-ratio={String(cappedRatio)}
          style={{
            transform: `scaleX(${cappedRatio})`,
            transition: reduced
              ? undefined
              : `transform ${WEEKLY_GOAL_FILL_MS}ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))`,
          }}
        />
        {spark ? (
          <span
            className="train-weekly-goal-spark"
            data-testid="train-weekly-goal-spark"
            data-spark-ms={String(WEEKLY_GOAL_SPARK_MS)}
            data-spark-flashes="1"
            aria-hidden
          />
        ) : null}
      </div>

      <style>{`
        /* Single burst (iteration 1) — one luminance peak in ${WEEKLY_GOAL_SPARK_MS}ms
           ⇒ < 3 flashes/s (WCAG 2.2 SC 2.3.1). Never infinite / never strobe. */
        .train-weekly-goal-spark {
          pointer-events: none;
          position: absolute;
          right: 2px;
          top: 50%;
          width: 8px;
          height: 8px;
          margin-top: -4px;
          border-radius: 9999px;
          background: #ff2b2b;
          box-shadow:
            10px -6px 0 -2px #ff2b2b,
            -8px -8px 0 -2px #ff2b2b,
            12px 4px 0 -2px #ff2b2b,
            -10px 6px 0 -2px #ff2b2b,
            0 -12px 0 -2px #ff2b2b;
          animation-name: train-weekly-goal-spark-burst;
          animation-duration: ${WEEKLY_GOAL_SPARK_MS}ms;
          animation-timing-function: var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));
          animation-fill-mode: both;
          animation-iteration-count: 1;
          animation-direction: normal;
        }
        @keyframes train-weekly-goal-spark-burst {
          0% { opacity: 0; transform: scale(0.92); }
          22% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.28); }
        }
        @media (prefers-reduced-motion: reduce) {
          .train-weekly-goal-spark { animation: none !important; opacity: 0; }
        }
      `}</style>
    </section>
  )
}
