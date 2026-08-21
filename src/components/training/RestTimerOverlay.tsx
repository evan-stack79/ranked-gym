import { createPortal } from 'react-dom'
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

function ringColor(remaining: number, total: number): string {
  const ratio = total > 0 ? remaining / total : 0
  if (remaining <= 10) return '#FF453A'
  if (ratio <= 0.35) return '#FF9F0A'
  return '#30D158'
}

/**
 * Barre de repos flottante — sticky juste au-dessus de la BottomNav.
 * Visible uniquement quand un repos est actif / terminé.
 */
export function RestTimerOverlay({
  state,
  onPreset,
  onSkip,
  onDismiss,
}: RestTimerOverlayProps) {
  if (typeof document === 'undefined') return null
  if (!state.active && !state.finished && !state.target) return null

  const total = Math.max(1, state.totalSec)
  const remaining = state.finished ? 0 : state.remainingSec
  const progress = Math.min(1, Math.max(0, remaining / total))
  const color = ringColor(remaining, total)
  const pulsing = remaining > 0 && remaining <= 10
  const ringSize = 52
  const stroke = 4
  const radius = (ringSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[200] flex justify-center px-3"
      style={{
        bottom: 'calc(4.85rem + env(safe-area-inset-bottom, 0px))',
      }}
      aria-live="polite"
      role="timer"
      aria-label={`Repos ${formatClock(remaining)}`}
    >
      <div
        className={`pointer-events-auto rest-timer-panel w-full max-w-lg overflow-hidden rounded-2xl border border-white/14 px-3 py-2.5 ${
          pulsing ? 'rest-timer-pulse' : ''
        }`}
        style={{
          background: 'rgb(18 18 20 / 0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow:
            '0 12px 36px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.1)',
        }}
      >
        {/* Ligne principale : ring + temps + passer */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90" aria-hidden>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="rgb(255 255 255 / 0.1)"
                strokeWidth={stroke}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{
                  transition: 'stroke-dashoffset 0.95s linear, stroke 0.35s ease',
                  filter: `drop-shadow(0 0 6px ${color}88)`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {state.finished ? (
                <Check className="h-4 w-4 text-[#30D158]" strokeWidth={2.75} />
              ) : (
                <span className="text-[11px] font-bold tabular-nums text-white">
                  {Math.ceil((remaining / total) * 100)}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {state.finished ? (
              <p className="text-[18px] font-bold tracking-tight text-[#30D158]">Repos OK</p>
            ) : (
              <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-white">
                {formatClock(remaining)}
              </p>
            )}
            <p className="mt-0.5 truncate text-[11px] font-medium text-[#8E8E93]">
              {state.target
                ? `${state.target.exerciseName || 'Exercice'} · ${state.target.setLabel}`
                : 'Repos'}
            </p>
          </div>

          {!state.finished ? (
            <button
              type="button"
              onClick={onSkip}
              className="ios-press flex shrink-0 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.07] px-3 py-2.5 text-[13px] font-semibold text-white"
            >
              <SkipForward className="h-3.5 w-3.5" strokeWidth={2.5} />
              Passer
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="ios-press shrink-0 rounded-xl border border-[#30D158]/35 bg-[#30D158]/15 px-3 py-2.5 text-[13px] font-semibold text-[#30D158]"
            >
              OK
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="ios-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[#8E8E93]"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Presets rapides */}
        <div className="mt-2 flex gap-1.5">
          {REST_PRESETS_SEC.map((sec) => {
            const active = state.totalSec === sec && state.active
            return (
              <button
                key={sec}
                type="button"
                onClick={() => onPreset(sec)}
                className={`ios-press flex-1 rounded-xl border py-2 text-[12px] font-semibold tabular-nums ${
                  active
                    ? 'border-[#30D158]/45 bg-[#30D158]/18 text-[#30D158]'
                    : 'border-white/10 bg-white/[0.04] text-[#AEAEB2]'
                }`}
              >
                {sec}s
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
