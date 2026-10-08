import { ChevronRight, Dumbbell, NotebookPen, Plus, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTodayWaterMl } from '../../services/nutritionStorage'
import { getTrainingState } from '../../services/trainingStorage'
import {
  deriveGalleryHeroCards,
  deriveGalleryRecent,
  formatGalleryRecentMeta,
  type GalleryHeroCard,
} from '../../utils/accueilGallery'
import { hitTestWidgetId } from '../../utils/accueilEditGestures'
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
import { EditableAccueilSlot } from './EditableAccueilSlot'
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
  const { user, profile } = useAuth()
  const [trainingTick, setTrainingTick] = useState(0)
  const [waterTick, setWaterTick] = useState(0)
  const [prefs, setPrefs] = useState<AccueilWidgetPrefs>(() => loadAccueilWidgetPrefs())
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [waterGoalOpen, setWaterGoalOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<AccueilWidgetId | null>(null)
  const [coldEntering, setColdEntering] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.dataset.coldLaunchLanding === '1'
  })
  const prefersReducedMotion = usePrefersReducedMotion()
  const tiltDisabled = editMode || prefersReducedMotion
  const widgetsRootRef = useRef<HTMLDivElement>(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

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
    window.addEventListener('ranked-gym:backup-restored', syncWater)
    return () => {
      window.removeEventListener('ranked-gym:water-changed', syncWater)
      window.removeEventListener('ranked-gym:backup-restored', syncWater)
    }
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
    setEditMode(true)
    setAddOpen(false)
    setWaterGoalOpen(false)
  }, [])

  const exitEdit = useCallback(() => {
    setEditMode(false)
    setAddOpen(false)
    setDraggingId(null)
  }, [])

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
  const waterModel = useMemo(
    () => deriveWaterTileModel(prefs, getTodayWaterMl()),
    [prefs, waterTick],
  )
  const visibleWidgets = useMemo(() => resolveVisibleAccueilWidgets(prefs), [prefs])
  const packs = useMemo(() => packAccueilWidgets(visibleWidgets), [visibleWidgets])
  const motion = useMemo(
    () => ({ coldEntering, prefersReducedMotion }),
    [coldEntering, prefersReducedMotion],
  )
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

  const handleDragStart = useCallback((id: AccueilWidgetId) => {
    setDraggingId(id)
  }, [])

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      setDraggingId((current) => {
        if (!current) return current
        const hit = hitTestWidgetId(clientX, clientY, collectHitRects())
        if (!hit || hit === current) return current
        const visible = resolveVisibleAccueilWidgets(prefsRef.current)
        if (!(visible as string[]).includes(hit)) return current
        commitPrefs(
          reorderVisibleAccueilWidget(
            prefsRef.current,
            current,
            hit as AccueilWidgetId,
            Date.now(),
          ),
        )
        return current
      })
    },
    [collectHitRects, commitPrefs],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
  }, [])

  const handleHide = useCallback(
    (id: AccueilWidgetId) => {
      commitPrefs(hideAccueilWidget(prefs, id, Date.now()))
    },
    [commitPrefs, prefs],
  )

  const snapStyle = {
    scrollSnapType: prefersReducedMotion || editMode ? ('none' as const) : ('x proximity' as const),
    WebkitOverflowScrolling: 'touch' as const,
  }
  const heroSnapStyle = {
    scrollSnapType: prefersReducedMotion || editMode ? ('none' as const) : ('x mandatory' as const),
    WebkitOverflowScrolling: 'touch' as const,
  }

  const wrapEditable = (id: AccueilWidgetId, child: ReactNode) => (
    <EditableAccueilSlot
      key={`slot-${id}`}
      id={id}
      editMode={editMode}
      reducedMotion={prefersReducedMotion}
      dragging={draggingId === id}
      onEnterEdit={enterEdit}
      onHide={handleHide}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
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
            delayMs={prefersReducedMotion || editMode ? 0 : Math.min(index * 60, 80)}
            instant={coldEntering || prefersReducedMotion || editMode}
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
            delayMs={prefersReducedMotion ? 0 : 40}
            instant={coldEntering || prefersReducedMotion || editMode}
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
              delayMs={prefersReducedMotion || editMode ? 0 : Math.min(index * 60, 80)}
              instant={coldEntering || prefersReducedMotion || editMode}
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
        instant={coldEntering || prefersReducedMotion || editMode}
        delayMs={prefersReducedMotion || editMode ? 0 : 40}
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
      <header className="home-cold-enter__group home-cold-enter__group--0 flex items-start justify-between gap-3">
        {editMode ? (
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
        {packs.map((pack, packIndex) => {
          if (pack.kind === 'wide') {
            return (
              <div key={`wide-${pack.id}-${packIndex}`} className="accueil-widgets__wide">
                {wrapEditable(pack.id, renderWidgetBody(pack.id))}
              </div>
            )
          }
          return (
            <div
              key={`row-${pack.ids.join('-')}-${packIndex}`}
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
          setPrefs(next)
          window.dispatchEvent(new Event('ranked-gym:accueil-widgets-changed'))
        }}
      />
      <WaterGoalSheet
        open={waterGoalOpen && !editMode}
        prefs={prefs}
        onClose={() => setWaterGoalOpen(false)}
        onSave={(next) => {
          setPrefs(next)
          window.dispatchEvent(new Event('ranked-gym:accueil-widgets-changed'))
        }}
      />
    </div>
  )
}
