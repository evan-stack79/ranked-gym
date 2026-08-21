import { Check, SkipForward, X } from 'lucide-react'
import type { RestPresetSec, RestTimerState } from '../../hooks/useRestTimer'
import { REST_PRESETS_SEC } from '../../hooks/useRestTimer'

interface RestTimerOverlayProps {
  state: RestTimerState
  onPreset: (sec: RestPresetSec) => void
  onSkip: () => void
  onDismiss: () => void
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** Couleur du ring : vert → orange → rouge selon le temps restant. */
function ringColor(remaining: number, total: number): string {
  const ratio = total > 0 ? remaining / total : 0
  if (remaining <= 10) return '#FF453A'
  if (ratio <= 0.35) return '#FF9F0A'
  return '#30D158'
}

/**
 * Timer de repos immersif — overlay non bloquant (au-dessus de la nav).
 */
export function RestTimerOverlay({
  state,
  onPreset,
  onSkip,
  onDismiss,
}: RestTimerOverlayProps) {
  if (!state.active && !state.finished && !state.target) return null

  const total = Math.max(1, state.totalSec)
  const remaining = state.finished ? 0 : state.remainingSec
  const progress = Math.min(1, Math.max(0, remaining / total))
  const color = ringColor(remaining, total)
  const pulsing = remaining > 0 && remaining <= 10
  const size = 148
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto rest-timer-panel w-full max-w-[340px] overflow-hidden rounded-[28px] border border-white/14 p-4"
        style={{
          background: 'rgb(22 22 24 / 0.92)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow:
            '0 16px 48px rgb(0 0 0 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.1)',
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Repos
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-[#AEAEB2]">
              {state.target
                ? `${state.target.exerciseName || 'Exercice'} · ${state.target.setLabel}`
                : 'Timer'}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="ios-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#AEAEB2]"
            aria-label="Fermer le timer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div
            className={`relative ${pulsing ? 'rest-timer-pulse' : ''}`}
            style={{ width: size, height: size }}
          >
            <svg width={size} height={size} className="-rotate-90" aria-hidden>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgb(255 255 255 / 0.08)"
                strokeWidth={stroke}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{
                  transition: 'stroke-dashoffset 0.95s linear, stroke 0.4s ease',
                  filter: `drop-shadow(0 0 10px ${color}88)`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {state.finished ? (
                <>
                  <Check className="mb-1 h-7 w-7 text-[#30D158]" strokeWidth={2.5} />
                  <p className="text-[13px] font-semibold text-[#30D158]">Repos terminé</p>
                </>
              ) : (
                <p
                  className="text-[34px] font-bold tracking-tight tabular-nums text-white"
                  style={{ textShadow: '0 2px 16px rgb(0 0 0 / 0.45)' }}
                >
                  {formatClock(remaining)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex w-full gap-2">
            {REST_PRESETS_SEC.map((sec) => {
              const active = state.totalSec === sec && state.active
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onPreset(sec)}
                  className={`ios-press flex-1 rounded-2xl border py-2.5 text-[14px] font-semibold tabular-nums ${
                    active
                      ? 'border-[#30D158]/45 bg-[#30D158]/18 text-[#30D158]'
                      : 'border-white/12 bg-white/[0.05] text-white'
                  }`}
                >
                  {sec}s
                </button>
              )
            })}
          </div>

          {!state.finished ? (
            <button
              type="button"
              onClick={onSkip}
              className="ios-press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] py-3 text-[14px] font-semibold text-white"
            >
              <SkipForward className="h-4 w-4" strokeWidth={2.25} />
              Skip · série suivante
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="ios-press mt-3 w-full rounded-2xl border border-[#30D158]/35 bg-[#30D158]/15 py-3 text-[14px] font-semibold text-[#30D158]"
            >
              Continuer
            </button>
          )}

          <p className="mt-2 text-center text-[11px] leading-relaxed text-[#636366]">
            Tu peux continuer à noter tes charges pendant le repos.
          </p>
        </div>
      </div>
    </div>
  )
}
