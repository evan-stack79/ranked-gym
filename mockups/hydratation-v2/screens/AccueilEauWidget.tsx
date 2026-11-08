import { ChevronRight, NotebookPen, SlidersHorizontal } from 'lucide-react'
import {
  SeancesSemaineTile,
  SeriesJourTile,
  ProchaineSeanceTile,
  ProgrammeProgressTile,
} from '../../../src/components/home/AccueilMetricTiles'
import { BlurInText, SoftBlurIn } from '../../../src/components/motion'
import { EauGlassesTile } from '../components/EauGlassesTile'

const MOTION = {
  coldEntering: false,
  prefersReducedMotion: true,
  freezeCountUp: true,
} as const

const WEEK_BARS = [
  { dateKey: '2026-10-05', shortLabel: 'L', count: 1, isToday: false, heightRatio: 1 },
  { dateKey: '2026-10-06', shortLabel: 'M', count: 0, isToday: false, heightRatio: 0 },
  { dateKey: '2026-10-07', shortLabel: 'M', count: 1, isToday: true, heightRatio: 1 },
  { dateKey: '2026-10-08', shortLabel: 'J', count: 0, isToday: false, heightRatio: 0 },
  { dateKey: '2026-10-09', shortLabel: 'V', count: 1, isToday: false, heightRatio: 1 },
  { dateKey: '2026-10-10', shortLabel: 'S', count: 0, isToday: false, heightRatio: 0 },
  { dateKey: '2026-10-11', shortLabel: 'D', count: 0, isToday: false, heightRatio: 0 },
]

const RECENT = [
  { id: 'r1', title: 'Squat', meta: 'Hier · 1 exo · 2 séries' },
  { id: 'r2', title: 'Développé couché', meta: 'Il y a 2 j · 1 exo' },
  { id: 'r3', title: 'Tractions', meta: 'Il y a 3 j · 1 exo' },
]

/**
 * Accueil fidèle (tokens + tuiles réelles + BottomNav via AppLayout) :
 * SANS barre Eau en haut — widget Eau CARRÉ dans la grille.
 */
export function AccueilEauWidget() {
  return (
    <div className="flex flex-col gap-5" data-mockup-screen="accueil-eau" data-accueil-gallery="1">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[34px] font-bold leading-none tracking-tight text-white">
            <BlurInText as="span" instant label="Accueil">
              Accueil
            </BlurInText>
          </h1>
          <p className="mt-2 text-[15px] font-medium text-[#ACB4BA]">
            <SoftBlurIn instant>Séance du soir · Alex</SoftBlurIn>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#ACB4BA]"
            aria-hidden
          >
            <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
          </span>
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white"
            aria-hidden
          >
            <NotebookPen className="h-5 w-5" strokeWidth={2} />
          </span>
        </div>
      </header>

      {/*
        Grille widgets en premier plan maquette : pas de barre Eau en haut.
        Hero compact pour laisser la tuile Eau visible dans le 1er viewport.
      */}
      <section aria-label="Séance du jour">
        <div className="relative h-[9.5rem] overflow-hidden rounded-[24px] text-left">
          <div
            className="accueil-gallery__hero-bg accueil-gallery__hero-bg--brand absolute inset-0"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/35 ring-1 ring-white/15">
                <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden>
                  <rect x="4" y="14" width="8" height="12" rx="2" stroke="#fff" strokeWidth="1.8" />
                  <rect x="28" y="14" width="8" height="12" rx="2" stroke="#fff" strokeWidth="1.8" />
                  <rect x="12" y="18" width="16" height="4" rx="1" fill="#fff" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold leading-tight text-white">
                  Séance du jour
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-white/70">
                  Séance musculation · 2 séries faites
                </span>
              </span>
            </span>
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[12px] font-semibold text-white ring-1 ring-white/15">
            33 %
          </span>
        </div>
      </section>

      <div className="accueil-widgets flex flex-col gap-3" data-mockup-widgets>
        <div className="accueil-widgets__row" data-accueil-widget-row>
          <div className="accueil-widgets__cell min-w-0">
            <EauGlassesTile />
          </div>
          <div className="accueil-widgets__cell min-w-0">
            <SeriesJourTile
              model={{
                doneSets: 2,
                plannedSets: 12,
                showRing: true,
                progress: 2 / 12,
              }}
              motion={MOTION}
            />
          </div>
        </div>
        <div className="accueil-widgets__wide">
          <SeancesSemaineTile bars={WEEK_BARS} sessionCount={3} motion={MOTION} />
        </div>
        <div className="accueil-widgets__wide">
          <ProchaineSeanceTile
            model={{
              title: 'Push',
              subtitle: "Aujourd'hui · 18:00",
              canStart: true,
              inProgress: false,
              routineId: 'push',
              dateKey: '2026-10-07',
            }}
            onStart={() => undefined}
            onOpenTrain={() => undefined}
            interactive={false}
          />
        </div>
        <div className="accueil-widgets__wide">
          <ProgrammeProgressTile
            model={{
              percent: 33,
              label: '3 séances cette semaine',
              doneSessions: 3,
              plannedSessions: 5,
            }}
            onOpenTrain={() => undefined}
            motion={MOTION}
            interactive={false}
          />
        </div>
      </div>

      <section aria-label="Récent" data-accueil-recent>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[20px] font-bold tracking-tight text-white">Récent</h2>
          <span className="flex min-h-11 items-center gap-1 text-[#ACB4BA]">
            <span className="text-[15px] font-semibold tabular-nums">3</span>
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
        </div>
        <div className="accueil-gallery__tiles -mx-5 flex gap-3 overflow-x-hidden px-5 pb-1">
          {RECENT.map((item) => (
            <div key={item.id} className="accueil-gallery__tile flex w-[7.75rem] shrink-0 flex-col gap-2 text-left">
              <span className="accueil-gallery__tile-media relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[18px] bg-[#1D1F20] ring-1 ring-white/8">
                <span className="text-[#8E8E93]" aria-hidden>
                  {/* Silhouette haltère plate — pas d’emoji gadget */}
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect x="4" y="14" width="8" height="12" rx="2" stroke="#8E8E93" strokeWidth="1.6" />
                    <rect x="28" y="14" width="8" height="12" rx="2" stroke="#8E8E93" strokeWidth="1.6" />
                    <rect x="12" y="18" width="16" height="4" rx="1" fill="#8E8E93" />
                  </svg>
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-white">{item.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[#ACB4BA]">{item.meta}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
