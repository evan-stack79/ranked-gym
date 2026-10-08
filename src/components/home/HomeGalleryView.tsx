import { ChevronRight, Dumbbell, NotebookPen } from 'lucide-react'
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
import { getHomeGreetingSubtitle, resolveDisplayFirstName } from '../../utils/homeGreeting'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { findActiveStrengthSession } from '../../utils/trainHub'
import { BlurInText, CountUpNumber, Reveal, SoftBlurIn } from '../motion'
import { HistorySessionThumb } from '../training/HistorySessionThumb'

interface HomeGalleryViewProps {
  onStartTraining: (routineId: string) => void
  onOpenTraining: () => void
  onOpenHistory: () => void
}

/**
 * Accueil gallery (iOS Photos-inspired) — default Accueil.
 * No calories, no weight, no body photos — progress % = session/program only.
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

  return (
    <div
      className={`accueil-gallery flex flex-col gap-7 ${coldEntering ? 'home-cold-enter home-cold-enter--active' : ''}`}
      data-accueil-gallery="1"
    >
      <header className="home-cold-enter__group home-cold-enter__group--0 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[34px] font-bold leading-none tracking-tight text-white">
            <BlurInText as="span" instant={coldEntering} label="Accueil">
              Accueil
            </BlurInText>
          </h1>
          <p className="mt-2 text-[15px] font-medium text-[#AEAEB2]">
            <SoftBlurIn instant={coldEntering}>
              {subtitle}
              {firstName ? ` · ${firstName}` : ''}
            </SoftBlurIn>
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenTraining}
          className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/45"
          aria-label="Ouvrir Train"
        >
          <NotebookPen className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <section aria-label="À la une" className="home-cold-enter__group home-cold-enter__group--1 -mx-5">
        <div
          className="accueil-gallery__carousel flex gap-3 overflow-x-auto px-5 pb-1"
          data-accueil-carousel
          style={{
            scrollSnapType: prefersReducedMotion ? 'none' : 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {heroCards.map((card, index) => (
            <Reveal
              key={card.id}
              as="div"
              delayMs={Math.min(index * 60, 80)}
              instant={coldEntering}
              className="shrink-0"
            >
              <button
                type="button"
                onClick={() => handleHero(card)}
                data-accueil-hero={card.id}
                className="accueil-gallery__hero ios-press relative overflow-hidden rounded-[24px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/50"
                style={{
                  width: 'min(78vw, 18.5rem)',
                  aspectRatio: '3 / 4',
                  scrollSnapAlign: 'start',
                }}
                aria-label={`${card.title}, ${card.progressPercent} pour cent`}
              >
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

                <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
                  {card.progressPercent}&nbsp;%
                </span>

                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3.5 pb-3.5 pt-16">
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
                            instant={coldEntering}
                          />{' '}
                          série{active.doneSetCount > 1 ? 's' : ''} faite
                          {active.doneSetCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="mt-0.5 block truncate text-[13px] text-white/70">
                          <SoftBlurIn delayMs={40} instant={coldEntering}>
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
          <span className="w-2 shrink-0" aria-hidden="true" />
        </div>
      </section>

      <section
        aria-label="Récent"
        data-accueil-recent
        className="home-cold-enter__group home-cold-enter__group--2"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[20px] font-bold tracking-tight text-white">
            <BlurInText as="span" delayMs={40} instant={coldEntering} label="Récent">
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
              <CountUpNumber kind="sessions" value={recent.length} instant={coldEntering} />
            </span>
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="text-[14px] text-[#8E8E93]">
            <SoftBlurIn instant={coldEntering}>Aucune séance enregistrée</SoftBlurIn>
          </p>
        ) : (
          <div
            className="accueil-gallery__tiles -mx-5 flex gap-3 overflow-x-auto px-5 pb-1"
            style={{
              scrollSnapType: prefersReducedMotion ? 'none' : 'x proximity',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {recent.map((item, index) => (
              <Reveal
                key={item.id}
                as="div"
                delayMs={Math.min(index * 60, 80)}
                instant={coldEntering}
                className="shrink-0"
              >
                <button
                  type="button"
                  onClick={onOpenHistory}
                  data-accueil-recent-tile={item.id}
                  className="ios-press flex w-[7.75rem] flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[18px] bg-[#1C1C1E] ring-1 ring-white/8">
                    <HistorySessionThumb note={item.note} />
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
          </div>
        )}
      </section>

      <section
        aria-label="Programme"
        data-accueil-program
        className="home-cold-enter__group home-cold-enter__group--3"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[20px] font-bold tracking-tight text-white">
            <BlurInText as="span" delayMs={60} instant={coldEntering} label="Programme">
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
            <SoftBlurIn instant={coldEntering}>Aucune routine dans ton programme</SoftBlurIn>
          </p>
        ) : (
          <div
            className="accueil-gallery__tiles -mx-5 flex gap-3 overflow-x-auto px-5 pb-1"
            style={{
              scrollSnapType: prefersReducedMotion ? 'none' : 'x proximity',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {programTiles.map((tile, index) => (
              <Reveal
                key={tile.id}
                as="div"
                delayMs={Math.min(index * 60, 80)}
                instant={coldEntering}
                className="shrink-0"
              >
                <button
                  type="button"
                  onClick={onOpenTraining}
                  data-accueil-program-tile={tile.id}
                  className="ios-press flex w-[7.75rem] flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-[#2A2A2E] to-[#141416] ring-1 ring-white/8">
                    <Dumbbell className="h-7 w-7 text-[#AEAEB2]" strokeWidth={1.75} aria-hidden="true" />
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
          </div>
        )}
      </section>
    </div>
  )
}
