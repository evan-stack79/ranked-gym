import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Check, ChevronUp, SkipForward, Timer } from 'lucide-react'
import type { RestPresetSec, RestTimerState } from '../../context/RestTimerContext'
import { REST_PRESETS_SEC } from '../../context/RestTimerContext'

/** Clearance scroll quand l’îlot repos est visible (CSS var). */
export const REST_BAR_CONTENT_PAD = 'var(--rest-content-clearance)'

const REST_ISLAND_H_VAR = '--rest-island-h'

interface RestTimerOverlayProps {
  state: RestTimerState
  onPreset: (sec: RestPresetSec) => void
  onSkip: () => void
  onDismiss: () => void
  /** Affiche l’îlot « Prêt à lancer » (Train muscu uniquement). */
  showReadyBar?: boolean
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
 * Publie la hauteur réelle de l’îlot dans `--rest-island-h` pour la clearance scroll.
 * Quand l’îlot est masqué, restaure le fallback CSS (:root).
 */
function useRestIslandClearance(
  active: boolean,
  expanded: boolean,
  modeKey: string,
): RefObject<HTMLDivElement | null> {
  const islandRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!active) {
      document.documentElement.style.removeProperty(REST_ISLAND_H_VAR)
      return
    }

    const el = islandRef.current
    if (!el) return

    const publish = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      if (h > 0) {
        document.documentElement.style.setProperty(REST_ISLAND_H_VAR, `${h}px`)
      }
    }

    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty(REST_ISLAND_H_VAR)
    }
  }, [active, expanded, modeKey])

  return islandRef
}

/**
 * Îlot repos fixed — ancré au-dessus de la BottomNav (layout racine).
 * Compact par défaut (pill idle / barre active) ; presets dépliables au toucher.
 * Clearance = hauteur mesurée (évite le chevauchement presets dépliés).
 */
export function RestTimerOverlay({
  state,
  onPreset,
  onSkip,
  onDismiss,
  showReadyBar = false,
}: RestTimerOverlayProps) {
  const [expanded, setExpanded] = useState(false)

  const running = state.active
  const finished = state.finished
  const idle = !running && !finished
  const sessionVisible = running || finished
  const visible = sessionVisible || (showReadyBar && idle)
  const wasSessionRef = useRef(false)
  const modeKey = idle ? 'idle' : finished ? 'finished' : 'running'
  const islandRef = useRestIslandClearance(visible, expanded, modeKey)

  // Replier à la fin d’un cycle repos (retour idle), sans combattre le dépliage idle.
  useEffect(() => {
    if (running || finished) {
      wasSessionRef.current = true
      return
    }
    if (wasSessionRef.current && idle) {
      setExpanded(false)
      wasSessionRef.current = false
    }
  }, [running, finished, idle])

  // Tous onglets : décompte ou « Repos OK ». Train : aussi barre prête.
  if (!visible) return null

  const total = Math.max(1, state.totalSec || 90)
  const remaining = finished ? 0 : running ? state.remainingSec : 0
  const progress = idle ? 0 : Math.min(1, Math.max(0, remaining / total))
  const color = ringColor(remaining, total, idle)
  const pulsing = running && remaining > 0 && remaining <= 10
  const ringSize = 32
  const stroke = 2.75
  const radius = (ringSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const ariaLabel = idle
    ? expanded
      ? 'Repos — choisir une durée'
      : 'Repos — toucher pour lancer'
    : `Repos ${formatClock(remaining)}`

  // ——— Idle compact : simple pill « Repos » ———
  if (idle) {
    return (
      <div
        id="ranked-rest-timer-bar"
        className="rest-timer-dock"
        data-compact={expanded ? 'false' : 'true'}
        aria-live="polite"
        role="timer"
        aria-label={ariaLabel}
      >
        <div
          ref={islandRef}
          className={`rest-timer-island rest-timer-island--compact ${pulsing ? 'rest-timer-pulse' : ''}`}
        >
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ios-press flex w-full items-center justify-center gap-2 px-4 py-2.5"
            aria-expanded={expanded}
          >
            <Timer className="h-4 w-4 text-[#30D158]" strokeWidth={2.25} />
            <span className="text-[14px] font-semibold text-white">Repos</span>
            <ChevronUp
              className={`h-3.5 w-3.5 text-[#8E8E93] transition-transform ${expanded ? '' : 'rotate-180'}`}
              strokeWidth={2.5}
            />
          </button>

          {expanded ? (
            <div className="flex gap-1.5 border-t border-white/8 px-3 pb-2.5 pt-2">
              {REST_PRESETS_SEC.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    onPreset(sec)
                    setExpanded(false)
                  }}
                  className="ios-press flex-1 rounded-full border border-white/10 bg-white/[0.04] py-1.5 text-[12px] font-semibold tabular-nums text-[#D1D1D6] active:border-[#30D158]/50 active:bg-[#30D158]/15 active:text-[#30D158]"
                >
                  {sec}s
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  // ——— Actif / terminé : barre compacte + presets dépliables ———
  return (
    <div
      id="ranked-rest-timer-bar"
      className="rest-timer-dock"
      data-compact={expanded ? 'false' : 'true'}
      aria-live="polite"
      role="timer"
      aria-label={ariaLabel}
    >
      <div
        ref={islandRef}
        className={`rest-timer-island rest-timer-island--compact ${pulsing ? 'rest-timer-pulse' : ''}`}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ios-press flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={expanded}
          >
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
                    filter: running ? `drop-shadow(0 0 5px ${color}77)` : undefined,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {finished ? (
                  <Check className="h-3 w-3 text-[#30D158]" strokeWidth={2.75} />
                ) : (
                  <span className="text-[8px] font-bold tabular-nums text-white">
                    {Math.ceil(progress * 100)}
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              {finished ? (
                <p className="text-[14px] font-bold tracking-tight text-[#30D158]">Repos OK</p>
              ) : (
                <p className="text-[17px] font-bold leading-none tracking-tight tabular-nums text-white">
                  {formatClock(remaining)}
                </p>
              )}
              <p className="mt-0.5 truncate text-[10px] font-medium text-[#8E8E93]">
                {state.target
                  ? `${state.target.exerciseName || 'Exercice'} · ${state.target.setLabel}`
                  : 'Repos en cours'}
              </p>
            </div>

            <ChevronUp
              className={`h-3.5 w-3.5 shrink-0 text-[#8E8E93] transition-transform ${expanded ? '' : 'rotate-180'}`}
              strokeWidth={2.5}
            />
          </button>

          {running ? (
            <button
              type="button"
              onClick={onSkip}
              className="ios-press flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-semibold text-white"
            >
              <SkipForward className="h-3 w-3" strokeWidth={2.5} />
              Passer
            </button>
          ) : null}

          {finished ? (
            <button
              type="button"
              onClick={onDismiss}
              className="ios-press shrink-0 rounded-full border border-[#30D158]/40 bg-[#30D158]/18 px-3 py-1.5 text-[11px] font-semibold text-[#30D158]"
            >
              OK
            </button>
          ) : null}
        </div>

        {expanded ? (
          <div className="flex gap-1.5 border-t border-white/8 px-3 pb-2.5 pt-2">
            {REST_PRESETS_SEC.map((sec) => {
              const active = running && state.totalSec === sec
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    onPreset(sec)
                    setExpanded(false)
                  }}
                  className={`ios-press flex-1 rounded-full border py-1.5 text-[12px] font-semibold tabular-nums transition-colors ${
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
        ) : null}
      </div>
    </div>
  )
}
