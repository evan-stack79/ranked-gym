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
 * Bouteille iOS — le niveau d’eau restant est l’inverse de ce que tu as bu :
 * bouteille pleine = 0 ml bus · bouteille vide = 1500 ml bus.
 * Sauvegarde Supabase uniquement au relâchement.
 */
export function SmartWaterGauge(_props: SmartWaterGaugeProps) {
  const bottleRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const hapticBucketRef = useRef(0)
  const savedDrunkRef = useRef(
    clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML)),
  )

  const [drunkMl, setDrunkMl] = useState(() =>
    clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML)),
  )
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const sync = () => {
      const next = clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML))
      savedDrunkRef.current = next
      setDrunkMl(next)
    }
    window.addEventListener('ranked-gym:backup-restored', sync)
    return () => window.removeEventListener('ranked-gym:backup-restored', sync)
  }, [])

  const remainingMl = WATER_BOTTLE_CAPACITY_ML - drunkMl
  const remainingPct = (remainingMl / WATER_BOTTLE_CAPACITY_ML) * 100
  const drunkPct = (drunkMl / WATER_BOTTLE_CAPACITY_ML) * 100

  /** Y → eau encore dans la bouteille (haut = plein). */
  const remainingFromClientY = useCallback((clientY: number) => {
    const el = bottleRef.current
    if (!el) return remainingMl
    const rect = el.getBoundingClientRect()
    const ratio = 1 - (clientY - rect.top) / Math.max(rect.height, 1)
    return clampLevel(ratio * WATER_BOTTLE_CAPACITY_ML)
  }, [remainingMl])

  const drunkFromClientY = useCallback(
    (clientY: number) => clampLevel(WATER_BOTTLE_CAPACITY_ML - remainingFromClientY(clientY)),
    [remainingFromClientY],
  )

  const previewDrunk = useCallback((ml: number) => {
    const next = clampLevel(ml)
    const bucket = Math.floor(next / HAPTIC_EVERY_ML)
    if (bucket !== hapticBucketRef.current) {
      hapticBucketRef.current = bucket
      hapticTick()
    }
    setDrunkMl(next)
  }, [])

  const persistDrunk = useCallback((ml: number) => {
    const next = clampLevel(ml)
    if (next === savedDrunkRef.current) {
      setDrunkMl(next)
      return
    }
    savedDrunkRef.current = next
    setDrunkMl(next)
    setTodayWaterMl(next)
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    hapticBucketRef.current = Math.floor(drunkMl / HAPTIC_EVERY_ML)
    previewDrunk(drunkFromClientY(event.clientY))
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    previewDrunk(drunkFromClientY(event.clientY))
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
    persistDrunk(drunkFromClientY(event.clientY))
  }

  const onRangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDrunkMl(clampLevel(Number(event.target.value)))
  }

  const onRangeCommit = () => {
    persistDrunk(drunkMl)
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
          <span className="text-[22px] font-semibold tracking-tight text-white">{drunkMl}</span>
          <span className="text-[#8E8E93]"> / {WATER_BOTTLE_CAPACITY_ML} ml bus</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative flex flex-col items-center">
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
            aria-valuenow={drunkMl}
            aria-label="Volume d’eau bu (bouteille vide = 1,5 L bus)"
            tabIndex={0}
          >
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

            <div
              className="pointer-events-none absolute left-3 top-8 bottom-10 w-3 rounded-full opacity-40"
              style={{
                background: 'linear-gradient(180deg, rgb(255 255 255 / 0.55), transparent)',
              }}
              aria-hidden
            />

            {/* Eau restante dans la bouteille (inverse de ce qui est bu) */}
            <div
              className="water-bottle-fill absolute inset-x-0 bottom-0 mx-[3px] mb-[3px] overflow-hidden rounded-b-[39px]"
              style={{
                height: `${remainingPct}%`,
                maxHeight: 'calc(100% - 6px)',
                transition: dragging
                  ? 'height 80ms linear'
                  : 'height 520ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              <div className="water-bottle-liquid absolute inset-0" />
              <div className="water-bottle-meniscus absolute inset-x-0 top-0 h-4" />
            </div>

            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Bu
              </p>
              <p
                className={`text-[34px] font-semibold tracking-tight tabular-nums text-white transition-transform duration-200 ${
                  dragging ? 'scale-105' : 'scale-100'
                }`}
                style={{ textShadow: '0 2px 12px rgb(0 0 0 / 0.45)' }}
              >
                {drunkMl}
              </p>
              <p className="text-[13px] font-medium text-white/80">ml</p>
            </div>

            <input
              type="range"
              min={0}
              max={WATER_BOTTLE_CAPACITY_ML}
              step={STEP_ML}
              value={drunkMl}
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

        <p className="max-w-[260px] text-center text-[13px] leading-relaxed text-[#8E8E93]">
          Baisse le niveau comme une vraie bouteille : vide = tu as bu 1,5&nbsp;L. Sauvegarde au
          relâchement.
        </p>

        <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7DD3FC] to-[#38BDF8]"
            style={{
              width: `${drunkPct}%`,
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
