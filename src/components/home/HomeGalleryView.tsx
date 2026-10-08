import { ChevronRight, Dumbbell, NotebookPen, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTrainingState } from '../../services/trainingStorage'
import {
  deriveGalleryHeroCards,
  deriveGalleryProgramTiles,
  deriveGalleryRecent,
  formatGalleryRecentMeta,
  type GalleryHeroCard,
} from '../../utils/accueilGallery'
import {
  loadAccueilWidgetPrefs,
  resolveVisibleAccueilWidgets,
  type AccueilWidgetId,
  type AccueilWidgetPrefs,
} from '../../utils/accueilWidgetPrefs'
import { getHomeGreetingSubtitle, resolveDisplayFirstName } from '../../utils/homeGreeting'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { findActiveStrengthSession } from '../../utils/trainHub'
import { BlurInText, CountUpNumber, Reveal, SoftBlurIn } from '../motion'
import { HistorySessionThumb } from '../training/HistorySessionThumb'
import { AccueilEditSheet } from './AccueilEditSheet'

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

/**
 * Accueil gallery (iOS Photos-inspired) — default Accueil.
 * No calories, no weight, no body photos — progress % = session/program only.
 * Widget order/visibility from local prefs (R-04); never-customised users see
 * Séance du jour → Récent → Programme.
 * Motion (#88): Blur In Up titles, Soft Blur subtitles, Mask Reveal cards,
 * CountUp on session / successful-set counts only.
 */
export function HomeGalleryView({
  onStartTraining,
  onOpenTraining,
  onOpenHistory,
}: HomeGalleryViewProps) {
  const { user, profile } = useAuth()
  const [trainingTick, setTrainingTick] = useState(0)
  const [prefs, setPrefs] = useState<AccueilWidgetPrefs>(() => loadAccueilWidgetPrefs())
  const [editOpen, setEditOpen] = useState(false)
  const [coldEntering, setColdEntering] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.dataset.coldLaunchLanding === '1'
  })
  const prefersReducedMotion = usePrefersReducedMotion()

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

  const state = useMemo(() => getTrainingState(), [trainingTick])
  const heroCards = useMemo(() => deriveGalleryHeroCards(state), [state])
  const recent = useMemo(() => deriveGalleryRecent(state, new Date(), 8), [state])
  const programTiles = useMemo(() => deriveGalleryProgramTiles(state), [state])
  const active = useMemo(() => findActiveStrengthSession(state), [state])
  const visibleWidgets = useMemo(() => resolveVisibleAccueilWidgets(prefs), [prefs])
  const subtitle = getHomeGreetingSubtitle()
  const firstName = resolveDisplayFirstName({
    firstName: user?.firstName,
    displayName: user?.displayName,
    pseudo: profile?.pseudo,
  })

  const handleHero = (card: GalleryHeroCard) => {
    if (card.cta === 'start' && card.routineId) {
      onStartTraining(card.routineId)
      return
    }
    onOpenTraining()
  }

  const snapStyle = {
    scrollSnapType: prefersReducedMotion ? ('none' as const) : ('x proximity' as const),
    WebkitOverflowScrolling: 'touch' as const,
  }
  const heroSnapStyle = {
    scrollSnapType: prefersReducedMotion ? ('none' as const) : ('x mandatory' as const),
    WebkitOverflowScrolling: 'touch' as const,
  }

  const renderSeance = () => (
    <section
      key="seance"
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
            delayMs={prefersReducedMotion ? 0 : Math.min(index * 60, 80)}
            instant={coldEntering || prefersReducedMotion}
            className={`accueil-gallery__snap shrink-0 ${index > 0 ? 'accueil-gallery__tile-gap' : ''}`}
          >
            <button
              type="button"
              onClick={() => handleHero(card)}
              data-accueil-hero={card.id}
              className="accueil-gallery__hero ios-press relative overflow-hidden rounded-[24px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/50"
              aria-label={`${card.title}, ${card.progressPercent} pour cent`}
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
          </Reveal>
        ))}
        <GalleryEdgeSpacer end />
      </div>
    </section>
  )

  const renderRecent = () => (
    <section
      key="recent"
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
            instant={coldEntering || prefersReducedMotion}
            label="Récent"
          >
            Récent
          </BlurInText>
        </h2>
        <button
          type="button"
          onClick={onOpenHistory}
          className="ios-press flex min-h-11 items-center gap-1 rounded-xl px-1.5 text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
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
              delayMs={prefersReducedMotion ? 0 : Math.min(index * 60, 80)}
              instant={coldEntering || prefersReducedMotion}
              className={`accueil-gallery__snap shrink-0 ${index > 0 ? 'accueil-gallery__tile-gap' : ''}`}
            >
              <button
                type="button"
                onClick={onOpenHistory}
                data-accueil-recent-tile={item.id}
                className="accueil-gallery__tile ios-press flex flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
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

  const renderProgramme = () => (
    <section
      key="programme"
      aria-label="Programme"
      data-accueil-widget="programme"
      data-accueil-program
      className="home-cold-enter__group home-cold-enter__group--3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[20px] font-bold tracking-tight text-white">
          <BlurInText
            as="span"
            delayMs={prefersReducedMotion ? 0 : 60}
            instant={coldEntering || prefersReducedMotion}
            label="Programme"
          >
            Programme
          </BlurInText>
        </h2>
        <button
          type="button"
          onClick={onOpenTraining}
          className="ios-press flex min-h-11 items-center gap-1 rounded-xl px-1.5 text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
          aria-label={`Voir le programme, ${programTiles.length} routine${programTiles.length > 1 ? 's' : ''}`}
        >
          <span className="text-[15px] font-semibold tabular-nums">{programTiles.length}</span>
          <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {programTiles.length === 0 ? (
        <p className="text-[14px] text-[#8E8E93]">
          <SoftBlurIn instant={coldEntering || prefersReducedMotion}>
            Aucune routine dans ton programme
          </SoftBlurIn>
        </p>
      ) : (
        <div className="accueil-gallery__tiles -mx-5 flex overflow-x-auto pb-1" style={snapStyle}>
          <GalleryEdgeSpacer />
          {programTiles.map((tile, index) => (
            <Reveal
              key={tile.id}
              as="div"
              delayMs={prefersReducedMotion ? 0 : Math.min(index * 60, 80)}
              instant={coldEntering || prefersReducedMotion}
              className={`accueil-gallery__snap shrink-0 ${index > 0 ? 'accueil-gallery__tile-gap' : ''}`}
            >
              <button
                type="button"
                onClick={onOpenTraining}
                data-accueil-program-tile={tile.id}
                className="accueil-gallery__tile ios-press flex flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
              >
                <span className="accueil-gallery__tile-media relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-[#2A2A2E] to-[#141416] ring-1 ring-white/8">
                  {tile.imageSrc ? (
                    <img
                      src={tile.imageSrc}
                      alt=""
                      draggable={false}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover object-center"
                      data-accueil-program-img="cover"
                    />
                  ) : (
                    <Dumbbell
                      className="h-7 w-7 text-[#AEAEB2]"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {tile.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#8E8E93]">
                    {tile.meta}
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

  const renderWidget = (id: AccueilWidgetId) => {
    switch (id) {
      case 'seance':
        return renderSeance()
      case 'recent':
        return renderRecent()
      case 'programme':
        return renderProgramme()
      default:
        return null
    }
  }

  const handlePrefsSaved = (next: AccueilWidgetPrefs) => {
    setPrefs(next)
    window.dispatchEvent(new Event('ranked-gym:accueil-widgets-changed'))
  }

  return (
    <div
      className={`accueil-gallery flex flex-col gap-7 ${coldEntering ? 'home-cold-enter home-cold-enter--active' : ''}`}
      data-accueil-gallery="1"
    >
      <header className="home-cold-enter__group home-cold-enter__group--0 flex items-start justify-between gap-3">
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
            onClick={() => setEditOpen(true)}
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
      </header>

      {visibleWidgets.map((id) => renderWidget(id))}

      <div className="home-cold-enter__group flex justify-center pb-2 pt-1">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="ios-press min-h-11 rounded-xl px-3 text-[13px] font-medium text-[#8E8E93] underline-offset-2 hover:text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
          data-accueil-edit-open-footer
        >
          Modifier l&apos;accueil
        </button>
      </div>

      <AccueilEditSheet
        open={editOpen}
        prefs={prefs}
        onClose={() => setEditOpen(false)}
        onSave={handlePrefsSaved}
      />
    </div>
  )
}
