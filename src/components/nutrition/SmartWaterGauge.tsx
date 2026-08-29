import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CupSoda, Droplets, FlaskConical, X } from 'lucide-react'
import type { WaterEntry, WaterPresetsCount } from '../../types/nutrition'
import {
  addWaterEntry,
  clearTodayWaterBottleCalibration,
  getTodayJournal,
  getTodayWaterEntries,
  getTodayWaterMl,
  getTodayWaterPresetsCount,
  isTodayWaterBottleCalibrated,
  MAX_DAILY_WATER_ML,
  removeWaterEntry,
  setTodayWaterBottleCalibration,
  setWaterTotalFromGauge,
  WATER_BOTTLE_CAPACITY_ML,
} from '../../services/nutritionStorage'
import { resolveBottleVisual } from '../../utils/deriveBottleProgress'
import {
  calibrationRemainingMlFromKey,
  calibrationRemainingMlFromPointer,
  clampCalibrationRemainingMl,
} from '../../utils/bottleCalibrationPointer'
import {
  formatWaterMl,
  getDailyWaterGoalMl,
  isTrainingDayToday,
} from '../../utils/waterGoal'
import { CompletedBottles } from './CompletedBottles'
import { HydrationProgressBar } from './HydrationProgressBar'

/**
 * Journal d’hydratation : jauge + raccourcis (badges ×N) + liste « Aujourd’hui »
 * avec suppression explicite. Sync JSON via nutrition.journal (Supabase).
 *
 * Visualisation bouteilles : `resolveBottleVisual` (automatique ou calibré).
 * Le calibrage n’altère jamais `waterMl` ni les entrées du journal.
 */
export { WATER_BOTTLE_CAPACITY_ML }
const STEP_ML = 10
const HAPTIC_EVERY_ML = 50
const RELEASE_DEADZONE_PX = 18
const RELEASE_JITTER_MS = 70

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

function clampBottle(ml: number): number {
  const stepped = Math.round(ml / STEP_ML) * STEP_ML
  return Math.min(WATER_BOTTLE_CAPACITY_ML, Math.max(0, stepped))
}

function clampDaily(ml: number): number {
  const stepped = Math.round(ml / STEP_ML) * STEP_ML
  return Math.min(MAX_DAILY_WATER_ML, Math.max(0, stepped))
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

function formatEntryTime(createdAt: number): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(createdAt))
  } catch {
    const d = new Date(createdAt)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
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

export function SmartWaterGauge({ weightKg }: SmartWaterGaugeProps) {
  const fillAreaRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const hapticBucketRef = useRef(0)
  const samplesRef = useRef<DragSample[]>([])
  const dragStartLevelRef = useRef(0)
  const dragCompletedBaseRef = useRef(0)
  const savedDrunkRef = useRef(clampDaily(getTodayWaterMl()))

  const [drunkMl, setDrunkMl] = useState(() => clampDaily(getTodayWaterMl()))
  const [currentBottleLevel, setCurrentBottleLevel] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [presetCounts, setPresetCounts] = useState<WaterPresetsCount>(() =>
    getTodayWaterPresetsCount(),
  )
  const [entries, setEntries] = useState<WaterEntry[]>(() => getTodayWaterEntries())
  const [calibrationMode, setCalibrationMode] = useState(false)
  const [calibrationPreviewRemainingMl, setCalibrationPreviewRemainingMl] =
    useState<number | null>(null)

  const isTrainingDay = isTrainingDayToday()
  const dailyGoalMl = getDailyWaterGoalMl(weightKg ?? 70, isTrainingDay)
  const isCalibrated = isTodayWaterBottleCalibrated()

  const resolveVisual = useCallback(
    (total: number) => {
      const journal = getTodayJournal()
      return resolveBottleVisual(total, dailyGoalMl, {
        capacityMl: WATER_BOTTLE_CAPACITY_ML,
        bottleLevelMl: journal.waterBottleLevelMl,
        calibrationTotalMl: journal.waterBottleCalibrationTotalMl,
      })
    },
    [dailyGoalMl],
  )

  const syncDerivedLevel = useCallback(
    (total: number) => {
      const progress = resolveVisual(total)
      return clampBottle(progress.activeMl)
    },
    [resolveVisual],
  )

  const applyJournalState = useCallback(
    (waterMl: number, nextEntries?: WaterEntry[]) => {
      const total = clampDaily(waterMl)
      const activeLevel = syncDerivedLevel(total)
      savedDrunkRef.current = total
      setDrunkMl(total)
      setCurrentBottleLevel(activeLevel)
      setAwaitingConfirm(false)
      const resolved = nextEntries ?? getTodayWaterEntries()
      setEntries(resolved)
      setPresetCounts(getTodayWaterPresetsCount())
    },
    [syncDerivedLevel],
  )

  const syncFromStorage = useCallback(() => {
    applyJournalState(getTodayWaterMl(), getTodayWaterEntries())
  }, [applyJournalState])

  useEffect(() => {
    syncFromStorage()
  }, [syncFromStorage])

  useEffect(() => {
    window.addEventListener('ranked-gym:backup-restored', syncFromStorage)
    window.addEventListener('ranked-gym:water-changed', syncFromStorage)
    window.addEventListener('ranked-gym:profile-changed', syncFromStorage)
    window.addEventListener('ranked-gym:training-changed', syncFromStorage)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', syncFromStorage)
      window.removeEventListener('ranked-gym:water-changed', syncFromStorage)
      window.removeEventListener('ranked-gym:profile-changed', syncFromStorage)
      window.removeEventListener('ranked-gym:training-changed', syncFromStorage)
    }
  }, [syncFromStorage])

  const displayTotal = awaitingConfirm || dragging ? drunkMl : savedDrunkRef.current

  const bottleProgress = useMemo(
    () => resolveVisual(displayTotal),
    [displayTotal, resolveVisual],
  )

  const storedBottleLevel =
    awaitingConfirm || dragging ? currentBottleLevel : bottleProgress.activeMl
  const displayBottleLevel = calibrationMode
    ? WATER_BOTTLE_CAPACITY_ML -
      clampCalibrationRemainingMl(
        calibrationPreviewRemainingMl ?? WATER_BOTTLE_CAPACITY_ML - storedBottleLevel,
        WATER_BOTTLE_CAPACITY_ML,
      )
    : storedBottleLevel

  const remainingMl = WATER_BOTTLE_CAPACITY_ML - displayBottleLevel
  const remainingPct = (remainingMl / WATER_BOTTLE_CAPACITY_ML) * 100
  const showConfirmBar = awaitingConfirm
  const showActiveBottle = bottleProgress.showActiveBottle

  const visualFromClientY = useCallback((clientY: number) => {
    const el = fillAreaRef.current
    if (!el) return dragStartLevelRef.current
    const rect = el.getBoundingClientRect()
    const ratio = 1 - (clientY - rect.top) / Math.max(rect.height, 1)
    const remaining = clampBottle(ratio * WATER_BOTTLE_CAPACITY_ML)
    return clampBottle(WATER_BOTTLE_CAPACITY_ML - remaining)
  }, [])

  const previewCalibrationFromY = useCallback((clientY: number) => {
    const el = fillAreaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCalibrationPreviewRemainingMl(
      calibrationRemainingMlFromPointer(clientY, rect, WATER_BOTTLE_CAPACITY_ML),
    )
  }, [])

  const pushSample = useCallback((clientY: number, visual: number) => {
    const sample: DragSample = {
      y: clientY,
      t: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      visual: clampBottle(visual),
    }
    const next = samplesRef.current.concat(sample)
    samplesRef.current = next.length > 16 ? next.slice(-16) : next
  }, [])

  const previewBottleLevel = useCallback(
    (visual: number, clientY: number) => {
      const level = clampBottle(visual)
      pushSample(clientY, level)
      const bucket = Math.floor(level / HAPTIC_EVERY_ML)
      if (bucket !== hapticBucketRef.current) {
        hapticBucketRef.current = bucket
        hapticTick()
      }
      setCurrentBottleLevel(level)
      const preview = clampDaily(
        dragCompletedBaseRef.current * WATER_BOTTLE_CAPACITY_ML + level,
      )
      setDrunkMl(preview)
    },
    [pushSample],
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!showActiveBottle) return
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)

    if (calibrationMode) {
      previewCalibrationFromY(event.clientY)
      return
    }

    setDragging(true)
    setAwaitingConfirm(false)
    samplesRef.current = []
    const progress = resolveVisual(savedDrunkRef.current)
    dragCompletedBaseRef.current = progress.completedCount
    dragStartLevelRef.current = clampBottle(progress.activeMl)
    const initialVisual = visualFromClientY(event.clientY)
    hapticBucketRef.current = Math.floor(initialVisual / HAPTIC_EVERY_ML)
    previewBottleLevel(initialVisual, event.clientY)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    if (calibrationMode) {
      previewCalibrationFromY(event.clientY)
      return
    }
    previewBottleLevel(visualFromClientY(event.clientY), event.clientY)
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // already released
    }

    if (calibrationMode) {
      previewCalibrationFromY(event.clientY)
      return
    }

    setDragging(false)

    const samples = samplesRef.current
    const last = samples[samples.length - 1]
    const endY = event.clientY
    const liftDeltaPx = last ? Math.abs(endY - last.y) : Number.POSITIVE_INFINITY
    const fromHistory = resolveReleaseVisual(samples)
    const finalVisual =
      liftDeltaPx < RELEASE_DEADZONE_PX
        ? (fromHistory ?? last?.visual ?? currentBottleLevel)
        : fromHistory !== null && liftDeltaPx < RELEASE_DEADZONE_PX * 1.5
          ? fromHistory
          : visualFromClientY(endY)

    const level = clampBottle(finalVisual)
    setCurrentBottleLevel(level)
    setDrunkMl(
      clampDaily(dragCompletedBaseRef.current * WATER_BOTTLE_CAPACITY_ML + level),
    )
    setAwaitingConfirm(true)
  }

  const nudge = (delta: number) => {
    setDrunkMl((current) => {
      const next = clampDaily(current + delta)
      const progress = resolveVisual(next)
      setCurrentBottleLevel(clampBottle(progress.activeMl))
      setAwaitingConfirm(true)
      return next
    })
    hapticTick()
  }

  const cancelDraft = () => {
    const activeLevel = syncDerivedLevel(savedDrunkRef.current)
    setDrunkMl(savedDrunkRef.current)
    setCurrentBottleLevel(activeLevel)
    setAwaitingConfirm(false)
  }

  const validateNormal = () => {
    const target = clampDaily(drunkMl)
    const delta = target - savedDrunkRef.current
    let journal

    if (delta > 0) {
      journal = addWaterEntry({
        amountMl: delta,
        type: 'manual',
        label: 'Bouteille',
      }).journal
    } else if (delta < 0) {
      journal = setWaterTotalFromGauge(target)
    } else {
      applyJournalState(savedDrunkRef.current, getTodayWaterEntries())
      hapticTick()
      return
    }

    applyJournalState(journal.waterMl ?? 0, journal.waterEntries)
    hapticTick()
  }

  const addPreset = (presetId: WaterPresetId, ml: number, label: string) => {
    if (awaitingConfirm) cancelDraft()
    const result = addWaterEntry({ amountMl: ml, type: presetId, label })
    applyJournalState(result.waterMl, result.journal.waterEntries)
    hapticTick(10)
  }

  const deleteEntry = (entryId: string) => {
    if (awaitingConfirm) cancelDraft()
    const result = removeWaterEntry(entryId)
    applyJournalState(result.waterMl, result.journal.waterEntries)
    hapticTick(14)
  }

  const openCalibration = () => {
    if (awaitingConfirm) cancelDraft()
    const visual = resolveVisual(savedDrunkRef.current)
    setCalibrationPreviewRemainingMl(
      clampCalibrationRemainingMl(
        WATER_BOTTLE_CAPACITY_ML - visual.activeMl,
        WATER_BOTTLE_CAPACITY_ML,
      ),
    )
    setCalibrationMode(true)
  }

  const cancelCalibration = () => {
    setCalibrationMode(false)
    setCalibrationPreviewRemainingMl(null)
    syncFromStorage()
  }

  const saveCalibration = () => {
    const remaining = clampCalibrationRemainingMl(
      calibrationPreviewRemainingMl ?? WATER_BOTTLE_CAPACITY_ML - storedBottleLevel,
      WATER_BOTTLE_CAPACITY_ML,
    )
    setTodayWaterBottleCalibration(remaining)
    setCalibrationMode(false)
    setCalibrationPreviewRemainingMl(null)
    syncFromStorage()
    hapticTick(10)
  }

  const resetCalibration = () => {
    clearTodayWaterBottleCalibration()
    setCalibrationMode(false)
    setCalibrationPreviewRemainingMl(null)
    syncFromStorage()
    hapticTick(10)
  }

  const onBottleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!calibrationMode) return
    const next = calibrationRemainingMlFromKey(
      calibrationPreviewRemainingMl ?? remainingMl,
      event.key,
      WATER_BOTTLE_CAPACITY_ML,
    )
    if (next === null) return
    event.preventDefault()
    setCalibrationPreviewRemainingMl(next)
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
          <span className="text-[#8E8E93]"> / {formatWaterMl(dailyGoalMl)}</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <CompletedBottles
          completedCount={bottleProgress.completedCount}
          animateKey={displayTotal}
        />

        {showActiveBottle ? (
          <div
            key={`active-bottle-${bottleProgress.completedCount}`}
            className="relative flex flex-col items-center water-active-bottle"
          >
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

            <div className="relative">
              <div
                ref={fillAreaRef}
                className={`water-bottle-slim relative -mt-1 h-[320px] w-[88px] touch-none select-none overflow-hidden ${
                  dragging ? 'water-bottle--active' : ''
                } ${
                  calibrationMode ? 'water-bottle--calibrating' : ''
                }`}
                style={{ touchAction: 'none' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onBottleKeyDown}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={WATER_BOTTLE_CAPACITY_ML}
                aria-valuenow={calibrationMode ? remainingMl : displayBottleLevel}
                aria-valuetext={
                  calibrationMode
                    ? `${remainingMl} ml restants`
                    : `${displayBottleLevel} ml bus`
                }
                aria-label={
                  calibrationMode
                    ? 'Régler le liquide restant dans ma bouteille'
                    : 'Bouteille active — baisse pour indiquer ce que tu as bu (1,5 L)'
                }
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
                className={`water-bottle-fill absolute inset-x-0 bottom-0 mx-[2px] mb-[2px] overflow-hidden rounded-b-[26px] ${
                  calibrationMode ? 'water-bottle-fill--calibrating' : ''
                }`}
                style={{
                  height: `${remainingPct}%`,
                  maxHeight: 'calc(100% - 4px)',
                  transition: dragging || calibrationMode
                    ? 'height 70ms linear'
                    : 'height 280ms cubic-bezier(0.32, 0.72, 0, 1)',
                }}
              >
                <div className="water-bottle-liquid absolute inset-0" />
                <div className="water-bottle-meniscus absolute inset-x-0 top-0 h-3.5" />
              </div>

              {calibrationMode ? (
                <div
                  className="water-calibration-level pointer-events-none absolute inset-x-1 z-30 h-px"
                  style={{ bottom: `${remainingPct}%` }}
                  aria-hidden
                />
              ) : null}

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
                {calibrationMode ? (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#BAE6FD]">
                      Restant
                    </p>
                    <p className="mt-0.5 text-[24px] font-semibold tracking-tight tabular-nums text-white">
                      {remainingMl}
                    </p>
                    <p className="text-[11px] font-medium text-white/75">ml</p>
                  </>
                ) : (
                  <>
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
                    {displayBottleLevel > 0 ? (
                      <p className="mt-1 text-[10px] font-medium tabular-nums text-white/50">
                        {displayBottleLevel} / {WATER_BOTTLE_CAPACITY_ML} sur bouteille
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              </div>

            {calibrationMode ? (
              <div
                className="water-calibration-bubble pointer-events-none absolute left-1/2 z-40 whitespace-nowrap rounded-full border border-[#38BDF8]/45 bg-[#07131A]/95 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#BAE6FD]"
                style={{
                  top: `${Math.min(96, Math.max(4, 100 - remainingPct))}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {remainingMl} ml restants
              </div>
              ) : null}
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
        ) : bottleProgress.goalReached ? (
          <p className="max-w-[300px] text-center text-[13px] leading-relaxed text-[#7DD3FC]">
            Objectif atteint — {formatWaterMl(displayTotal)} enregistrés aujourd&apos;hui.
          </p>
        ) : null}

        {showActiveBottle && !calibrationMode ? (
          <button
            type="button"
            onClick={openCalibration}
            className="ios-press min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-[#AEAEB2] hover:border-white/20 hover:text-white"
            aria-label="Régler le niveau visuel de la bouteille"
          >
            Régler ma bouteille
            {isCalibrated ? (
              <span className="ml-1.5 text-[11px] font-semibold text-[#7DD3FC]">· calibré</span>
            ) : null}
          </button>
        ) : null}

        {showActiveBottle && calibrationMode ? (
          <div className="w-full max-w-[340px] rounded-2xl border border-[#38BDF8]/25 bg-[#38BDF8]/[0.06] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-[#38BDF8]/30 bg-[#38BDF8]/10 px-2.5 py-1 text-[11px] font-semibold text-[#7DD3FC]">
                Mode calibrage
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-white">
                {remainingMl} ml restants
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#8E8E93]">
              Glisse ton doigt sur la bouteille jusqu’au niveau réel. Cela ne change pas l’eau enregistrée.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cancelCalibration}
                className="ios-press min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[13px] font-semibold text-[#AEAEB2]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveCalibration}
                className="ios-press min-h-11 rounded-xl border border-[#38BDF8]/40 bg-[#38BDF8]/20 px-3 py-2.5 text-[13px] font-semibold text-white"
              >
                Enregistrer
              </button>
            </div>
            {isCalibrated ? (
              <button
                type="button"
                onClick={resetCalibration}
                className="ios-press mt-2 min-h-11 w-full rounded-xl px-3 py-2 text-[12px] font-medium text-[#8E8E93] underline-offset-2 hover:underline"
              >
                Revenir au suivi automatique
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="w-full max-w-[340px]">
          <HydrationProgressBar
            consumedMl={displayTotal}
            goalMl={dailyGoalMl}
            isTrainingDay={isTrainingDay}
          />
        </div>

        <div className="w-full max-w-[340px]">
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
            Raccourcis
          </p>
          <div className="grid grid-cols-3 gap-2">
            {WATER_SMART_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => addPreset(preset.id, preset.ml, preset.label)}
                className="water-preset-btn ios-press relative flex flex-col items-center gap-1 rounded-2xl border border-white/12 px-2 py-3 text-center"
                style={{
                  background: 'rgb(28 28 30 / 0.72)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
                }}
                aria-label={`Ajouter ${preset.label} ${preset.detail}`}
              >
                {(presetCounts[preset.id] ?? 0) > 0 ? (
                  <span
                    key={presetCounts[preset.id]}
                    className="water-preset-badge"
                    aria-label={`${presetCounts[preset.id]} fois`}
                  >
                    {(presetCounts[preset.id] ?? 0) > 1
                      ? `x${presetCounts[preset.id]}`
                      : '1'}
                  </span>
                ) : null}
                <preset.Icon className="h-5 w-5 text-[#7DD3FC]" strokeWidth={1.75} aria-hidden />
                <span className="text-[12px] font-semibold tracking-tight text-white">
                  {preset.label}
                </span>
                <span className="text-[10px] font-medium tabular-nums text-[#8E8E93]">
                  {preset.detail}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="water-journal w-full max-w-[340px]">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Aujourd’hui
            </p>
            {entries.length > 0 ? (
              <p className="text-[11px] font-medium tabular-nums text-[#636366]">
                {entries.length} prise{entries.length > 1 ? 's' : ''}
              </p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-center text-[12px] leading-relaxed text-[#636366]">
              Aucune prise pour l’instant — valide un volume ou un raccourci.
            </p>
          ) : (
            <ul
              className="max-h-[220px] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="water-journal-row flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2.5"
                  style={{
                    background: 'rgb(28 28 30 / 0.78)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
                  }}
                >
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#8E8E93]">
                    {formatEntryTime(entry.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
                    {entry.label}
                    <span className="text-[#8E8E93]">
                      {' '}
                      · <span className="tabular-nums">{entry.amountMl}</span> ml
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    className="ios-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#AEAEB2] hover:border-[#FF453A]/40 hover:bg-[#FF453A]/15 hover:text-[#FF453A]"
                    aria-label={`Supprimer ${entry.label} ${entry.amountMl} ml`}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
                onClick={validateNormal}
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
            {showActiveBottle
              ? 'Glisse la bouteille ou utilise un raccourci — corrige via la liste.'
              : 'Suivi visuel de ce que tu as enregistré — pas une obligation de boire.'}
          </p>
        )}
      </div>

    </section>
  )
}
