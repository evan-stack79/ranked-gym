import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { getTodayWaterMl, setTodayWaterMl } from '../../services/nutritionStorage'

/** Capacité physique de la bouteille (ml). */
export const WATER_BOTTLE_CAPACITY_ML = 1500
const STEP_ML = 10
const HAPTIC_EVERY_ML = 50
/** Ignore accidental finger lift jitter under this many pixels. */
const RELEASE_DEADZONE_PX = 12

/** Graduations affichées (volume restant dans la bouteille). */
const GRADUATIONS_ML = [1250, 1000, 750, 500, 250] as const

interface SmartWaterGaugeProps {
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

function formatGradLabel(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return liters % 1 === 0 ? `${liters} L` : `${liters.toFixed(1)} L`
  }
  return `${ml}`
}

/**
 * Bouteille Cristaline 1,5 L — drag grossier + micro-ajustements ±10 ml.
 * Deadzone au relâchement pour éviter le saut de 10–20 ml.
 * Persistance Supabase uniquement via « Valider ».
 */
export function SmartWaterGauge(_props: SmartWaterGaugeProps) {
  const bottleRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const hapticBucketRef = useRef(0)
  const lastSampleRef = useRef({ y: 0, drunk: 0 })
  const savedDrunkRef = useRef(
    clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML)),
  )

  const [drunkMl, setDrunkMl] = useState(() =>
    clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML)),
  )
  const [dragging, setDragging] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  useEffect(() => {
    const sync = () => {
      const next = clampLevel(Math.min(getTodayWaterMl(), WATER_BOTTLE_CAPACITY_ML))
      savedDrunkRef.current = next
      setDrunkMl(next)
      setAwaitingConfirm(false)
    }
    window.addEventListener('ranked-gym:backup-restored', sync)
    return () => window.removeEventListener('ranked-gym:backup-restored', sync)
  }, [])

  const remainingMl = WATER_BOTTLE_CAPACITY_ML - drunkMl
  const remainingPct = (remainingMl / WATER_BOTTLE_CAPACITY_ML) * 100
  const drunkPct = (drunkMl / WATER_BOTTLE_CAPACITY_ML) * 100
  const dirty = awaitingConfirm && drunkMl !== savedDrunkRef.current

  const remainingFromClientY = useCallback(
    (clientY: number) => {
      const el = bottleRef.current
      if (!el) return remainingMl
      const rect = el.getBoundingClientRect()
      const ratio = 1 - (clientY - rect.top) / Math.max(rect.height, 1)
      return clampLevel(ratio * WATER_BOTTLE_CAPACITY_ML)
    },
    [remainingMl],
  )

  const drunkFromClientY = useCallback(
    (clientY: number) => clampLevel(WATER_BOTTLE_CAPACITY_ML - remainingFromClientY(clientY)),
    [remainingFromClientY],
  )

  const previewDrunk = useCallback((ml: number, clientY: number) => {
    const next = clampLevel(ml)
    lastSampleRef.current = { y: clientY, drunk: next }
    const bucket = Math.floor(next / HAPTIC_EVERY_ML)
    if (bucket !== hapticBucketRef.current) {
      hapticBucketRef.current = bucket
      hapticTick()
    }
    setDrunkMl(next)
  }, [])

  const persistDrunk = useCallback((ml: number) => {
    const next = clampLevel(ml)
    savedDrunkRef.current = next
    setDrunkMl(next)
    setAwaitingConfirm(false)
    setTodayWaterMl(next)
    hapticTick()
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    setAwaitingConfirm(false)
    hapticBucketRef.current = Math.floor(drunkMl / HAPTIC_EVERY_ML)
    const initial = drunkFromClientY(event.clientY)
    lastSampleRef.current = { y: event.clientY, drunk: initial }
    previewDrunk(initial, event.clientY)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    previewDrunk(drunkFromClientY(event.clientY), event.clientY)
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

    const { y: lastY, drunk: lastDrunk } = lastSampleRef.current
    const endY = event.clientY
    // Deadzone: ignore tiny lift jitter that would bump 10–20 ml
    const finalDrunk =
      Math.abs(endY - lastY) < RELEASE_DEADZONE_PX
        ? lastDrunk
        : drunkFromClientY(endY)

    const clamped = clampLevel(finalDrunk)
    setDrunkMl(clamped)
    if (clamped !== savedDrunkRef.current) {
      setAwaitingConfirm(true)
    } else {
      setAwaitingConfirm(false)
    }
  }

  const nudge = (delta: number) => {
    setDrunkMl((current) => {
      const next = clampLevel(current + delta)
      if (next !== savedDrunkRef.current) setAwaitingConfirm(true)
      else setAwaitingConfirm(false)
      return next
    })
    hapticTick()
  }

  const cancelDraft = () => {
    setDrunkMl(savedDrunkRef.current)
    setAwaitingConfirm(false)
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
          <span className="text-[22px] font-semibold tracking-tight text-white">
            {awaitingConfirm ? drunkMl : savedDrunkRef.current}
          </span>
          <span className="text-[#8E8E93]"> / {WATER_BOTTLE_CAPACITY_ML} ml bus</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative flex flex-col items-center">
          <div
            className="relative z-20 h-[14px] w-[34px] rounded-[7px] border border-white/25"
            style={{
              background:
                'linear-gradient(180deg, rgb(255 255 255 / 0.28) 0%, rgb(255 255 255 / 0.08) 100%)',
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.4), 0 2px 6px rgb(0 0 0 / 0.25)',
            }}
            aria-hidden
          />
          <div
            className="relative z-10 -mt-px h-3 w-[42px] rounded-[6px] border border-white/15"
            style={{
              background:
                'linear-gradient(180deg, rgb(255 255 255 / 0.14) 0%, rgb(255 255 255 / 0.04) 100%)',
            }}
            aria-hidden
          />
          <div className="water-bottle-shoulder relative z-10 -mt-px h-7 w-[72px]" aria-hidden />

          <div
            ref={bottleRef}
            className={`water-bottle-slim relative -mt-1 h-[320px] w-[88px] touch-none select-none overflow-hidden ${
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
            aria-label="Niveau d’eau — baisse pour boire (vide = 1,5 L)"
            tabIndex={0}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/22"
              style={{
                background:
                  'linear-gradient(160deg, rgb(255 255 255 / 0.18) 0%, rgb(255 255 255 / 0.05) 38%, rgb(255 255 255 / 0.02) 100%)',
                boxShadow:
                  'inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -10px 28px rgb(0 0 0 / 0.22), 0 14px 36px rgb(0 0 0 / 0.28)',
                backdropFilter: 'blur(16px)',
              }}
            />

            <div
              className="water-bottle-ridges pointer-events-none absolute inset-y-6 left-0 w-full"
              aria-hidden
            />

            <div
              className="pointer-events-none absolute left-[7px] top-10 bottom-12 w-[3px] rounded-full opacity-50"
              style={{
                background: 'linear-gradient(180deg, rgb(255 255 255 / 0.65), transparent 85%)',
              }}
              aria-hidden
            />

            <div
              className="water-bottle-fill absolute inset-x-0 bottom-0 mx-[2px] mb-[2px] overflow-hidden rounded-b-[26px]"
              style={{
                height: `${remainingPct}%`,
                maxHeight: 'calc(100% - 4px)',
                transition: dragging
                  ? 'height 70ms linear'
                  : 'height 420ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              <div className="water-bottle-liquid absolute inset-0" />
              <div className="water-bottle-meniscus absolute inset-x-0 top-0 h-3.5" />
            </div>

            <div className="pointer-events-none absolute inset-x-0 inset-y-3 z-10">
              {GRADUATIONS_ML.map((mark) => {
                const fromBottom = (mark / WATER_BOTTLE_CAPACITY_ML) * 100
                return (
                  <div
                    key={mark}
                    className="absolute right-0 left-0 flex items-center justify-between px-2"
                    style={{ bottom: `${fromBottom}%`, transform: 'translateY(50%)' }}
                  >
                    <span className="h-px w-2.5 rounded-full bg-white/25" />
                    <span className="text-[8px] font-medium tabular-nums tracking-wide text-white/35">
                      {formatGradLabel(mark)}
                    </span>
                    <span className="h-px w-2.5 rounded-full bg-white/25" />
                  </div>
                )
              })}
            </div>

            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
                Bu
              </p>
              <p
                className={`mt-0.5 text-[28px] font-semibold tracking-tight tabular-nums text-white transition-transform duration-200 ${
                  dragging ? 'scale-105' : 'scale-100'
                }`}
                style={{ textShadow: '0 2px 14px rgb(0 0 0 / 0.5)' }}
              >
                {drunkMl}
              </p>
              <p className="text-[12px] font-medium text-white/75">ml</p>
            </div>
          </div>

          <div
            className="relative -mt-px h-3 w-[78px] rounded-b-[14px] border border-t-0 border-white/12"
            style={{
              background:
                'linear-gradient(180deg, rgb(255 255 255 / 0.06) 0%, rgb(255 255 255 / 0.02) 100%)',
            }}
            aria-hidden
          />
        </div>

        <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7DD3FC] to-[#38BDF8]"
            style={{
              width: `${drunkPct}%`,
              transition: dragging
                ? 'width 70ms linear'
                : 'width 420ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          />
        </div>

        {dirty ? (
          <div className="water-validate-bar w-full max-w-[320px] space-y-2">
            <div
              className="flex items-center gap-2 rounded-2xl border border-white/12 p-1.5"
              style={{
                background: 'rgb(28 28 30 / 0.88)',
                backdropFilter: 'blur(18px)',
                boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
              }}
            >
              <button
                type="button"
                onClick={() => nudge(-STEP_ML)}
                disabled={drunkMl <= 0}
                className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-white disabled:opacity-35"
                aria-label="Retirer 10 ml"
              >
                <Minus className="h-4 w-4" strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={() => persistDrunk(drunkMl)}
                className="ios-press flex min-w-0 flex-1 items-center justify-center rounded-xl border border-[#38BDF8]/35 bg-[#38BDF8]/18 px-3 py-3 text-[15px] font-semibold text-white"
              >
                Valider {drunkMl} ml
              </button>

              <button
                type="button"
                onClick={() => nudge(STEP_ML)}
                disabled={drunkMl >= WATER_BOTTLE_CAPACITY_ML}
                className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-white disabled:opacity-35"
                aria-label="Ajouter 10 ml"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <button
              type="button"
              onClick={cancelDraft}
              className="ios-press w-full rounded-xl py-2 text-[12px] font-medium text-[#8E8E93]"
            >
              Annuler
            </button>
          </div>
        ) : (
          <p className="max-w-[260px] text-center text-[13px] leading-relaxed text-[#8E8E93]">
            Glisse pour ajuster, puis affine avec − / + avant de valider.
          </p>
        )}
      </div>
    </section>
  )
}
