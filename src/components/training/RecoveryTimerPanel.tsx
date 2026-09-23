import { useRestTimerContext } from '../../context/RestTimerContext'

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** Durée programmée — « 1 min 30 », « 45 s », « 2 min ». */
export function formatRecoveryDurationLabel(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r} s`
  if (r === 0) return m === 1 ? '1 min' : `${m} min`
  return `${m} min ${r}`
}

interface RecoveryTimerPanelProps {
  /** Série venant d’être validée — valeurs réelles (maquette). */
  completedSummary?: { setNumber: number; weightKg: number; reps: number } | null
}

/**
 * Overlay récupération (maquette Evan) — pas de carte, pas de barre, pas de glass.
 * Émerge sur la séance assombrie (opacité gérée par le parent).
 * Source unique : RestTimerContext (endsAt persisté).
 */
export function RecoveryTimerPanel({ completedSummary = null }: RecoveryTimerPanelProps) {
  const rest = useRestTimerContext()

  if (!rest.state.active && !rest.state.finished) return null

  const total = Math.max(1, rest.state.totalSec)
  const remaining = rest.state.finished ? 0 : rest.state.remainingSec
  const durationLabel = formatRecoveryDurationLabel(total)

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col"
      data-recovery-timer
      data-recovery-overlay
      role="timer"
      aria-label={`Récupération ${formatClock(remaining)}`}
    >
      {/* Zone haute : résumé série réelle au-dessus du glow */}
      <div className="relative flex flex-1 flex-col justify-end px-5 pb-2 pt-[max(3.5rem,env(safe-area-inset-top))]">
        {completedSummary ? (
          <p
            className="flex items-center gap-2.5 text-[15px] font-semibold text-white/70"
            data-recovery-completed-summary
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#FF2B2B] text-[#FF2B2B]"
              aria-hidden="true"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.2L4.8 8.5L9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>
              Série {completedSummary.setNumber} terminée · {formatWeight(completedSummary.weightKg)}{' '}
              kg × {completedSummary.reps}
            </span>
          </p>
        ) : null}
      </div>

      {/* Demi-basse : chrono + glow rouge progressif (pas de carte / barre) */}
      <div
        className="relative flex flex-col items-center px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-8"
        data-recovery-controls
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(70,6,8,0.55) 42%, rgba(110,8,12,0.85) 100%)',
        }}
      >
        <p className="text-center text-[15px] font-semibold tracking-tight" data-recovery-label>
          <span className="text-[#FF2B2B]">Récupération</span>
          <span className="text-white"> · {durationLabel}</span>
        </p>

        <p
          className="mt-3 text-[72px] font-bold leading-none tracking-tight tabular-nums text-white sm:text-[80px]"
          data-recovery-remaining
        >
          {formatClock(remaining)}
        </p>

        <button
          type="button"
          onClick={() => rest.skip()}
          className="ios-press mt-7 flex min-h-12 w-full max-w-[280px] items-center justify-center rounded-full border border-[#FF2B2B] bg-transparent text-[16px] font-semibold text-white"
          data-recovery-resume
        >
          Reprendre
        </button>

        <button
          type="button"
          onClick={() => rest.addSeconds(15)}
          className="ios-press mt-4 min-h-11 px-4 text-[15px] font-medium text-white/85"
          data-recovery-add-15
          aria-label="Ajouter 15 secondes de récupération"
        >
          +15 s
        </button>
      </div>
    </div>
  )
}

function formatWeight(kg: number): string {
  if (!Number.isFinite(kg)) return '0'
  const rounded = Math.round(kg * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}
