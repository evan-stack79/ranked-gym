import { Pause, Play, SkipForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRestTimerContext } from '../../context/RestTimerContext'

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

interface RecoveryTimerPanelProps {
  nextHint: { exerciseName: string; setLabel: string } | null
}

/**
 * Minuteur récupération immersif — fond opaque, rouge seul accent.
 * Une seule source : RestTimerContext (endsAt persisté).
 */
export function RecoveryTimerPanel({ nextHint }: RecoveryTimerPanelProps) {
  const rest = useRestTimerContext()
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      const onChange = () => setReduceMotion(mq.matches)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      return undefined
    }
  }, [])

  if (!rest.state.active && !rest.state.finished) return null

  const total = Math.max(1, rest.state.totalSec)
  const remaining = rest.state.finished ? 0 : rest.state.remainingSec
  const progress = Math.min(1, Math.max(0, remaining / total))
  const running = rest.state.active && !rest.state.paused

  return (
    <section
      className="mt-3 rounded-2xl border border-white/10 bg-[#141416] px-4 py-4"
      data-recovery-timer
      data-reduced-motion={reduceMotion ? 'true' : 'false'}
      role="timer"
      aria-label={`Récupération ${formatClock(remaining)}`}
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
        Récupération
      </p>
      <p
        className="mt-2 text-[40px] font-bold leading-none tracking-tight tabular-nums text-white"
        data-recovery-remaining
      >
        {formatClock(remaining)}
      </p>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#2c2c2e]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[#FF2B2B]"
          style={{
            width: `${Math.round(progress * 100)}%`,
            transition: reduceMotion ? 'none' : 'width 0.25s linear',
          }}
        />
      </div>

      {nextHint ? (
        <p className="mt-3 text-[13px] text-[#AEAEB2]" data-recovery-next>
          Série suivante : {nextHint.setLabel} · {nextHint.exerciseName}
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-[#8E8E93]">Dernière série de cet enchaînement</p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => rest.addSeconds(30)}
          className="ios-press flex min-h-11 items-center justify-center rounded-xl border border-white/12 bg-[#1c1c1e] text-[13px] font-semibold text-white"
        >
          +30 s
        </button>
        {running ? (
          <button
            type="button"
            onClick={() => rest.pause()}
            className="ios-press flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/12 bg-[#1c1c1e] text-[13px] font-semibold text-white"
            aria-label="Mettre le repos en pause"
          >
            <Pause className="h-3.5 w-3.5" strokeWidth={2.5} />
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={() => rest.resume()}
            className="ios-press flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[#FF2B2B]/40 bg-[#FF2B2B]/18 text-[13px] font-semibold text-[#FF2B2B]"
            aria-label="Reprendre le repos"
          >
            <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
            Reprendre
          </button>
        )}
        <button
          type="button"
          onClick={() => rest.skip()}
          className="ios-press flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/12 bg-[#1c1c1e] text-[13px] font-semibold text-white"
        >
          <SkipForward className="h-3.5 w-3.5" strokeWidth={2.5} />
          Passer
        </button>
      </div>
    </section>
  )
}
