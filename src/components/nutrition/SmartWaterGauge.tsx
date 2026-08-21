import { useCallback, useEffect, useRef, useState } from 'react'
import { CupSoda, Droplets, FlaskConical } from 'lucide-react'
import type { WaterPresetsCount } from '../../types/nutrition'
import {
  applyWaterPresetDelta,
  getTodayWaterMl,
  getTodayWaterPresetsCount,
  MAX_DAILY_WATER_ML,
  setTodayWaterMl,
} from '../../services/nutritionStorage'

/** Capacité physique d’une bouteille (ml) — UI jauge. */
export const WATER_BOTTLE_CAPACITY_ML = 1500
const STEP_ML = 10
const HAPTIC_EVERY_ML = 50
const RELEASE_DEADZONE_PX = 18
const RELEASE_JITTER_MS = 70
const LONG_PRESS_MS = 480
const LONG_PRESS_MOVE_PX = 12

const GRADUATIONS_ML = [1250, 1000, 750, 500, 250] as const

export type WaterPresetId = 'glass' | 'shaker' | 'bottle'

export const WATER_SMART_PRESETS: ReadonlyArray<{
  id: WaterPresetId
  label: string
  detail: string
  ml: number
  Icon: typeof Droplets
}> = [
  { id: 'glass', label: 'Verre', detail: '250 ml', ml: 250, Icon: CupSoda },
  { id: 'shaker', label: 'Shaker', detail: '500 ml', ml: 500, Icon: FlaskConical },
  { id: 'bottle', label: 'Bouteille', detail: '1,5 L', ml: 1500, Icon: Droplets },
]

interface SmartWaterGaugeProps {
  weightKg?: number
}

type DragSample = { y: number; t: number; visual: number }

/** Clamp du niveau dans une bouteille (0–1,5 L). */
function clampBottle(ml: number): number {
  const stepped = Math.round(ml / STEP_ML) * STEP_ML
  return Math.min(WATER_BOTTLE_CAPACITY_ML, Math.max(0, stepped))
}

/** Clamp du total journalier (plusieurs contenants). */
function clampDaily(ml: number): number {
  const stepped = Math.round(ml / STEP_ML) * STEP_ML
  return Math.min(MAX_DAILY_WATER_ML, Math.max(0, stepped))
}

/** Portion bue dans la bouteille « en cours » (mod 1,5 L). */
function bottleVisualDrunk(totalMl: number): number {
  const t = Math.max(0, totalMl)
  if (t === 0) return 0
  const mod = t % WATER_BOTTLE_CAPACITY_ML
  return mod === 0 ? WATER_BOTTLE_CAPACITY_ML : mod
}

function bottleBaseMl(totalMl: number): number {
  return Math.max(0, totalMl - bottleVisualDrunk(totalMl))
}

function hapticTick(ms = 8) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
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

function resolveReleaseVisual(samples: DragSample[]): number | null {
  if (samples.length === 0) return null
  let endIdx = samples.length - 1
  const tEnd = samples[endIdx].t
  while (endIdx > 0) {
    const current = samples[endIdx]
    const prev = samples[endIdx - 1]
    const withinWindow = tEnd - prev.t <= RELEASE_JITTER_MS
    const smallTwitch = Math.abs(current.y - prev.y) < RELEASE_DEADZONE_PX
    if (withinWindow && smallTwitch) {
      endIdx -= 1
      continue
    }
    break
  }
  return samples[endIdx].visual
}

/**
 * Bouteille Cristaline + presets « mémoire des contenants » (badges ×N).
 * Tap = +1 contenant · long-press = −1. Sync via nutrition.journal (Supabase).
 */
export function SmartWaterGauge(_props: SmartWaterGaugeProps) {
  const bottleRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const hapticBucketRef = useRef(0)
  const samplesRef = useRef<DragSample[]>([])
  const bottleBaseRef = useRef(0)
  const savedDrunkRef = useRef(clampDaily(getTodayWaterMl()))

  const [drunkMl, setDrunkMl] = useState(() => clampDaily(getTodayWaterMl()))
  const [dragging, setDragging] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [presetCounts, setPresetCounts] = useState<WaterPresetsCount>(() =>
    getTodayWaterPresetsCount(),
  )

  const syncFromStorage = useCallback(() => {
    const next = clampDaily(getTodayWaterMl())
    savedDrunkRef.current = next
    setDrunkMl(next)
    setAwaitingConfirm(false)
    setPresetCounts(getTodayWaterPresetsCount())
  }, [])

  useEffect(() => {
    window.addEventListener('ranked-gym:backup-restored', syncFromStorage)
    return () => window.removeEventListener('ranked-gym:backup-restored', syncFromStorage)
  }, [syncFromStorage])

  const displayTotal = awaitingConfirm || dragging ? drunkMl : savedDrunkRef.current
  const visualDrunk = bottleVisualDrunk(drunkMl)
  const remainingMl = WATER_BOTTLE_CAPACITY_ML - visualDrunk
  const remainingPct = (remainingMl / WATER_BOTTLE_CAPACITY_ML) * 100
  const progressPct = Math.min(100, (displayTotal / WATER_BOTTLE_CAPACITY_ML) * 100)
  const showConfirmBar = awaitingConfirm
  const fullBottlesToday = Math.floor(displayTotal / WATER_BOTTLE_CAPACITY_ML)

  const visualFromClientY = useCallback((clientY: number) => {
    const el = bottleRef.current
    if (!el) return visualDrunk
    const rect = el.getBoundingClientRect()
    const ratio = 1 - (clientY - rect.top) / Math.max(rect.height, 1)
    const remaining = clampBottle(ratio * WATER_BOTTLE_CAPACITY_ML)
    return clampBottle(WATER_BOTTLE_CAPACITY_ML - remaining)
  }, [visualDrunk])

  const pushSample = useCallback((clientY: number, visual: number) => {
    const sample: DragSample = {
      y: clientY,
      t: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      visual: clampBottle(visual),
    }
    const next = samplesRef.current.concat(sample)
    samplesRef.current = next.length > 16 ? next.slice(-16) : next
  }, [])

  const previewTotal = useCallback(
    (visual: number, clientY: number) => {
      const v = clampBottle(visual)
      pushSample(clientY, v)
      const total = clampDaily(bottleBaseRef.current + v)
      const bucket = Math.floor(v / HAPTIC_EVERY_ML)
      if (bucket !== hapticBucketRef.current) {
        hapticBucketRef.current = bucket
        hapticTick()
      }
      setDrunkMl(total)
    },
    [pushSample],
  )

  const persistDrunk = useCallback((ml: number) => {
    const next = clampDaily(ml)
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
    samplesRef.current = []
    const startTotal = savedDrunkRef.current
    bottleBaseRef.current = bottleBaseMl(startTotal)
    const initialVisual = visualFromClientY(event.clientY)
    hapticBucketRef.current = Math.floor(initialVisual / HAPTIC_EVERY_ML)
    previewTotal(initialVisual, event.clientY)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    previewTotal(visualFromClientY(event.clientY), event.clientY)
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

    const samples = samplesRef.current
    const last = samples[samples.length - 1]
    const endY = event.clientY
    const liftDeltaPx = last ? Math.abs(endY - last.y) : Number.POSITIVE_INFINITY
    const fromHistory = resolveReleaseVisual(samples)
    const finalVisual =
      liftDeltaPx < RELEASE_DEADZONE_PX
        ? (fromHistory ?? last?.visual ?? bottleVisualDrunk(drunkMl))
        : fromHistory !== null && liftDeltaPx < RELEASE_DEADZONE_PX * 1.5
          ? fromHistory
          : visualFromClientY(endY)

    const clamped = clampDaily(bottleBaseRef.current + clampBottle(finalVisual))
    setDrunkMl(clamped)
    setAwaitingConfirm(true)
  }

  const nudge = (delta: number) => {
    setDrunkMl((current) => {
      const next = clampDaily(current + delta)
      setAwaitingConfirm(true)
      return next
    })
    hapticTick()
  }

  const cancelDraft = () => {
    setDrunkMl(savedDrunkRef.current)
    setAwaitingConfirm(false)
  }

  const applyPreset = (presetId: WaterPresetId, delta: 1 | -1, ml: number) => {
    if (awaitingConfirm) cancelDraft()
    const result = applyWaterPresetDelta(presetId, delta, ml)
    savedDrunkRef.current = result.waterMl
    setDrunkMl(result.waterMl)
    setPresetCounts(result.journal.waterPresetsCount ?? {})
    hapticTick(delta > 0 ? 10 : 16)
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
            {displayTotal}
          </span>
          <span className="text-[#8E8E93]"> ml bus</span>
          {fullBottlesToday > 0 ? (
            <span className="mt-0.5 block text-[11px] font-medium text-[#8E8E93]">
              ≈ {fullBottlesToday}× 1,5 L
            </span>
          ) : null}
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
            aria-valuenow={visualDrunk}
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
                {displayTotal}
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
              width: `${progressPct}%`,
              transition: dragging
                ? 'width 70ms linear'
                : 'width 420ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          />
        </div>

        {/* Smart presets — mémoire des contenants */}
        <div className="w-full max-w-[340px]">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
            Raccourcis
          </p>
          <div className="grid grid-cols-3 gap-2">
            {WATER_SMART_PRESETS.map((preset) => (
              <WaterPresetButton
                key={preset.id}
                label={preset.label}
                detail={preset.detail}
                count={presetCounts[preset.id] ?? 0}
                Icon={preset.Icon}
                onAdd={() => applyPreset(preset.id, 1, preset.ml)}
                onRemove={() => applyPreset(preset.id, -1, preset.ml)}
              />
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-[#636366]">
            Tap = +1 · appui long = −1
          </p>
        </div>

        {showConfirmBar ? (
          <div className="water-validate-bar flex w-full max-w-[340px] flex-col items-center gap-2">
            <div
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 px-1.5 py-1.5"
              style={{
                background: 'rgb(28 28 30 / 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow:
                  'inset 0 1px 0 rgb(255 255 255 / 0.1), 0 10px 28px rgb(0 0 0 / 0.35)',
              }}
            >
              <button
                type="button"
                onClick={() => nudge(-STEP_ML)}
                disabled={drunkMl <= 0}
                className="ios-press flex h-12 min-w-[56px] shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.07] px-2.5 text-[14px] font-semibold tabular-nums tracking-tight text-white disabled:opacity-35"
                aria-label={`Retirer ${STEP_ML} ml`}
              >
                −{STEP_ML}
              </button>

              <button
                type="button"
                onClick={() => persistDrunk(drunkMl)}
                className="water-validate-btn ios-press flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-[#38BDF8]/40 bg-[#38BDF8]/20 px-3 py-3 text-[15px] font-semibold tracking-tight text-white"
              >
                <span className="truncate">
                  Valider <span className="tabular-nums">{drunkMl}</span> ml
                </span>
              </button>

              <button
                type="button"
                onClick={() => nudge(STEP_ML)}
                disabled={drunkMl >= MAX_DAILY_WATER_ML}
                className="ios-press flex h-12 min-w-[56px] shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.07] px-2.5 text-[14px] font-semibold tabular-nums tracking-tight text-white disabled:opacity-35"
                aria-label={`Ajouter ${STEP_ML} ml`}
              >
                +{STEP_ML}
              </button>
            </div>
            <button
              type="button"
              onClick={cancelDraft}
              className="ios-press rounded-xl px-4 py-2 text-[12px] font-medium text-[#8E8E93]"
            >
              Annuler
            </button>
          </div>
        ) : (
          <p className="max-w-[280px] text-center text-[13px] leading-relaxed text-[#8E8E93]">
            Glisse la bouteille pour l’approx., ou utilise les raccourcis.
          </p>
        )}
      </div>
    </section>
  )
}

interface WaterPresetButtonProps {
  label: string
  detail: string
  count: number
  Icon: typeof Droplets
  onAdd: () => void
  onRemove: () => void
}

function WaterPresetButton({
  label,
  detail,
  count,
  Icon,
  onAdd,
  onRemove,
}: WaterPresetButtonProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    longPressFired.current = false
    startPos.current = { x: event.clientX, y: event.clientY }
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      if (count > 0) onRemove()
      else hapticTick(4)
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dx = Math.abs(event.clientX - startPos.current.x)
    const dy = Math.abs(event.clientY - startPos.current.y)
    if (dx > LONG_PRESS_MOVE_PX || dy > LONG_PRESS_MOVE_PX) clearLongPress()
  }

  const onPointerUp = () => {
    const wasLong = longPressFired.current
    clearLongPress()
    if (!wasLong) onAdd()
  }

  const onPointerCancel = () => {
    clearLongPress()
    longPressFired.current = true
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={clearLongPress}
      onContextMenu={(e) => e.preventDefault()}
      className="water-preset-btn ios-press relative flex flex-col items-center gap-1 rounded-2xl border border-white/12 px-2 py-3 text-center"
      style={{
        background: 'rgb(28 28 30 / 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}
      aria-label={`${label} ${detail}. Tap pour ajouter, appui long pour retirer.`}
    >
      {count > 0 ? (
        <span
          key={count}
          className="water-preset-badge"
          aria-label={`${count} fois`}
        >
          {count > 1 ? `x${count}` : '1'}
        </span>
      ) : null}
      <Icon className="h-5 w-5 text-[#7DD3FC]" strokeWidth={1.75} aria-hidden />
      <span className="text-[12px] font-semibold tracking-tight text-white">{label}</span>
      <span className="text-[10px] font-medium tabular-nums text-[#8E8E93]">{detail}</span>
    </button>
  )
}
