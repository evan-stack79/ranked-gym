/**
 * Hydratation bouteille v3 — variante B (test).
 * Étape 1 : niveau de départ (ne compte pas comme bu).
 * Étape 2 : glisser bas → ml bus ; ajout au RELÂCHEMENT (pas de bouton Ajouter).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  drunkMlFromStartAndCurrent,
  fillRatioFromMl,
  handleBottomPercent,
  shouldCommitDrunkOnRelease,
  WATER_CONTAINER_CAPACITY_ML,
  WATER_DRAG_STEP_ML,
  WATER_LEVEL_STEP_ML,
  type WaterContainerKind,
} from '../../shared/hydration'
import { LiveBottleVisual, type BottleDragMode } from './LiveBottleVisual'

const UNDO_TOAST_MS = 5000

export type BottleFlowPhase = 'intro' | BottleDragMode

export interface BottleFlowCommit {
  amountMl: number
  remainingAfterMl: number
  clientId: string
}

interface BottleFlowV3Props {
  open: boolean
  onClose: () => void
  capacityMl?: number
  kind?: WaterContainerKind
  shapeUrl?: string | null
  initialRemainingMl: number
  busy?: boolean
  onCommitDrunk: (commit: BottleFlowCommit) => Promise<void>
  /** Fixture / capture : force la phase initiale. */
  initialPhase?: BottleFlowPhase
  /** Fixture / capture : remaining forcé (ex. 950 ml en étape 2). */
  captureRemainingMl?: number
  /** Fixture / capture : départ forcé. */
  captureStartMl?: number
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `hy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function stepClamp(ml: number, capacity: number, step: number): number {
  const s = step > 0 ? step : 1
  const rounded = Math.round(ml / s) * s
  return Math.min(capacity, Math.max(0, rounded))
}

function MlBubble({ ml, style }: { ml: number; style?: CSSProperties }) {
  return (
    <div
      className="pointer-events-none absolute z-40 whitespace-nowrap rounded-2xl border border-white/20 bg-[#1C1C1E] px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
      style={style}
      data-hydration-ml-bubble
    >
      <p className="text-[16px] font-semibold tabular-nums tracking-tight text-white">
        {ml.toLocaleString('fr-FR')}&nbsp;ml
      </p>
    </div>
  )
}

export function BottleFlowV3({
  open,
  onClose,
  capacityMl = WATER_CONTAINER_CAPACITY_ML.plastic_15,
  kind = 'plastic_15',
  shapeUrl = null,
  initialRemainingMl,
  busy = false,
  onCommitDrunk,
  initialPhase = 'intro',
  captureRemainingMl,
  captureStartMl,
}: BottleFlowV3Props) {
  const capacity = capacityMl
  const [phase, setPhase] = useState<BottleFlowPhase>(initialPhase)
  const [startRemainingMl, setStartRemainingMl] = useState(capacity)
  const [remainingMl, setRemainingMl] = useState(capacity)
  const [dragging, setDragging] = useState(false)
  const committingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const init = stepClamp(initialRemainingMl, capacity, WATER_LEVEL_STEP_ML)
    const start = captureStartMl != null
      ? stepClamp(captureStartMl, capacity, WATER_LEVEL_STEP_ML)
      : init
    const rem = captureRemainingMl != null
      ? stepClamp(captureRemainingMl, capacity, WATER_DRAG_STEP_ML)
      : start
    setPhase(initialPhase)
    setStartRemainingMl(start)
    setRemainingMl(rem)
    setDragging(initialPhase === 'drink' && rem < start)
    committingRef.current = false
  }, [open, initialRemainingMl, capacity, initialPhase, captureRemainingMl, captureStartMl])

  const drunkMl = useMemo(
    () =>
      phase === 'drink'
        ? drunkMlFromStartAndCurrent(
            startRemainingMl,
            remainingMl,
            capacity,
            WATER_DRAG_STEP_ML,
          )
        : 0,
    [phase, startRemainingMl, remainingMl, capacity],
  )

  const startPct = handleBottomPercent(
    kind,
    fillRatioFromMl(startRemainingMl, capacity),
  )

  const nudge = (delta: number) => {
    if (phase === 'setup') {
      setRemainingMl((prev) => stepClamp(prev + delta, capacity, WATER_LEVEL_STEP_ML))
      return
    }
    if (phase === 'drink') {
      setRemainingMl((prev) => {
        const next = stepClamp(prev + delta, capacity, WATER_LEVEL_STEP_ML)
        return Math.min(startRemainingMl, next)
      })
    }
  }

  const confirmStart = () => {
    setStartRemainingMl(remainingMl)
    setPhase('drink')
  }

  const commitOnRelease = useCallback(async () => {
    if (phase !== 'drink' || committingRef.current || busy) return
    if (!shouldCommitDrunkOnRelease(drunkMl)) return
    committingRef.current = true
    const clientId = newClientId()
    try {
      await onCommitDrunk({
        amountMl: Math.round(drunkMl),
        remainingAfterMl: remainingMl,
        clientId,
      })
      onClose()
    } finally {
      committingRef.current = false
    }
  }, [phase, busy, drunkMl, remainingMl, onCommitDrunk, onClose])

  const onDragEnd = useCallback(() => {
    setDragging(false)
    void commitOnRelease()
  }, [commitOnRelease])

  if (!open) return null

  const label =
    kind === 'plastic_15'
      ? 'Cristaline 1,5 L'
      : kind === 'small_50'
        ? 'Petite bouteille 50 cl'
        : kind === 'glass_25'
          ? 'Verre 25 cl'
          : 'Ma bouteille'

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3.25rem,env(safe-area-inset-top))] text-white"
      data-hydration-bottle-flow="v3b"
      data-hydration-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label="Eau"
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="ios-press text-[17px] font-medium text-[#FF0702]"
          data-hydration-flow-close
        >
          {phase === 'intro' ? 'Fermer' : 'Retour'}
        </button>
        <p className="text-[13px] font-medium text-[#8E8E93]">
          {phase === 'intro' ? 'Eau bue seule' : label}
        </p>
      </div>

      {phase === 'intro' ? (
        <>
          <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
            Hydratation
          </p>
          <h2 className="mt-0.5 text-center text-[22px] font-bold tracking-tight text-white">
            {label}
          </h2>
          <p className="mt-1 text-center text-[13px] leading-snug text-[#ACB4BA]">
            On règle d&apos;abord le niveau. Ensuite tu diras ce que tu as bu.
          </p>
          <div className="mt-2 flex flex-1 items-center justify-center">
            <LiveBottleVisual
              kind={kind}
              remainingMl={capacity}
              capacityMl={capacity}
              shapeUrl={shapeUrl}
              size="hero"
              showHandle
              handleHint={false}
              interactive={false}
            />
          </div>
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="ios-press mt-auto min-h-[52px] w-full rounded-2xl bg-[#FF0702] text-[17px] font-semibold text-white"
            data-hydration-flow-start
          >
            Commencer
          </button>
        </>
      ) : null}

      {phase === 'setup' ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold tabular-nums text-[#ACB4BA]">Étape 1/2</p>
            <p className="text-[12px] font-medium text-[#8E8E93]">{label}</p>
          </div>
          <h2 className="mt-1 text-[21px] font-bold tracking-tight text-white">
            Où en est ta bouteille&nbsp;?
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[#ACB4BA]">
            Glisse le trait, ou utilise −&nbsp;10&nbsp;ml / +&nbsp;10&nbsp;ml.
          </p>

          <div className="relative mt-2 flex flex-1 flex-col justify-center">
            <div className="relative mx-auto w-full max-w-[340px]">
              <LiveBottleVisual
                kind={kind}
                remainingMl={remainingMl}
                capacityMl={capacity}
                mode="setup"
                shapeUrl={shapeUrl}
                size="hero"
                showHandle
                handleHint={false}
                showMlBubble
                interactive
                dragStepMl={WATER_DRAG_STEP_ML}
                onRemainingChange={setRemainingMl}
                onDraggingChange={setDragging}
              />
            </div>
          </div>

          <div className="mt-1 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => nudge(-WATER_LEVEL_STEP_ML)}
              className="ios-press min-h-10 min-w-[88px] rounded-2xl border border-white/15 bg-white/5 text-[14px] font-semibold text-white"
              data-hydration-nudge="-10"
            >
              −&nbsp;10&nbsp;ml
            </button>
            <p className="min-w-[80px] text-center text-[15px] font-semibold tabular-nums text-white">
              {remainingMl.toLocaleString('fr-FR')}&nbsp;ml
            </p>
            <button
              type="button"
              onClick={() => nudge(WATER_LEVEL_STEP_ML)}
              className="ios-press min-h-10 min-w-[88px] rounded-2xl border border-white/15 bg-white/5 text-[14px] font-semibold text-white"
              data-hydration-nudge="+10"
            >
              +&nbsp;10&nbsp;ml
            </button>
          </div>

          <p className="mt-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-center text-[12px] leading-snug text-[#C7C7CC]">
            Ce niveau ne compte pas comme bu. C&apos;est juste pour savoir où en est la bouteille.
          </p>

          <button
            type="button"
            onClick={confirmStart}
            className="ios-press mt-auto min-h-[52px] w-full rounded-2xl bg-[#FF0702] text-[17px] font-semibold text-white"
            data-hydration-confirm-level
          >
            C&apos;est bon — étape suivante
          </button>
        </>
      ) : null}

      {phase === 'drink' ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold tabular-nums text-[#ACB4BA]">Étape 2/2</p>
            <p className="text-[12px] font-medium text-[#8E8E93]">{label}</p>
          </div>
          <h2 className="mt-1 text-[21px] font-bold tracking-tight text-white">
            Combien tu as bu&nbsp;?
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[#ACB4BA]">
            Glisse vers le bas. Le niveau baisse = tu as bu.
          </p>
          <p
            className="mt-1.5 text-center text-[26px] font-bold tabular-nums tracking-tight text-white"
            data-hydration-drunk-big
          >
            Tu as bu {drunkMl.toLocaleString('fr-FR')}&nbsp;ml
          </p>

          <div className="relative mt-1 flex flex-1 flex-col justify-center">
            <div className="relative mx-auto w-full max-w-[340px]">
              <LiveBottleVisual
                kind={kind}
                remainingMl={remainingMl}
                capacityMl={capacity}
                startRemainingMl={startRemainingMl}
                mode="drink"
                shapeUrl={shapeUrl}
                size="hero"
                showHandle
                handleHint={false}
                showDrunkZone
                showMlBubble
                interactive
                dragStepMl={WATER_DRAG_STEP_ML}
                onRemainingChange={setRemainingMl}
                onDraggingChange={setDragging}
                onDragEnd={onDragEnd}
              />
              {drunkMl > 0 ? (
                <div
                  className="pointer-events-none absolute z-40 rounded-lg border border-[#FF0702]/45 bg-[#0B0B0D] px-2.5 py-1"
                  style={{ bottom: `calc(${startPct}% + 6px)`, left: 4 }}
                  data-hydration-drunk-label
                >
                  <p className="text-[11px] font-semibold text-[#FF907F]">partie bue</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-auto pb-1 pt-2 text-center">
            <p className="text-[17px] font-semibold tracking-tight text-white">
              {dragging || drunkMl > 0 ? 'Lâche pour ajouter' : 'Glisse vers le bas'}
            </p>
            <p className="mt-1 text-[13px] text-[#8E8E93]" data-hydration-release-hint>
              {drunkMl > 0
                ? `${drunkMl.toLocaleString('fr-FR')} ml seront ajoutés`
                : 'À 0 ml, rien n’est ajouté'}
            </p>
          </div>
        </>
      ) : null}

    </div>
  )
}

export function HydrationUndoToast({
  amountMl,
  progress,
  onUndo,
  onDismiss,
}: {
  amountMl: number
  /** 0…1 remaining time. */
  progress: number
  onUndo: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    if (progress <= 0) onDismiss()
  }, [progress, onDismiss])

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/12 bg-[#1C1C1E] px-3.5 py-3"
      data-hydration-undo-toast
    >
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[15px] font-semibold tabular-nums text-white">
          +{amountMl.toLocaleString('fr-FR')}&nbsp;ml ajoutés
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="ios-press shrink-0 rounded-xl px-3 py-2 text-[14px] font-semibold text-[#FF0702]"
          data-hydration-undo-toast-btn
        >
          Annuler
        </button>
      </div>
      <div className="mt-2.5 h-[2px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#FF0702]/70 transition-[width] duration-100 linear"
          style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
          data-hydration-undo-timer
        />
      </div>
    </div>
  )
}

/** Idempotence Annuler : un seul undo effectif. */
export function createUndoOnce(undo: () => void | Promise<void>) {
  let done = false
  return () => {
    if (done) return false
    done = true
    void undo()
    return true
  }
}

export { UNDO_TOAST_MS, MlBubble }
