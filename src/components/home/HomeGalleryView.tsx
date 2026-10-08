import { ChevronRight, Dumbbell, NotebookPen, Plus, SlidersHorizontal } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { getTodayWaterMl } from '../../services/nutritionStorage'
import {
  getUserWaterGoalMl,
  migrateAccueilWaterGoalFromPrefs,
  WATER_GOAL_CHANGED_EVENT,
} from '../../utils/userWaterGoal'
import { getTrainingState } from '../../services/trainingStorage'
import {
  deriveGalleryHeroCards,
  deriveGalleryRecent,
  formatGalleryRecentMeta,
  type GalleryHeroCard,
} from '../../utils/accueilGallery'
import { hitTestWidgetId } from '../../utils/accueilEditGestures'
import {
  ACCUEIL_ENTER_MS,
  ACCUEIL_EXIT_MS,
  ACCUEIL_FLIP_MS,
  captureSlotRects,
  runFlipFromFirst,
} from '../../utils/accueilFlip'
import { attachHorizontalScrollAxisLock } from '../../utils/horizontalScrollAxisLock'
import {
  ACCUEIL_WIDGET_SIZE,
  hideAccueilWidget,
  loadAccueilWidgetPrefs,
  reorderVisibleAccueilWidget,
  resolveVisibleAccueilWidgets,
  saveAccueilWidgetPrefs,
  type AccueilWidgetId,
  type AccueilWidgetPrefs,
} from '../../utils/accueilWidgetPrefs'
import {
  deriveNextSessionTile,
  deriveProgramTileModel,
  deriveSetsTileModel,
  deriveWaterTileModel,
  deriveWeekSessionBars,
} from '../../utils/accueilWidgetTiles'
import { getHomeGreetingSubtitle, resolveDisplayFirstName } from '../../utils/homeGreeting'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { findActiveStrengthSession } from '../../utils/trainHub'
import { BlurInText, CountUpNumber, Reveal, SoftBlurIn, TiltCard } from '../motion'
import { HistorySessionThumb } from '../training/HistorySessionThumb'
import { AccueilAddSheet } from './AccueilAddSheet'
import {
  EauTile,
  ProchaineSeanceTile,
  ProgrammeProgressTile,
  SeancesSemaineTile,
  SeriesJourTile,
} from './AccueilMetricTiles'
import {
  EditableAccueilSlot,
  type DragFloatRect,
  type DragPoint,
} from './EditableAccueilSlot'
import { WaterGoalSheet } from './WaterGoalSheet'

interface HomeGalleryViewProps {
  onStartTraining: (routineId: string) => void
  onOpenTraining: () => void
  onOpenHistory: () => void
}

function GalleryEdgeSpacer({ end = false }: { end?: boolean }) {
  return (
    <span
      className={
        end
          ? 'accueil-gallery__edge-spacer accueil-gallery__edge-spacer--end'
          : 'accueil-gallery__edge-spacer'
      }
      aria-hidden="true"
    />
  )
}

type WidgetPack =
  | { kind: 'wide'; id: AccueilWidgetId }
  | { kind: 'row'; ids: AccueilWidgetId[] }

/** Pack consecutive small tiles into 2-column rows. */
export function packAccueilWidgets(ids: AccueilWidgetId[]): WidgetPack[] {
  const packs: WidgetPack[] = []
  let smallBuf: AccueilWidgetId[] = []

  const flushSmall = () => {
    if (smallBuf.length === 0) return
    packs.push({ kind: 'row', ids: smallBuf })
    smallBuf = []
  }

  for (const id of ids) {
    if (ACCUEIL_WIDGET_SIZE[id] === 'small') {
      smallBuf.push(id)
      if (smallBuf.length === 2) flushSmall()
    } else {
      flushSmall()
      packs.push({ kind: 'wide', id })
    }
  }
  flushSmall()
  return packs
}

/**
 * Accueil gallery — hero cards + coloured metric tiles.
 * In-place iOS-style edit: long-press / « Modifier l'accueil », wiggle, drag, trash, + Ajouter.
 */
export function HomeGalleryView({
  onStartTraining,
  onOpenTraining,
  onOpenHistory,
}: HomeGalleryViewProps) {
  const { user, profile, isLoading: authLoading } = useAuth()
  const [trainingTick, setTrainingTick] = useState(0)
  const [waterTick, setWaterTick] = useState(0)
  /** Last confirmed positive water total — suppresses 0-flash across remounts. */
  const lastKnownWaterMlRef = useRef<number | null>(null)
  const [prefs, setPrefs] = useState<AccueilWidgetPrefs>(() => loadAccueilWidgetPrefs())
  const [editMode, setEditMode] = useState(false)
  /**
   * Once edit mode has been entered, keep Reveal on `instant` forever for this
   * mount. Toggling `instant` false→true→false restarts mask-reveal from
   * clip-path: inset(100%) (black flash — same class of bug as #95 remount).
   */
  const [freezeReveals, setFreezeReveals] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [waterGoalOpen, setWaterGoalOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<AccueilWidgetId | null>(null)
  /** Absolute viewport rect of the lifted tile (finger − grab offset). */
  const [dragFloat, setDragFloat] = useState<DragFloatRect | null>(null)
  const [exitingId, setExitingId] = useState<AccueilWidgetId | null>(null)
  const [enteringId, setEnteringId] = useState<AccueilWidgetId | null>(null)
  /** Drop glide: dragged tile slides into its slot instead of snapping. */
  const [dropGlide, setDropGlide] = useState<{
    id: AccueilWidgetId
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [coldEntering, setColdEntering] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.dataset.coldLaunchLanding === '1'
  })
  const prefersReducedMotion = usePrefersReducedMotion()
  const tiltDisabled = editMode || prefersReducedMotion
  const revealInstant = coldEntering || prefersReducedMotion || freezeReveals
  const widgetsRootRef = useRef<HTMLDivElement>(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const draggingIdRef = useRef<AccueilWidgetId | null>(null)
  draggingIdRef.current = draggingId
  /** Grab offset inside the tile — float = client − offset (no slotBox race). */
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const dragSizeRef = useRef<{ width: number; height: number } | null>(null)
  const flipFirstRef = useRef<Map<string, DOMRect> | null>(null)
  const enterTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const sync = () => setTrainingTick((n) => n + 1)
    window.addEventListener('ranked-gym:backup-restored', sync)
    window.addEventListener('ranked-gym:discipline-changed', sync)
    window.addEventListener('ranked-gym:training-changed', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', sync)
      window.removeEventListener('ranked-gym:discipline-changed', sync)
      window.removeEventListener('ranked-gym:training-changed', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  useEffect(() => {
    const syncWater = () => setWaterTick((n) => n + 1)
    window.addEventListener('ranked-gym:water-changed', syncWater)
    window.addEventListener(WATER_GOAL_CHANGED_EVENT, syncWater)
    window.addEventListener('ranked-gym:backup-restored', syncWater)
    return () => {
      window.removeEventListener('ranked-gym:water-changed', syncWater)
      window.removeEventListener(WATER_GOAL_CHANGED_EVENT, syncWater)
      window.removeEventListener('ranked-gym:backup-restored', syncWater)
    }
  }, [])

  useEffect(() => {
    // One-time migrate prefs.waterGoalMl → ranked-gym:water-goal
    migrateAccueilWaterGoalFromPrefs()
    setWaterTick((n) => n + 1)
  }, [])

  useEffect(() => {
    const reloadPrefs = () => setPrefs(loadAccueilWidgetPrefs())
    window.addEventListener('ranked-gym:accueil-widgets-changed', reloadPrefs)
    window.addEventListener('storage', reloadPrefs)
    return () => {
      window.removeEventListener('ranked-gym:accueil-widgets-changed', reloadPrefs)
      window.removeEventListener('storage', reloadPrefs)
    }
  }, [])

  useEffect(() => {
    const onColdLanding = () => setColdEntering(true)
    window.addEventListener('ranked-gym:cold-launch-landing', onColdLanding)
    return () => window.removeEventListener('ranked-gym:cold-launch-landing', onColdLanding)
  }, [])

  useEffect(() => {
    if (!coldEntering) return
    delete document.documentElement.dataset.coldLaunchLanding
    const t = window.setTimeout(() => setColdEntering(false), 320)
    return () => window.clearTimeout(t)
  }, [coldEntering])

  const commitPrefs = useCallback((next: AccueilWidgetPrefs) => {
    const saved = saveAccueilWidgetPrefs(next)
    setPrefs(saved)
    window.dispatchEvent(new Event('ranked-gym:accueil-widgets-changed'))
  }, [])

  const enterEdit = useCallback(() => {
    // Lock reveals BEFORE editMode flips so instant never toggles back off.
    setFreezeReveals(true)
    setEditMode(true)
    setAddOpen(false)
    setWaterGoalOpen(false)
  }, [])

  const clearDrag = useCallback(() => {
    setDraggingId(null)
    setDragFloat(null)
    dragOffsetRef.current = null
    dragSizeRef.current = null
  }, [])

  /** End drag: optional drop-glide into the final slot, then clear lift state. */
  const finishDrag = useCallback(
    (opts?: { skipGlide?: boolean }) => {
      const id = draggingIdRef.current
      if (!id) return
      // Synchronous guard — slot pointerup + window pointerup can both fire.
      draggingIdRef.current = null
      if (!opts?.skipGlide && !prefersReducedMotion) {
        // Floating body is portaled to document.body — not under widgetsRoot.
        const body = document.querySelector(
          `[data-accueil-edit-body="${id}"]`,
        ) as HTMLElement | null
        if (body) {
          const from = body.getBoundingClientRect()
          if (from.width > 0 && from.height > 0) {
            setDropGlide({
              id,
              left: from.left,
              top: from.top,
              width: from.width,
              height: from.height,
            })
          }
        }
      } else {
        setDropGlide(null)
      }
      clearDrag()
    },
    [clearDrag, prefersReducedMotion],
  )

  const exitEdit = useCallback(() => {
    setEditMode(false)
    setAddOpen(false)
    setDropGlide(null)
    clearDrag()
    setExitingId(null)
    setEnteringId(null)
    if (enterTimerRef.current != null) {
      window.clearTimeout(enterTimerRef.current)
      enterTimerRef.current = null
    }
  }, [clearDrag])

  // Sheet open must never leave a tile stuck in the lifted drag state.
  useEffect(() => {
    if (addOpen || waterGoalOpen) finishDrag({ skipGlide: true })
  }, [addOpen, waterGoalOpen, finishDrag])

  // Disable scroll anchoring on the page scroller while editing — otherwise the
  // browser retargets scrollTop on reorder and FLIP slides look like teleports.
  useEffect(() => {
    const main = document.querySelector('[data-app-scroll-main]')
    if (!(main instanceof HTMLElement)) return
    if (!editMode) {
      main.style.overflowAnchor = ''
      return
    }
    main.style.overflowAnchor = 'none'
    return () => {
      main.style.overflowAnchor = ''
    }
  }, [editMode])

  const state = useMemo(() => getTrainingState(), [trainingTick])
  const heroCards = useMemo(() => deriveGalleryHeroCards(state), [state])
  const recent = useMemo(() => deriveGalleryRecent(state, new Date(), 8), [state])
  const active = useMemo(() => findActiveStrengthSession(state), [state])
  const weekBars = useMemo(() => deriveWeekSessionBars(state), [state])
  const weekSessionCount = useMemo(
    () => weekBars.reduce((sum, b) => sum + b.count, 0),
    [weekBars],
  )
  const setsModel = useMemo(() => deriveSetsTileModel(state), [state])
  const nextSession = useMemo(() => deriveNextSessionTile(state), [state])
  const programModel = useMemo(() => deriveProgramTileModel(state), [state])
  const waterModel = useMemo(() => {
    // Accueil Eau is read-only: getTodayWaterMl / getUserWaterGoalMl only.
    // Never call addWaterEntry / setWaterTotal / saveJournal from this view.
    const ml = getTodayWaterMl()
    const goal = getUserWaterGoalMl()
    if (ml > 0) lastKnownWaterMlRef.current = ml
    // Ready once hydrate finished, or we already have a positive local total.
    const ready = ml > 0 || !authLoading
    // During edit / freeze: never substitute a 0 over a known positive total
    // (avoids painting « 0 ml » if a remount races a storage tick).
    const freeze = editMode || freezeReveals
    const displayMl =
      freeze && ml === 0 && lastKnownWaterMlRef.current != null
        ? lastKnownWaterMlRef.current
        : ml
    return deriveWaterTileModel(displayMl, goal, ready)
  }, [waterTick, authLoading, editMode, freezeReveals])
  const visibleWidgets = useMemo(() => resolveVisibleAccueilWidgets(prefs), [prefs])
  const packs = useMemo(() => packAccueilWidgets(visibleWidgets), [visibleWidgets])
  const visibleOrderKey = visibleWidgets.join('|')

  // Horizontal carousels: lock to vertical when the swipe is vertical-dominant
  // so scroll-snap cannot jerk the page “bas gauche” on Accueil scroll.
  useEffect(() => {
    if (editMode || prefersReducedMotion) return
    const root =
      widgetsRootRef.current?.closest('[data-accueil-gallery]') ??
      document.querySelector('[data-accueil-gallery]')
    if (!(root instanceof HTMLElement)) return
    const strips = [
      ...root.querySelectorAll<HTMLElement>(
        '[data-accueil-carousel], .accueil-gallery__tiles',
      ),
    ]
    const handles = strips.map((el) => attachHorizontalScrollAxisLock(el))
    return () => {
      for (const h of handles) h.destroy()
    }
  }, [editMode, prefersReducedMotion, visibleOrderKey])

  const motion = useMemo(
    () => ({
      coldEntering,
      prefersReducedMotion,
      // During edit / after freeze, never restart CountUp from 0 on remount.
      freezeCountUp: editMode || freezeReveals,
    }),
    [coldEntering, prefersReducedMotion, editMode, freezeReveals],
  )

  /** FLIP: after visible order changes in edit mode, slide siblings into place. */
  useLayoutEffect(() => {
    const first = flipFirstRef.current
    flipFirstRef.current = null
    if (!first || prefersReducedMotion || !editMode) return
    const root = widgetsRootRef.current
    if (!root) return
    // Animate layout slots (not floating bodies) so text never ghosts under the drag.
    // Clears in-flight transforms before measuring Last → interruptible, no jump.
    runFlipFromFirst(root, first, {
      skipId: draggingId,
      ms: ACCUEIL_FLIP_MS,
    })
  }, [visibleOrderKey, editMode, prefersReducedMotion, draggingId])
  const subtitle = getHomeGreetingSubtitle()
  const firstName = resolveDisplayFirstName({
    firstName: user?.firstName,
    displayName: user?.displayName,
    pseudo: profile?.pseudo,
  })

  const handleHero = (card: GalleryHeroCard) => {
    if (editMode) return
    if (card.cta === 'start' && card.routineId) {
      onStartTraining(card.routineId)
      return
    }
    onOpenTraining()
  }

  const collectHitRects = useCallback(() => {
    const root = widgetsRootRef.current
    if (!root) return []
    return [...root.querySelectorAll('[data-accueil-edit-slot]')].map((el) => {
      const id = el.getAttribute('data-accueil-edit-slot') || ''
      const r = el.getBoundingClientRect()
      return { id, left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    })
  }, [])

  const captureFlipFirst = useCallback(() => {
    const root = widgetsRootRef.current
    if (!root || prefersReducedMotion) return
    // Visual positions (includes mid-FLIP transforms) so the next Invert starts
    // from where the tile currently appears — no jump on fast reorders.
    flipFirstRef.current = captureSlotRects(root)
  }, [prefersReducedMotion])

  const handleDragStart = useCallback((id: AccueilWidgetId, point: DragPoint) => {
    setDropGlide(null)
    setDraggingId(id)
    draggingIdRef.current = id
    dragOffsetRef.current = { x: point.offsetX, y: point.offsetY }
    const slot = widgetsRootRef.current?.querySelector(
      `[data-accueil-edit-slot="${id}"]`,
    ) as HTMLElement | null
    const r = slot?.getBoundingClientRect()
    const width = r && r.width > 0 ? r.width : 0
    const height = r && r.height > 0 ? r.height : 0
    if (width > 0 && height > 0) {
      dragSizeRef.current = { width, height }
      setDragFloat({
        left: point.clientX - point.offsetX,
        top: point.clientY - point.offsetY,
        width,
        height,
      })
    } else {
      setDragFloat({
        left: point.clientX - point.offsetX,
        top: point.clientY - point.offsetY,
        width: dragSizeRef.current?.width ?? 0,
        height: dragSizeRef.current?.height ?? 0,
      })
    }
  }, [])

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      const offset = dragOffsetRef.current
      const size = dragSizeRef.current
      if (offset && size) {
        // Absolute finger tracking — reorder remount cannot yank the lift.
        setDragFloat({
          left: clientX - offset.x,
          top: clientY - offset.y,
          width: size.width,
          height: size.height,
        })
      }
      const current = draggingIdRef.current
      if (!current) return
      const hit = hitTestWidgetId(clientX, clientY, collectHitRects())
      if (!hit || hit === current) return
      const visible = resolveVisibleAccueilWidgets(prefsRef.current)
      if (!(visible as string[]).includes(hit)) return

      // First = current visual positions (incl. mid-FLIP) before layout commits.
      captureFlipFirst()
      commitPrefs(
        reorderVisibleAccueilWidget(
          prefsRef.current,
          current,
          hit as AccueilWidgetId,
          Date.now(),
        ),
      )
    },
    [captureFlipFirst, collectHitRects, commitPrefs],
  )

  const handleDragEnd = useCallback(() => {
    finishDrag()
  }, [finishDrag])

  // Reorder remounts the slot under the finger — keep drag alive via window
  // pointermove, and always clear on pointerup/cancel (no stuck lift).
  // Custom event covers synthetic tests where pointerup hits a detached node.
  useEffect(() => {
    if (!draggingId) return
    const onMove = (e: PointerEvent) => {
      handleDragMove(e.clientX, e.clientY)
    }
    const onUp = () => finishDrag()
    // Force-clear still glides when a floating body is measurable (capture scripts
    // fire this after pointerup); skip only if drag already ended.
    const onForce = () => finishDrag()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('ranked-gym:accueil-force-drag-end', onForce)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('ranked-gym:accueil-force-drag-end', onForce)
    }
  }, [draggingId, finishDrag, handleDragMove])

  const handleHide = useCallback(
    (id: AccueilWidgetId) => {
      if (prefersReducedMotion) {
        captureFlipFirst()
        commitPrefs(hideAccueilWidget(prefsRef.current, id, Date.now()))
        return
      }
      setExitingId(id)
      window.setTimeout(() => {
        captureFlipFirst()
        commitPrefs(hideAccueilWidget(prefsRef.current, id, Date.now()))
        setExitingId(null)
      }, ACCUEIL_EXIT_MS)
    },
    [captureFlipFirst, commitPrefs, prefersReducedMotion],
  )

  const handleDropGlideDone = useCallback((id: AccueilWidgetId) => {
    setDropGlide((current) => (current?.id === id ? null : current))
  }, [])

  // proximity (not mandatory): diagonal vertical swipes must not yank the strip sideways.
  const snapStyle = {
    scrollSnapType: prefersReducedMotion || editMode ? ('none' as const) : ('x proximity' as const),
    WebkitOverflowScrolling: 'touch' as const,
  }
  const heroSnapStyle = {
    scrollSnapType: prefersReducedMotion || editMode ? ('none' as const) : ('x proximity' as const),
    WebkitOverflowScrolling: 'touch' as const,
  }

  const wrapEditable = (id: AccueilWidgetId, child: ReactNode) => (
    <EditableAccueilSlot
      key={`slot-${id}`}
      id={id}
      editMode={editMode}
      reducedMotion={prefersReducedMotion}
      dragging={draggingId === id}
      exiting={exitingId === id}
      entering={enteringId === id}
      dropGlide={dropGlide?.id === id ? dropGlide : null}
      dragFloat={draggingId === id ? dragFloat : null}
      onEnterEdit={enterEdit}
      onHide={handleHide}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDropGlideDone={handleDropGlideDone}
    >
      {child}
    </EditableAccueilSlot>
  )

  const renderSeance = () => (
    <section
      aria-label="Séance du jour"
      data-accueil-widget="seance"
      className="home-cold-enter__group home-cold-enter__group--1 -mx-5"
    >
      <div
        className="accueil-gallery__carousel flex overflow-x-auto pb-1"
        data-accueil-carousel
        style={heroSnapStyle}
      >
        <GalleryEdgeSpacer />
        {heroCards.map((card, index) => (
          <Reveal
            key={card.id}
            as="div"
            delayMs={revealInstant ? 0 : Math.min(index * 60, 80)}
            instant={revealInstant}
            className={`accueil-gallery__snap shrink-0 ${index > 0 ? 'accueil-gallery__tile-gap' : ''}`}
          >
            <TiltCard className="accueil-gallery__hero-tilt" disabled={tiltDisabled}>
              <button
                type="button"
                onClick={() => handleHero(card)}
                data-accueil-hero={card.id}
                className="accueil-gallery__hero ios-press relative overflow-hidden rounded-[24px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/50"
                aria-label={`${card.title}, ${card.progressPercent} pour cent`}
                disabled={editMode}
              >
                {card.imageSrc ? (
                  <img
                    src={card.imageSrc}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    data-accueil-hero-img="cover"
                  />
                ) : (
                  <>
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 ${
                        card.accent === 'brand'
                          ? 'accueil-gallery__hero-bg--brand'
                          : 'accueil-gallery__hero-bg--graphite'
                      }`}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center opacity-25"
                    >
                      <Dumbbell className="h-24 w-24 text-white" strokeWidth={1.25} />
                    </span>
                  </>
                )}

                <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
                  {card.progressPercent}&nbsp;%
                </span>

                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3.5 pb-3.5 pt-16">
                  <span className="flex items-end gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/12 ring-1 ring-white/15 backdrop-blur-sm">
                      <Dumbbell className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold leading-tight text-white">
                        {card.title}
                      </span>
                      {card.id === 'session' && active ? (
                        <span className="mt-0.5 block truncate text-[13px] text-white/70">
                          {active.title} ·{' '}
                          <CountUpNumber
                            kind="successful_sets"
                            value={active.doneSetCount}
                            instant={coldEntering || prefersReducedMotion}
                          />{' '}
                          série{active.doneSetCount > 1 ? 's' : ''} faite
                          {active.doneSetCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="mt-0.5 block truncate text-[13px] text-white/70">
                          <SoftBlurIn
                            delayMs={prefersReducedMotion ? 0 : 40}
                            instant={coldEntering || prefersReducedMotion}
                          >
                            {card.secondary}
                          </SoftBlurIn>
                        </span>
                      )}
                    </span>
                  </span>
                </span>
              </button>
            </TiltCard>
          </Reveal>
        ))}
        <GalleryEdgeSpacer end />
      </div>
    </section>
  )

  const renderRecent = () => (
    <section
      aria-label="Récent"
      data-accueil-widget="recent"
      data-accueil-recent
      className="home-cold-enter__group home-cold-enter__group--2"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[20px] font-bold tracking-tight text-white">
          <BlurInText
            as="span"
            delayMs={revealInstant ? 0 : 40}
            instant={revealInstant}
            label="Récent"
          >
            Récent
          </BlurInText>
        </h2>
        <button
          type="button"
          onClick={onOpenHistory}
          disabled={editMode}
          className="ios-press flex min-h-11 items-center gap-1 rounded-xl px-1.5 text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40 disabled:opacity-50"
          aria-label={`Voir l’historique, ${recent.length} séance${recent.length > 1 ? 's' : ''}`}
        >
          <span className="text-[15px] font-semibold tabular-nums">
            <CountUpNumber
              kind="sessions"
              value={recent.length}
              instant={coldEntering || prefersReducedMotion}
            />
          </span>
          <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93]">
          <SoftBlurIn instant={coldEntering || prefersReducedMotion}>
            Aucune séance enregistrée
          </SoftBlurIn>
        </p>
      ) : (
        <div className="accueil-gallery__tiles -mx-5 flex overflow-x-auto pb-1" style={snapStyle}>
          <GalleryEdgeSpacer />
          {recent.map((item, index) => (
            <Reveal
              key={item.id}
              as="div"
              delayMs={revealInstant ? 0 : Math.min(index * 60, 80)}
              instant={revealInstant}
              className={`accueil-gallery__snap shrink-0 ${index > 0 ? 'accueil-gallery__tile-gap' : ''}`}
            >
              <button
                type="button"
                onClick={onOpenHistory}
                disabled={editMode}
                data-accueil-recent-tile={item.id}
                className="accueil-gallery__tile ios-press flex flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40 disabled:opacity-70"
              >
                <span className="accueil-gallery__tile-media relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[18px] bg-[#1C1C1E] ring-1 ring-white/8">
                  <HistorySessionThumb note={item.note} variant="tile" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#8E8E93]">
                    {formatGalleryRecentMeta(item)}
                  </span>
                </span>
              </button>
            </Reveal>
          ))}
          <GalleryEdgeSpacer end />
        </div>
      )}
    </section>
  )

  const wrapMetric = (id: AccueilWidgetId, child: ReactNode) => (
    <section
      data-accueil-widget={id}
      className="home-cold-enter__group min-w-0 h-full"
    >
      <Reveal
        instant={revealInstant}
        delayMs={revealInstant ? 0 : 40}
        className="h-full min-w-0"
      >
        {child}
      </Reveal>
    </section>
  )

  const interactive = !editMode

  const renderMetric = (id: AccueilWidgetId): ReactNode => {
    switch (id) {
      case 'seances_semaine':
        return wrapMetric(
          id,
          <SeancesSemaineTile bars={weekBars} sessionCount={weekSessionCount} motion={motion} />,
        )
      case 'eau':
        return wrapMetric(
          id,
          <EauTile
            model={waterModel}
            motion={motion}
            interactive={interactive}
            onSetGoal={() => setWaterGoalOpen(true)}
          />,
        )
      case 'series_jour':
        return wrapMetric(id, <SeriesJourTile model={setsModel} motion={motion} />)
      case 'prochaine_seance':
        return wrapMetric(
          id,
          <ProchaineSeanceTile
            model={nextSession}
            onStart={onStartTraining}
            onOpenTrain={onOpenTraining}
            interactive={interactive}
          />,
        )
      case 'programme':
        return wrapMetric(
          id,
          <ProgrammeProgressTile
            model={programModel}
            onOpenTrain={onOpenTraining}
            motion={motion}
            interactive={interactive}
          />,
        )
      default:
        return null
    }
  }

  const renderWidgetBody = (id: AccueilWidgetId) => {
    switch (id) {
      case 'seance':
        return renderSeance()
      case 'recent':
        return renderRecent()
      case 'seances_semaine':
      case 'eau':
      case 'series_jour':
      case 'prochaine_seance':
      case 'programme':
        return renderMetric(id)
      default:
        return null
    }
  }

  // Prefer AppLayout pin host (outside scroll main). Without it (unit tests),
  // keep the chrome in-flow so queries on the gallery host still work.
  const editChromeHost =
    typeof document !== 'undefined'
      ? ((document.querySelector('[data-app-top-pin-host]') as HTMLElement | null) ??
        (document.querySelector('[data-app-shell]') as HTMLElement | null))
      : null

  const editChromeButtons = (
    <div className="accueil-edit-chrome w-full" data-accueil-edit-chrome>
      <button
        type="button"
        onClick={exitEdit}
        className="accueil-edit-chrome__ok ios-press"
        data-accueil-edit-ok
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="accueil-edit-chrome__add ios-press inline-flex items-center gap-1.5"
        data-accueil-edit-add
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        Ajouter
      </button>
    </div>
  )

  const editChromeBar =
    editMode && editChromeHost
      ? createPortal(
          <div
            className="accueil-edit-chrome-pin"
            data-accueil-edit-chrome-pin="1"
          >
            {/*
              Glass in a sibling absolute layer — never backdrop-filter on an
              ancestor of the buttons (WebKit text rasterisation).
            */}
            <div className="accueil-edit-chrome-pin__glass" aria-hidden="true" />
            <div className="accueil-edit-chrome-pin__inner">{editChromeButtons}</div>
          </div>,
          editChromeHost,
        )
      : null

  return (
    <div
      className={`accueil-gallery flex flex-col gap-7 ${coldEntering ? 'home-cold-enter home-cold-enter--active' : ''} ${
        editMode ? 'accueil-gallery--editing' : ''
      }`}
      data-accueil-gallery="1"
      data-accueil-edit-open={editMode ? '1' : '0'}
      onClick={(e) => {
        if (!editMode || addOpen) return
        const t = e.target as HTMLElement
        if (t.closest('[data-accueil-edit-slot]')) return
        if (t.closest('[data-accueil-edit-chrome]')) return
        if (t.closest('button')) return
        exitEdit()
      }}
    >
      {editChromeBar}
      <header
        className={[
          'home-cold-enter__group home-cold-enter__group--0 flex items-start justify-between gap-3',
          editMode && editChromeHost ? 'accueil-edit-chrome-spacer' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={editMode && editChromeHost ? true : undefined}
        data-accueil-edit-chrome-spacer={editMode && editChromeHost ? '1' : undefined}
      >
        {editMode ? (
          editChromeHost ? (
            // In-flow spacer matching the pin bar content height (safe-area is
            // on the fixed pin). Keeps widgets from jumping under the bar.
            <div
              className="accueil-edit-chrome w-full opacity-0 pointer-events-none"
              aria-hidden="true"
            >
              <span className="accueil-edit-chrome__ok">OK</span>
              <span className="accueil-edit-chrome__add inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                Ajouter
              </span>
            </div>
          ) : (
            editChromeButtons
          )
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h1 className="text-[34px] font-bold leading-none tracking-tight text-white">
                <BlurInText
                  as="span"
                  instant={coldEntering || prefersReducedMotion}
                  label="Accueil"
                >
                  Accueil
                </BlurInText>
              </h1>
              <p className="mt-2 text-[15px] font-medium text-[#AEAEB2]">
                <SoftBlurIn instant={coldEntering || prefersReducedMotion}>
                  {subtitle}
                  {firstName ? ` · ${firstName}` : ''}
                </SoftBlurIn>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={enterEdit}
                className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/45"
                aria-label="Modifier l'accueil"
                data-accueil-edit-open
              >
                <SlidersHorizontal className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onOpenTraining}
                className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/45"
                aria-label="Ouvrir Train"
              >
                <NotebookPen className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </header>

      <div ref={widgetsRootRef} className="accueil-widgets flex flex-col gap-3">
        {packs.map((pack) => {
          if (pack.kind === 'wide') {
            return (
              <div key={`wide-${pack.id}`} className="accueil-widgets__wide">
                {wrapEditable(pack.id, renderWidgetBody(pack.id))}
              </div>
            )
          }
          return (
            <div
              key={`row-${pack.ids.join('-')}`}
              className="accueil-widgets__row"
              data-accueil-widget-row
            >
              {pack.ids.map((id) => (
                <div key={id} className="accueil-widgets__cell min-w-0">
                  {wrapEditable(id, renderWidgetBody(id))}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {!editMode ? (
        <div className="home-cold-enter__group flex justify-center pb-2 pt-1">
          <button
            type="button"
            onClick={enterEdit}
            className="ios-press min-h-11 rounded-xl px-3 text-[13px] font-medium text-[#8E8E93] underline-offset-2 hover:text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
            data-accueil-edit-open-footer
          >
            Modifier l&apos;accueil
          </button>
        </div>
      ) : null}

      <AccueilAddSheet
        open={addOpen}
        prefs={prefs}
        onClose={() => setAddOpen(false)}
        onSave={(next) => {
          const before = resolveVisibleAccueilWidgets(prefsRef.current)
          const after = resolveVisibleAccueilWidgets(next)
          const added = after.filter((id) => !before.includes(id))
          captureFlipFirst()
          if (added.length === 1 && !prefersReducedMotion) {
            if (enterTimerRef.current != null) {
              window.clearTimeout(enterTimerRef.current)
            }
            setEnteringId(added[0])
            enterTimerRef.current = window.setTimeout(() => {
              setEnteringId(null)
              enterTimerRef.current = null
            }, ACCUEIL_ENTER_MS + 40)
          }
          setPrefs(next)
          window.dispatchEvent(new Event('ranked-gym:accueil-widgets-changed'))
        }}
      />
      <WaterGoalSheet
        open={waterGoalOpen && !editMode}
        onClose={() => setWaterGoalOpen(false)}
      />
    </div>
  )
}
