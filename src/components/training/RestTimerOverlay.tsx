import { createPortal } from 'react-dom'
import { Check, SkipForward, Timer } from 'lucide-react'
import type { RestPresetSec, RestTimerState } from '../../hooks/useRestTimer'
import { REST_PRESETS_SEC } from '../../hooks/useRestTimer'

interface RestTimerOverlayProps {
  state: RestTimerState
  onPreset: (sec: RestPresetSec) => void
  onSkip: () => void
  onDismiss: () => void
  /**
   * Pour tests / ergonomie Train : barre toujours montée
   * (état « Prêt à lancer » si le chrono est à l’arrêt).
   */
  alwaysVisible?: boolean
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function ringColor(remaining: number, total: number, idle: boolean): string {
  if (idle) return '#8E8E93'
  const ratio = total > 0 ? remaining / total : 0
  if (remaining <= 10) return '#FF453A'
  if (ratio <= 0.35) return '#FF9F0A'
  return '#30D158'
}

/**
 * Barre de repos sticky — portal body, z-index 999, au-dessus de la BottomNav.
 */
export function RestTimerOverlay({
  state,
  onPreset,
  onSkip,
  onDismiss,
  alwaysVisible = false,
}: RestTimerOverlayProps) {
  if (typeof document === 'undefined') return null

  const running = state.active
  const finished = state.finished
  const idle = !running && !finished

  if (!alwaysVisible && idle && !state.target) return null

  const total = Math.max(1, state.totalSec || 90)
  const remaining = finished ? 0 : running ? state.remainingSec : 0
  const progress = idle ? 0 : Math.min(1, Math.max(0, remaining / total))
  const color = ringColor(remaining, total, idle)
  const pulsing = running && remaining > 0 && remaining <= 10
  const ringSize = 48
  const stroke = 4
  const radius = (ringSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return createPortal(
    <div
      id="ranked-rest-timer-bar"
      className="pointer-events-none fixed inset-x-0 flex justify-center px-3"
      style={{
        zIndex: 999,
        bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))',
      }}
      aria-live="polite"
      role="timer"
      aria-label={idle ? 'Repos prêt à lancer' : `Repos ${formatClock(remaining)}`}
    >
      <div
        className={`pointer-events-auto rest-timer-panel w-full max-w-lg overflow-hidden rounded-2xl border-2 px-3 py-2.5 ${
          pulsing ? 'rest-timer-pulse' : ''
        }`}
        style={{
          borderColor: idle ? 'rgb(48 209 88 / 0.35)' : 'rgb(255 255 255 / 0.16)',
          background: 'rgb(22 22 24 / 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow:
            '0 14px 40px rgb(0 0 0 / 0.7), 0 0 24px rgb(48 209 88 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.12)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90" aria-hidden>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="rgb(255 255 255 / 0.12)"
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
                strokeDashoffset={idle ? circumference : dashOffset}
                style={{
                  transition: 'stroke-dashoffset 0.95s linear, stroke 0.35s ease',
                  filter: idle ? undefined : `drop-shadow(0 0 6px ${color}88)`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {finished ? (
                <Check className="h-4 w-4 text-[#30D158]" strokeWidth={2.75} />
              ) : idle ? (
                <Timer className="h-4 w-4 text-[#30D158]" strokeWidth={2.25} />
              ) : (
                <span className="text-[10px] font-bold tabular-nums text-white">
                  {Math.ceil(progress * 100)}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {finished ? (
              <p className="text-[17px] font-bold tracking-tight text-[#30D158]">Repos OK</p>
            ) : idle ? (
              <p className="text-[16px] font-bold tracking-tight text-white">Prêt à lancer</p>
            ) : (
              <p className="text-[24px] font-bold leading-none tracking-tight tabular-nums text-white">
                {formatClock(remaining)}
              </p>
            )}
            <p className="mt-0.5 truncate text-[11px] font-medium text-[#8E8E93]">
              {idle
                ? 'Choisis 45s · 90s · 180s'
                : state.target
                  ? `${state.target.exerciseName || 'Exercice'} · ${state.target.setLabel}`
                  : 'Repos en cours'}
            </p>
          </div>

          {running ? (
            <button
              type="button"
              onClick={onSkip}
              className="ios-press flex shrink-0 items-center gap-1 rounded-xl border border-white/14 bg-white/[0.08] px-3 py-2.5 text-[13px] font-semibold text-white"
            >
              <SkipForward className="h-3.5 w-3.5" strokeWidth={2.5} />
              Passer
            </button>
          ) : null}

          {finished ? (
            <button
              type="button"
              onClick={onDismiss}
              className="ios-press shrink-0 rounded-xl border border-[#30D158]/40 bg-[#30D158]/18 px-3 py-2.5 text-[13px] font-semibold text-[#30D158]"
            >
              OK
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex gap-1.5">
          {REST_PRESETS_SEC.map((sec) => {
            const active = running && state.totalSec === sec
            return (
              <button
                key={sec}
                type="button"
                onClick={() => onPreset(sec)}
                className={`ios-press flex-1 rounded-xl border py-2.5 text-[13px] font-semibold tabular-nums ${
                  active
                    ? 'border-[#30D158]/50 bg-[#30D158]/20 text-[#30D158]'
                    : idle
                      ? 'border-[#30D158]/30 bg-[#30D158]/12 text-[#30D158]'
                      : 'border-white/12 bg-white/[0.05] text-[#AEAEB2]'
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
