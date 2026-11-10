import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  GOAL_DEFAULT_ML,
  GOAL_MAX_ML,
  GOAL_MIN_ML,
  GOAL_STEP_ML,
  MSG_GOAL_RANGE,
  MSG_MEDICAL_LIMIT,
  MSG_PERMANENT,
  MSG_PREGNANCY,
  clampGoalMl,
  formatLitersFr,
} from '../../shared/hydration'

interface WaterGoalColumnProps {
  valueMl: number
  onChange: (goalMl: number) => void
  disabled?: boolean
  /** Notifie le parent pour bloquer scroll / dismiss de la feuille. */
  onDraggingChange?: (dragging: boolean) => void
}

function mlFromClientY(clientY: number, rect: DOMRect): number {
  const t = Math.min(1, Math.max(0, (rect.bottom - clientY) / Math.max(1, rect.height)))
  const raw = GOAL_MIN_ML + t * (GOAL_MAX_ML - GOAL_MIN_ML)
  return clampGoalMl(Math.round(raw / GOAL_STEP_ML) * GOAL_STEP_ML)
}

function handleClientY(valueMl: number, rect: DOMRect): number {
  const safe = clampGoalMl(valueMl)
  const fillRatio = (safe - GOAL_MIN_ML) / Math.max(1, GOAL_MAX_ML - GOAL_MIN_ML)
  return rect.bottom - fillRatio * rect.height
}

/**
 * Curseur vertical type colonne d’eau (1–3 L) + bulle « i » santé.
 * Centré ; drag sans saut (offset au premier contact) ; touch-action none.
 */
export function WaterGoalColumn({
  valueMl,
  onChange,
  disabled,
  onDraggingChange,
}: WaterGoalColumnProps) {
  const safe = clampGoalMl(valueMl || GOAL_DEFAULT_ML)
  const fillPct =
    ((safe - GOAL_MIN_ML) / Math.max(1, GOAL_MAX_ML - GOAL_MIN_ML)) * 100
  const trackRef = useRef<HTMLDivElement>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const dragging = useRef(false)
  const grabOffset = useRef(0)
  const valueRef = useRef(safe)

  const apply = useCallback(
    (clientY: number) => {
      if (!trackRef.current || disabled) return
      const next = mlFromClientY(clientY, trackRef.current.getBoundingClientRect())
      if (next !== valueRef.current) {
        valueRef.current = next
        onChange(next)
      }
    },
    [disabled, onChange],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    valueRef.current = safe
    // Pas de saut : on ancre le doigt sur la poignée actuelle.
    grabOffset.current = e.clientY - handleClientY(safe, rect)
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onDraggingChange?.(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    e.preventDefault()
    e.stopPropagation()
    apply(e.clientY - grabOffset.current)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    e.preventDefault()
    e.stopPropagation()
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    onDraggingChange?.(false)
  }

  return (
    <div
      data-hydration-goal-column
      className="mx-auto flex w-full max-w-[280px] flex-col items-center"
    >
      <div className="flex items-start justify-center gap-2">
        <div
          ref={trackRef}
          role="slider"
          aria-label="Objectif d’eau quotidienne"
          aria-valuemin={GOAL_MIN_ML}
          aria-valuemax={GOAL_MAX_ML}
          aria-valuenow={safe}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
              e.preventDefault()
              onChange(clampGoalMl(safe + GOAL_STEP_ML))
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
              e.preventDefault()
              onChange(clampGoalMl(safe - GOAL_STEP_ML))
            }
          }}
          className="relative h-[200px] w-24 shrink-0 touch-none overflow-hidden rounded-[32px] border border-white/10 bg-[#25282A]"
          style={{ touchAction: 'none' }}
          data-hydration-goal-slider
        >
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: `${fillPct}%`,
              background:
                'linear-gradient(to top, rgba(40,120,205,0.92), rgba(120,200,245,0.78))',
            }}
          />
          <div
            className="absolute left-1/2 h-3 w-14 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
            style={{ bottom: `${fillPct}%` }}
            aria-hidden
          />
        </div>
        <div className="flex h-[200px] shrink-0 flex-col justify-between py-3.5 text-[12px] tabular-nums text-[#8E8E93]">
          <span>3 L</span>
          <span>1 L</span>
        </div>
      </div>

      <div className="relative mt-3 w-full min-w-0 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-[15px] font-semibold text-white">Objectif</span>
          <button
            type="button"
            aria-label="Informations santé hydratation"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((v) => !v)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              infoOpen ? 'bg-[#FF0702] text-white' : 'bg-[#3A3A3C] text-[#ACB4BA]'
            }`}
            data-hydration-goal-info
          >
            i
          </button>
        </div>
        <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.03em] tabular-nums text-white">
          {formatLitersFr(safe).replace(' L', '')}&nbsp;L
        </p>
        <p className="mt-1 text-[12px] text-[#8E8E93]">Glisse pour régler.</p>

        {infoOpen ? (
          <div
            className="absolute left-0 right-0 top-7 z-20 rounded-2xl border border-white/10 bg-[#2C3032] p-3.5 text-left shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
            data-hydration-goal-info-bubble
            role="dialog"
            aria-label="Mentions santé"
          >
            <p className="text-[12px] leading-snug text-[#C7C7CC]">{MSG_PERMANENT}</p>
            <p className="mt-2 text-[12px] leading-snug text-[#C7C7CC]">{MSG_GOAL_RANGE}</p>
            <p className="mt-2 text-[12px] leading-snug text-[#C7C7CC]">{MSG_PREGNANCY}</p>
            <p className="mt-2 text-[12px] leading-snug text-[#C7C7CC]">{MSG_MEDICAL_LIMIT}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Exposé pour tests — ml depuis Y relatif à la piste. */
export { mlFromClientY, handleClientY }
