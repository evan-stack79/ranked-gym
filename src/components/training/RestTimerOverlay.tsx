import { createPortal } from 'react-dom'
import { Check, SkipForward, Timer } from 'lucide-react'
import type { RestPresetSec, RestTimerState } from '../../hooks/useRestTimer'
import { REST_PRESETS_SEC } from '../../hooks/useRestTimer'

/** Hauteur approx. BottomNav (hors safe-area) — îlot repos juste au-dessus. */
export const REST_BAR_NAV_CLEARANCE_PX = 76
/** Hauteur réservée au contenu Train pour ne pas masquer le bas de page. */
export const REST_BAR_CONTENT_PAD = '7.75rem'

interface RestTimerOverlayProps {
  state: RestTimerState
  onPreset: (sec: RestPresetSec) => void
  onSkip: () => void
  onDismiss: () => void
  alwaysVisible?: boolean
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function ringColor(remaining: number, total: number, idle: boolean): string {
  if (idle) return '#636366'
  const ratio = total > 0 ? remaining / total : 0
  if (remaining <= 10) return '#FF453A'
  if (ratio <= 0.35) return '#FF9F0A'
  return '#30D158'
}

/**
 * Îlot de repos fixed — collé juste au-dessus de la BottomNav (z-index 999).
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
  const ringSize = 44
  const stroke = 3.5
  const radius = (ringSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return createPortal(
    <div
      id="ranked-rest-timer-bar"
      className="pointer-events-none fixed inset-x-0 flex justify-center"
      style={{
        zIndex: 999,
        bottom: `calc(${REST_BAR_NAV_CLEARANCE_PX}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: 12,
        paddingRight: 12,
      }}
      aria-live="polite"
      role="timer"
      aria-label={idle ? 'Repos prêt à lancer' : `Repos ${formatClock(remaining)}`}
    >
      <div
        className={`pointer-events-auto rest-timer-island w-full max-w-md ${
          pulsing ? 'rest-timer-pulse' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 px-3 pt-2.5">
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
                stroke={idle ? '#30D158' : color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={idle ? circumference * 0.92 : dashOffset}
                style={{
                  transition: 'stroke-dashoffset 0.95s linear, stroke 0.35s ease',
                  opacity: idle ? 0.55 : 1,
                  filter: running ? `drop-shadow(0 0 5px ${color}77)` : undefined,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {finished ? (
                <Check className="h-3.5 w-3.5 text-[#30D158]" strokeWidth={2.75} />
              ) : idle ? (
                <Timer className="h-3.5 w-3.5 text-[#30D158]" strokeWidth={2.25} />
              ) : (
                <span className="text-[9px] font-bold tabular-nums text-white">
                  {Math.ceil(progress * 100)}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {finished ? (
              <p className="text-[15px] font-bold tracking-tight text-[#30D158]">Repos OK</p>
            ) : idle ? (
              <p className="text-[15px] font-bold tracking-tight text-white">Prêt à lancer</p>
            ) : (
              <p className="text-[22px] font-bold leading-none tracking-tight tabular-nums text-white">
                {formatClock(remaining)}
              </p>
            )}
            <p className="mt-0.5 truncate text-[10px] font-medium text-[#8E8E93]">
              {idle
                ? 'Repos · 45s · 90s · 180s'
                : state.target
                  ? `${state.target.exerciseName || 'Exercice'} · ${state.target.setLabel}`
                  : 'Repos en cours'}
            </p>
          </div>

          {running ? (
            <button
              type="button"
              onClick={onSkip}
              className="ios-press flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.07] px-3 py-2 text-[12px] font-semibold text-white"
            >
              <SkipForward className="h-3.5 w-3.5" strokeWidth={2.5} />
              Passer
            </button>
          ) : null}

          {finished ? (
            <button
              type="button"
              onClick={onDismiss}
              className="ios-press shrink-0 rounded-full border border-[#30D158]/40 bg-[#30D158]/18 px-3.5 py-2 text-[12px] font-semibold text-[#30D158]"
            >
              OK
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex gap-1.5 px-3 pb-2.5">
          {REST_PRESETS_SEC.map((sec) => {
            const active = running && state.totalSec === sec
            return (
              <button
                key={sec}
                type="button"
                onClick={() => onPreset(sec)}
                className={`ios-press flex-1 rounded-full border py-2 text-[12px] font-semibold tabular-nums transition-colors ${
                  active
                    ? 'border-[#30D158]/50 bg-[#30D158]/22 text-[#30D158]'
                    : 'border-white/10 bg-white/[0.04] text-[#D1D1D6] active:bg-[#30D158]/15 active:text-[#30D158]'
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
