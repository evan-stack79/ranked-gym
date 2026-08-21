import { useCallback, useEffect, useRef, useState } from 'react'
import { getTodayWaterMl, setTodayWaterMl } from '../../services/nutritionStorage'

/** Capacité physique de la bouteille (ml). */
export const WATER_BOTTLE_CAPACITY_ML = 1500
const STEP_ML = 10
const HAPTIC_EVERY_ML = 50

interface SmartWaterGaugeProps {
  /** Conservé pour compat — l’objectif UI est fixé à 1500 ml (bouteille). */
  weightKg?: number
}

function clampLevel(ml: number): number {
  const stepped = Math.round(ml / STEP_ML) * STEP_ML
  return Math.min(WATER_BOTTLE_CAPACITY_ML, Math.max(0, stepped))
}

function hapticTick() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8)
    }
  } catch {
    // unsupported
  }
}

/**
 * Bouteille iOS glassmorphism — glisse haut/bas pour régler le niveau.
 * Persistance Supabase (via nutrition.journal.waterMl) uniquement au relâchement.
 */
export function SmartWaterGauge(_props: SmartWaterGaugeProps) {
  const bottleRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const hapticBucketRef = useRef(0)
  const savedMlRef = useRef(getTodayWaterMl())

  const [levelMl, setLevelMl] = useState(() =>
    clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML)),
  )
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const sync = () => {
      const next = clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML))
      savedMlRef.current = next
      setLevelMl(next)
    }
    window.addEventListener('ranked-gym:backup-restored', sync)
    return () => window.removeEventListener('ranked-gym:backup-restored', sync)
  }, [])

  const fillPct = (levelMl / WATER_BOTTLE_CAPACITY_ML) * 100

  const mlFromClientY = useCallback((clientY: number) => {
    const el = bottleRef.current
    if (!el) return levelMl
    const rect = el.getBoundingClientRect()
    // Haut de la bouteille = plein, bas = vide (comme une vraie bouteille)
    const ratio = 1 - (clientY - rect.top) / Math.max(rect.height, 1)
    return clampLevel(ratio * WATER_BOTTLE_CAPACITY_ML)
  }, [levelMl])

  const previewLevel = useCallback((ml: number) => {
    const next = clampLevel(ml)
    const bucket = Math.floor(next / HAPTIC_EVERY_ML)
    if (bucket !== hapticBucketRef.current) {
      hapticBucketRef.current = bucket
      hapticTick()
    }
    setLevelMl(next)
  }, [])

  const persistLevel = useCallback((ml: number) => {
    const next = clampLevel(ml)
    if (next === savedMlRef.current) {
      setLevelMl(next)
      return
    }
    savedMlRef.current = next
    setLevelMl(next)
    setTodayWaterMl(next) // → local + cloud backup (Supabase) debounced
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    hapticBucketRef.current = Math.floor(levelMl / HAPTIC_EVERY_ML)
    previewLevel(mlFromClientY(event.clientY))
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    previewLevel(mlFromClientY(event.clientY))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // already released
    }
    setDragging(false)
    const finalMl = mlFromClientY(event.clientY)
    persistLevel(finalMl)
  }

  /** Accessible fallback — same absolute level model, save on change end. */
  const onRangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = clampLevel(Number(event.target.value))
    setLevelMl(next)
  }

  const onRangeCommit = () => {
    persistLevel(levelMl)
  }

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-white/12 px-5 py-5"
      style={{
        background: 'rgb(255 255 255 / 0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.1)',
      }}
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8E8E93]">
            Hydratation
          </p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-white">Eau</h2>
        </div>
        <p className="text-right text-[15px] font-medium tabular-nums text-[#AEAEB2]">
          <span className="text-[22px] font-semibold tracking-tight text-white">{levelMl}</span>
          <span className="text-[#8E8E93]"> / {WATER_BOTTLE_CAPACITY_ML} ml</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Bottle */}
        <div className="relative flex flex-col items-center">
          {/* Cap / neck */}
          <div
            className="relative z-10 h-4 w-11 rounded-t-[10px] border border-white/20"
            style={{
              background: 'linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0.06))',
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.35)',
            }}
            aria-hidden
          />
          <div
            className="relative z-10 -mt-px h-5 w-[52px] rounded-[8px] border border-white/15"
            style={{
              background: 'linear-gradient(180deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.04))',
            }}
            aria-hidden
          />

          {/* Body — glass bottle */}
          <div
            ref={bottleRef}
            className={`water-bottle relative mt-[-2px] h-[260px] w-[124px] touch-none select-none overflow-hidden ${
              dragging ? 'water-bottle--active' : ''
            }`}
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={WATER_BOTTLE_CAPACITY_ML}
            aria-valuenow={levelMl}
            aria-label="Niveau d’eau dans la bouteille"
            tabIndex={0}
          >
            {/* Glass shell */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[42px] border border-white/25"
              style={{
                background:
                  'linear-gradient(145deg, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0.04) 40%, rgb(255 255 255 / 0.02) 100%)',
                boxShadow:
                  'inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -8px 24px rgb(0 0 0 / 0.2), 0 12px 40px rgb(0 0 0 / 0.25)',
                backdropFilter: 'blur(18px)',
              }}
            />

            {/* Specular highlight */}
            <div
              className="pointer-events-none absolute left-3 top-8 bottom-10 w-3 rounded-full opacity-40"
              style={{
                background: 'linear-gradient(180deg, rgb(255 255 255 / 0.55), transparent)',
              }}
              aria-hidden
            />

            {/* Water fill */}
            <div
              className="water-bottle-fill absolute inset-x-0 bottom-0 mx-[3px] mb-[3px] overflow-hidden rounded-b-[39px]"
              style={{
                height: `calc(${fillPct}% - 0px)`,
                maxHeight: 'calc(100% - 6px)',
                transition: dragging
                  ? 'height 80ms linear'
                  : 'height 520ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              <div className="water-bottle-liquid absolute inset-0" />
              <div className="water-bottle-meniscus absolute inset-x-0 top-0 h-4" />
            </div>

            {/* Center readout */}
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-3 text-center">
              <p
                className={`text-[34px] font-semibold tracking-tight tabular-nums text-white transition-transform duration-200 ${
                  dragging ? 'scale-105' : 'scale-100'
                }`}
                style={{ textShadow: '0 2px 12px rgb(0 0 0 / 0.45)' }}
              >
                {levelMl}
              </p>
              <p className="text-[13px] font-medium text-white/80">ml</p>
            </div>

            {/* Invisible vertical range for a11y / trackpads */}
            <input
              type="range"
              min={0}
              max={WATER_BOTTLE_CAPACITY_ML}
              step={STEP_ML}
              value={levelMl}
              onChange={onRangeInput}
              onMouseUp={onRangeCommit}
              onTouchEnd={onRangeCommit}
              onKeyUp={onRangeCommit}
              className="water-bottle-range absolute inset-0 z-20 h-full w-full cursor-ns-resize opacity-0"
              aria-hidden
              tabIndex={-1}
            />
          </div>
        </div>

        <p className="max-w-[240px] text-center text-[13px] leading-relaxed text-[#8E8E93]">
          Glisse sur la bouteille pour ajuster le niveau. La sauvegarde se fait au relâchement.
        </p>

        <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7DD3FC] to-[#38BDF8]"
            style={{
              width: `${fillPct}%`,
              transition: dragging
                ? 'width 80ms linear'
                : 'width 520ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          />
        </div>
      </div>
    </section>
  )
}
