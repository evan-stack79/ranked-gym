/**
 * « Mon objectif de la semaine » — barre + compteur.
 * Fill ratio and progress text always share weeklyGoalFillRatio (same source of truth).
 * Bar snaps with the text (no laggy CSS fill) so remount/reset never desync.
 * Spark on crossing 100 %; onSparkShown deferred for React StrictMode.
 */
import { useEffect, useId, useRef, useState } from 'react'
import {
  clampWeeklySessionGoal,
  type WeeklySessionGoalTarget,
  WEEKLY_SESSION_GOAL_MAX,
  WEEKLY_SESSION_GOAL_MIN,
} from '../../services/trainWeeklyGoal'
import {
  weeklyGoalFillRatio,
  weeklyGoalReached,
} from '../../services/trainWeeklyGoalFill'
import { parisWeekKey } from '../../utils/parisDate'
import { WEEKLY_GOAL_SPARK_MS } from './trainWeeklyGoalMotion'

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
  sparkDurationMs,
}: {
  doneCount: number
  target: WeeklySessionGoalTarget
  sparkShownWeekKey?: string | null
  onChangeTarget: (next: WeeklySessionGoalTarget) => void
  onSparkShown: (weekKey: string) => void
  sparkDurationMs?: number
}) {
  const labelId = useId()
  const reduced = prefersReducedMotion()
  const weekKey = parisWeekKey()
  const sparkMs =
    typeof sparkDurationMs === 'number' && sparkDurationMs > 0
      ? sparkDurationMs
      : WEEKLY_GOAL_SPARK_MS
  const cappedRatio = weeklyGoalFillRatio(doneCount, target)
  const reached = weeklyGoalReached(doneCount, target)
  const [spark, setSpark] = useState(false)
  const prevRatioRef = useRef(cappedRatio)
  const markedRef = useRef(sparkShownWeekKey === weekKey)

  useEffect(() => {
    markedRef.current = sparkShownWeekKey === weekKey
  }, [sparkShownWeekKey, weekKey])

  useEffect(() => {
    const prev = prevRatioRef.current
    prevRatioRef.current = cappedRatio
    const crossedToFull = prev < 1 && cappedRatio >= 1
    if (!crossedToFull || !reached) return
    if (reduced) {
      if (!markedRef.current) {
        markedRef.current = true
        onSparkShown(weekKey)
      }
      return
    }

    setSpark(true)
    // Defer persistence so StrictMode cleanup+re-run still paints the spark.
    const markTimer = window.setTimeout(() => {
      if (!markedRef.current) {
        markedRef.current = true
        onSparkShown(weekKey)
      }
    }, 40)
    const hideTimer = window.setTimeout(() => setSpark(false), sparkMs + 50)
    return () => {
      window.clearTimeout(markTimer)
      window.clearTimeout(hideTimer)
    }
  }, [cappedRatio, reached, reduced, onSparkShown, weekKey, sparkMs])

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
          data-fill-sync={`${doneCount}/${target}`}
          style={{
            transform: `scaleX(${cappedRatio})`,
            // No CSS transition — fill always equals done/target (including remount/reset).
            transition: 'none',
          }}
        />
        {spark ? (
          <span
            className="train-weekly-goal-spark"
            data-testid="train-weekly-goal-spark"
            data-spark-ms={String(sparkMs)}
            data-spark-flashes="1"
            aria-hidden
          />
        ) : null}
      </div>

      <style>{`
        .train-weekly-goal-spark {
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 50%;
          width: 18px;
          height: 18px;
          margin-top: -9px;
          border-radius: 9999px;
          background: #ff2b2b;
          box-shadow:
            0 0 0 3px rgba(255, 43, 43, 0.45),
            0 0 18px 4px rgba(255, 43, 43, 0.85),
            18px -12px 0 -3px #ff2b2b,
            -16px -14px 0 -3px #ff2b2b,
            20px 8px 0 -3px #ff2b2b,
            -18px 10px 0 -3px #ff2b2b,
            0 -20px 0 -3px #ff2b2b;
          animation-name: train-weekly-goal-spark-burst;
          animation-duration: ${sparkMs}ms;
          animation-timing-function: var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));
          animation-fill-mode: both;
          animation-iteration-count: 1;
          animation-direction: normal;
        }
        @keyframes train-weekly-goal-spark-burst {
          0% { opacity: 0; transform: scale(0.7); }
          15% { opacity: 1; transform: scale(1.15); }
          55% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .train-weekly-goal-spark { animation: none !important; opacity: 0; }
        }
      `}</style>
    </section>
  )
}
