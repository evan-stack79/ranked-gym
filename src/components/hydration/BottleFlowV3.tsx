/**
 * Hydratation bouteille v3 — variante B.
 * Ouverture intelligente : niveau mémorisé → étape boire ; sinon → régler le niveau.
 * Relâche = ajouter ; Annuler ne ferme pas le plein écran.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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
import { acquireBodyScrollLock } from '../../utils/bodyScrollLock'
import { LiveBottleVisual, type BottleDragMode } from './LiveBottleVisual'

const UNDO_TOAST_MS = 5000

/** Plus d’écran « Commencer » — setup | drink uniquement. */
export type BottleFlowPhase = BottleDragMode

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
  /** True si un niveau a déjà été mémorisé pour cet utilisateur/contenant. */
  hasMemorizedLevel?: boolean
  busy?: boolean
  onCommitDrunk: (commit: BottleFlowCommit) => Promise<void>
  /** Annuler l’ajout serveur + persister le niveau restauré (parent). */
  onUndoCommit?: (args: {
    amountMl: number
    restoreRemainingMl: number
  }) => Promise<void>
  /** « Bouteille remplie » : parent mémorise le plein. */
  onMarkBottleRefilled?: () => void
  /** Après « C'est bon » (setup) : parent mémorise le niveau choisi. */
  onConfirmLevel?: (remainingMl: number) => void
  /** Fixture / capture : force la phase initiale. */
  initialPhase?: BottleFlowPhase
  /** Fixture / capture : remaining forcé (ex. 950 ml en étape 2). */
  captureRemainingMl?: number
  /** Fixture / capture : départ forcé. */
  captureStartMl?: number
  /** Fixture / capture : affiche le toast Annuler (overlay reste ouvert). */
  captureToastMl?: number
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

function resolveOpenPhase(
  hasMemorized: boolean,
  forced?: BottleFlowPhase,
): BottleFlowPhase {
  if (forced === 'setup' || forced === 'drink') return forced
  return hasMemorized ? 'drink' : 'setup'
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
  hasMemorizedLevel = false,
  busy = false,
  onCommitDrunk,
  onUndoCommit,
  onMarkBottleRefilled,
  onConfirmLevel,
  initialPhase,
  captureRemainingMl,
  captureStartMl,
  captureToastMl,
}: BottleFlowV3Props) {
  const capacity = capacityMl
  const [phase, setPhase] = useState<BottleFlowPhase>(() =>
    resolveOpenPhase(hasMemorizedLevel, initialPhase),
  )
  const [startRemainingMl, setStartRemainingMl] = useState(capacity)
  const [remainingMl, setRemainingMl] = useState(capacity)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<{ amountMl: number; clientId: string } | null>(
    null,
  )
  const [toastProgress, setToastProgress] = useState(1)
  const committingRef = useRef(false)
  const undoGateRef = useRef<ReturnType<typeof createUndoOnce> | null>(null)
  const lastCommitBeforeRef = useRef<number | null>(null)
  const remainingRef = useRef(remainingMl)
  const startRef = useRef(startRemainingMl)
  const phaseRef = useRef(phase)
  remainingRef.current = remainingMl
  startRef.current = startRemainingMl
  phaseRef.current = phase

  useEffect(() => {
    if (!open) return
    const init = stepClamp(initialRemainingMl, capacity, WATER_LEVEL_STEP_ML)
    const openPhase = resolveOpenPhase(hasMemorizedLevel, initialPhase)
    const start = captureStartMl != null
      ? stepClamp(captureStartMl, capacity, WATER_LEVEL_STEP_ML)
      : init
    const rem = captureRemainingMl != null
      ? stepClamp(captureRemainingMl, capacity, WATER_DRAG_STEP_ML)
      : start
    setPhase(openPhase)
    setStartRemainingMl(start)
    setRemainingMl(rem)
    setDragging(false)
    undoGateRef.current = null
    if (captureToastMl != null && captureToastMl > 0) {
      lastCommitBeforeRef.current = start
      setToast({ amountMl: Math.round(captureToastMl), clientId: 'capture' })
    } else {
      lastCommitBeforeRef.current = null
      setToast(null)
    }
    committingRef.current = false
  }, [
    open,
    initialRemainingMl,
    capacity,
    initialPhase,
    captureRemainingMl,
    captureStartMl,
    captureToastMl,
    hasMemorizedLevel,
  ])

  useEffect(() => {
    if (!open) return
    const releaseScroll = acquireBodyScrollLock()
    const prevTouch = document.body.style.touchAction
    const prevOverscroll = document.body.style.overscrollBehavior
    document.body.style.touchAction = 'none'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      releaseScroll()
      document.body.style.touchAction = prevTouch
      document.body.style.overscrollBehavior = prevOverscroll
    }
  }, [open])

  useEffect(() => {
    if (!toast) return
    undoGateRef.current = null
    setToastProgress(1)
    const started = Date.now()
    const id = window.setInterval(() => {
      const left = Math.max(0, 1 - (Date.now() - started) / UNDO_TOAST_MS)
      setToastProgress(left)
      if (left <= 0) {
        window.clearInterval(id)
        setToast(null)
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [toast])

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
    setToast(null)
    onConfirmLevel?.(remainingMl)
  }

  const goToSetupFresh = () => {
    setRemainingMl(capacity)
    setStartRemainingMl(capacity)
    setPhase('setup')
    setToast(null)
    setDragging(false)
    onMarkBottleRefilled?.()
  }

  const commitOnRelease = useCallback(async () => {
    if (phaseRef.current !== 'drink' || committingRef.current || busy || toast) return
    const start = startRef.current
    const rem = remainingRef.current
    const amount = drunkMlFromStartAndCurrent(start, rem, capacity, WATER_DRAG_STEP_ML)
    if (!shouldCommitDrunkOnRelease(amount)) return
    committingRef.current = true
    const clientId = newClientId()
    try {
      await onCommitDrunk({
        amountMl: Math.round(amount),
        remainingAfterMl: rem,
        clientId,
      })
      // Reste ouvert : le départ devient le niveau actuel pour un prochain glisser.
      lastCommitBeforeRef.current = start
      setStartRemainingMl(rem)
      setToast({ amountMl: Math.round(amount), clientId })
    } finally {
      committingRef.current = false
    }
  }, [busy, toast, capacity, onCommitDrunk])

  const onDragEnd = useCallback(() => {
    setDragging(false)
    void commitOnRelease()
  }, [commitOnRelease])

  const handleUndo = useCallback(() => {
    if (!toast || busy) return
    if (!undoGateRef.current) {
      undoGateRef.current = createUndoOnce(async () => {
        const before = lastCommitBeforeRef.current ?? remainingMl + toast.amountMl
        const restored = Math.min(capacity, Math.max(0, before))
        if (onUndoCommit) {
          await onUndoCommit({
            amountMl: toast.amountMl,
            restoreRemainingMl: restored,
          })
        }
        setRemainingMl(restored)
        setStartRemainingMl(restored)
        setToast(null)
        lastCommitBeforeRef.current = null
      })
    }
    undoGateRef.current()
  }, [toast, busy, onUndoCommit, remainingMl, capacity])

  if (!open || typeof document === 'undefined') return null

  const label =
    kind === 'plastic_15'
      ? 'Cristaline 1,5 L'
      : kind === 'small_50'
        ? 'Petite bouteille 50 cl'
        : kind === 'glass_25'
          ? 'Verre 25 cl'
          : 'Ma bouteille'

  const bottleSlot = (node: ReactNode) => (
    <div className="relative mt-2 flex min-h-0 flex-1 flex-col justify-center overflow-visible">
      <div className="relative mx-auto flex h-full max-h-full w-full max-w-[300px] items-center justify-center overflow-visible">
        {node}
      </div>
    </div>
  )

  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden text-white"
      style={{
        backgroundColor: '#000000',
        paddingTop: 'max(0.75rem, var(--app-safe-area-top, env(safe-area-inset-top, 0px)))',
        paddingBottom:
          'max(0.75rem, var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
        paddingLeft: 'max(1.25rem, var(--app-safe-area-left, env(safe-area-inset-left, 0px)))',
        paddingRight: 'max(1.25rem, var(--app-safe-area-right, env(safe-area-inset-right, 0px)))',
      }}
      data-hydration-bottle-flow="v3b"
      data-hydration-phase={phase}
      data-hydration-overlay-portal="1"
      data-hydration-covers-chrome="1"
      data-hydration-has-memorized={hasMemorizedLevel ? '1' : '0'}
      role="dialog"
      aria-modal="true"
      aria-label="Eau"
    >
      <div className="mb-1 flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="ios-press text-[17px] font-medium text-[#FF0702]"
          data-hydration-flow-close
        >
          Fermer
        </button>
        <p className="text-[13px] font-medium text-[#8E8E93]">Eau bue seule</p>
      </div>

      {phase === 'setup' ? (
        <>
          <div className="shrink-0 text-center">
            <h2 className="mt-1 text-[21px] font-bold tracking-tight text-white">{label}</h2>
            <p className="mt-1 text-[15px] font-semibold text-white">Où en est ta bouteille&nbsp;?</p>
          </div>

          {bottleSlot(
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
              className="!max-h-[min(48dvh,420px)]"
            />,
          )}

          <div className="mt-1 flex shrink-0 items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => nudge(-WATER_LEVEL_STEP_ML)}
              className="ios-press min-h-10 min-w-[88px] rounded-2xl border border-white/15 bg-white/5 text-[14px] font-semibold text-white"
              data-hydration-nudge="-10"
            >
              −&nbsp;10&nbsp;ml
            </button>
            <button
              type="button"
              onClick={() => nudge(WATER_LEVEL_STEP_ML)}
              className="ios-press min-h-10 min-w-[88px] rounded-2xl border border-white/15 bg-white/5 text-[14px] font-semibold text-white"
              data-hydration-nudge="+10"
            >
              +&nbsp;10&nbsp;ml
            </button>
          </div>

          <button
            type="button"
            onClick={confirmStart}
            className="ios-press mt-auto min-h-[52px] w-full shrink-0 rounded-2xl bg-[#FF0702] text-[17px] font-semibold text-white"
            data-hydration-confirm-level
          >
            C&apos;est bon
          </button>
        </>
      ) : null}

      {phase === 'drink' ? (
        <>
          <div className="shrink-0 text-center">
            <h2 className="mt-1 text-[21px] font-bold tracking-tight text-white">{label}</h2>
            <p className="mt-1 text-[15px] font-semibold text-white">Combien tu as bu&nbsp;?</p>
            <p
              className="mt-2 text-[28px] font-bold tabular-nums tracking-tight text-white"
              data-hydration-drunk-big
            >
              {drunkMl.toLocaleString('fr-FR')}&nbsp;ml
            </p>
          </div>

          {bottleSlot(
            <>
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
                interactive={!toast}
                dragStepMl={WATER_DRAG_STEP_ML}
                onRemainingChange={setRemainingMl}
                onDraggingChange={setDragging}
                onDragEnd={onDragEnd}
                className="!max-h-[min(46dvh,400px)]"
              />
              {drunkMl > 0 ? (
                <div
                  className="pointer-events-none absolute z-40 rounded-lg border border-[#FF0702]/45 bg-[#0B0B0D] px-2.5 py-1"
                  style={{ bottom: `calc(${startPct}% + 6px)`, right: 4 }}
                  data-hydration-drunk-label
                >
                  <p className="text-[11px] font-semibold text-[#FF907F]">partie bue</p>
                </div>
              ) : null}
            </>,
          )}

          <div className="mt-2 flex shrink-0 flex-col items-center gap-2 pb-1">
            {toast ? (
              <div className="w-full max-w-sm">
                <HydrationUndoToast
                  amountMl={toast.amountMl}
                  progress={toastProgress}
                  onUndo={handleUndo}
                  onDismiss={() => setToast(null)}
                />
              </div>
            ) : (
              <p className="text-[15px] font-medium text-[#ACB4BA]" data-hydration-release-hint>
                {dragging || drunkMl > 0 ? 'Lâche pour ajouter' : 'Glisse vers le bas'}
              </p>
            )}
            <button
              type="button"
              onClick={goToSetupFresh}
              className="ios-press text-[13px] font-medium text-[#8E8E93] underline-offset-2 hover:underline"
              data-hydration-reset-level
            >
              Bouteille remplie · Régler le niveau
            </button>
          </div>
        </>
      ) : null}
    </div>
  )

  return createPortal(overlay, document.body)
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

export { UNDO_TOAST_MS, MlBubble, resolveOpenPhase }
