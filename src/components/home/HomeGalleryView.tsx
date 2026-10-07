import { ChevronRight, Dumbbell, NotebookPen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getTrainingState } from '../../services/trainingStorage'
import {
  deriveGalleryHeroCards,
  deriveGalleryProgramTiles,
  deriveGalleryRecent,
  formatGalleryRecentMeta,
  type GalleryHeroCard,
} from '../../utils/accueilGallery'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { HistorySessionThumb } from '../training/HistorySessionThumb'

interface HomeGalleryViewProps {
  onStartTraining: (routineId: string) => void
  onOpenTraining: () => void
  onOpenHistory: () => void
}

/**
 * Accueil gallery preview (iOS Photos-inspired layout).
 * No calories, no weight, no body photos — progress % = session/program only.
 */
export function HomeGalleryView({
  onStartTraining,
  onOpenTraining,
  onOpenHistory,
}: HomeGalleryViewProps) {
  const [trainingTick, setTrainingTick] = useState(0)
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

  const state = useMemo(() => getTrainingState(), [trainingTick])
  const heroCards = useMemo(() => deriveGalleryHeroCards(state), [state])
  const recent = useMemo(() => deriveGalleryRecent(state, new Date(), 8), [state])
  const programTiles = useMemo(() => deriveGalleryProgramTiles(state), [state])

  const handleHero = (card: GalleryHeroCard) => {
    if (card.cta === 'start' && card.routineId) {
      onStartTraining(card.routineId)
      return
    }
    onOpenTraining()
  }

  return (
    <div className="accueil-gallery flex flex-col gap-7" data-accueil-gallery="1">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] font-bold leading-none tracking-tight text-white">
          Accueil
        </h1>
        <button
          type="button"
          onClick={onOpenTraining}
          className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/45"
          aria-label="Ouvrir Train"
        >
          <NotebookPen className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <section aria-label="À la une" className="-mx-5">
        <div
          className="accueil-gallery__carousel flex gap-3 overflow-x-auto px-5 pb-1"
          data-accueil-carousel
          style={{
            scrollSnapType: prefersReducedMotion ? 'none' : 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {heroCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => handleHero(card)}
              data-accueil-hero={card.id}
              className="accueil-gallery__hero ios-press relative shrink-0 overflow-hidden rounded-[24px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/50"
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
                    <span className="mt-0.5 block truncate text-[13px] text-white/70">
                      {card.secondary}
                    </span>
                  </span>
                </span>
              </span>
            </button>
          ))}
          {/* Peek spacer so last card isn't flush */}
          <span className="w-2 shrink-0" aria-hidden="true" />
        </div>
      </section>

      <section aria-label="Récent" data-accueil-recent>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[20px] font-bold tracking-tight text-white">Récent</h2>
          <button
            type="button"
            onClick={onOpenHistory}
            className="ios-press flex min-h-11 items-center gap-1 rounded-xl px-1.5 text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
            aria-label={`Voir l’historique, ${recent.length} séance${recent.length > 1 ? 's' : ''}`}
          >
            <span className="text-[15px] font-semibold tabular-nums">{recent.length}</span>
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="text-[14px] text-[#8E8E93]">Aucune séance enregistrée</p>
        ) : (
          <div
            className="accueil-gallery__tiles -mx-5 flex gap-3 overflow-x-auto px-5 pb-1"
            style={{
              scrollSnapType: prefersReducedMotion ? 'none' : 'x proximity',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {recent.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={onOpenHistory}
                data-accueil-recent-tile={item.id}
                className="ios-press flex w-[7.75rem] shrink-0 flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
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
            ))}
          </div>
        )}
      </section>

      <section aria-label="Programme" data-accueil-program>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[20px] font-bold tracking-tight text-white">Programme</h2>
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
          <p className="text-[14px] text-[#8E8E93]">Aucune routine dans ton programme</p>
        ) : (
          <div
            className="accueil-gallery__tiles -mx-5 flex gap-3 overflow-x-auto px-5 pb-1"
            style={{
              scrollSnapType: prefersReducedMotion ? 'none' : 'x proximity',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {programTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={onOpenTraining}
                data-accueil-program-tile={tile.id}
                className="ios-press flex w-[7.75rem] shrink-0 flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/40"
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
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
