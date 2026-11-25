import { Settings2 } from 'lucide-react'
import type {
  RecentSessionItem,
  TodayHubCard,
  WeekDayCell,
  WeeklySummary,
} from '../../utils/trainHub'
import heroToday from '../../assets/photos/train/photo-hero-a.jpg'
import thumbCreneau from '../../assets/photos/train/photo-creneau-thumb.jpg'
import thumbBench from '../../assets/photos/train/photo-bench-thumb.jpg'
import './trainV2.css'

export type TrainV2HubProps = {
  today: TodayHubCard
  weekStrip: WeekDayCell[]
  weeklySummary: WeeklySummary
  lastSession: RecentSessionItem | null
  onSettings: () => void
  onStart: () => void
  onOpenCreneau: () => void
  onOpenLastSession: (id: string) => void
}

/** Libellés CTA v2 — majuscules condensées, sans culpabiliser. */
export function trainV2CtaLabel(cta: TodayHubCard['cta']): string {
  switch (cta) {
    case 'resume':
      return 'Reprendre'
    case 'start':
      return 'Démarrer'
    case 'open_train':
      return 'Ouvrir'
    case 'choose_activity':
      return 'Choisir'
  }
}

/** Titre géant héros — Repos si rien de prévu. */
export function trainV2HeroTitle(card: TodayHubCard): string {
  if (card.cta === 'choose_activity') return 'Repos'
  return card.title.trim() || 'Séance'
}

/** Ligne meta sous le titre. */
export function trainV2HeroMeta(card: TodayHubCard): string {
  if (card.cta === 'choose_activity') return 'Pas de séance prévue'
  if (card.summaryLine) return `${card.sportLabel} · ${card.summaryLine}`
  return card.sportLabel
}

/**
 * Accueil Train v2 — héros bord à bord, tuiles 7j, stats, créneau, dernière séance.
 */
export function TrainV2Hub({
  today,
  weekStrip,
  weeklySummary,
  lastSession,
  onSettings,
  onStart,
  onOpenCreneau,
  onOpenLastSession,
}: TrainV2HubProps) {
  const sessionsMetric = weeklySummary.metrics.find((m) => m.id === 'sessions')
  const timeMetric = weeklySummary.metrics.find(
    (m) => m.id === 'active_min' || m.id === 'duration',
  )
  const sessionCount = sessionsMetric?.value ?? weeklySummary.sessionCount
  const activeMin =
    timeMetric?.value != null && Number.isFinite(timeMetric.value)
      ? Math.round(timeMetric.value)
      : 0

  const title = trainV2HeroTitle(today)
  const meta = trainV2HeroMeta(today)
  const cta = trainV2CtaLabel(today.cta)

  return (
    <div className="train-v2" data-training-hub data-train-v2="1">
      <section className="train-v2-hero" aria-label="Aujourd’hui" data-train-v2-hero>
        <img className="train-v2-hero__img" src={heroToday} alt="" draggable={false} />
        <div className="train-v2-hero__fade" aria-hidden />
        <div className="train-v2-hero__brand">
          <h1>Train</h1>
          <button
            type="button"
            onClick={onSettings}
            className="ios-press flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/20 bg-black/30 text-[#ECEEEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/35"
            aria-label="Réglages"
            data-train-v2-settings
          >
            <Settings2 className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="train-v2-hero__txt">
          <p className="train-v2-hero__kicker">Aujourd’hui</p>
          <h2 className="train-v2-hero__title" data-train-v2-title>
            {title}
          </h2>
          <p className="train-v2-hero__meta" data-train-v2-meta>
            {meta}
          </p>
          <button
            type="button"
            onClick={onStart}
            className="train-v2-hero__btn ios-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            data-train-v2-start
          >
            {cta}
          </button>
        </div>
      </section>

      <div className="train-v2-stack">
        <ol className="train-v2-week" aria-label="Cette semaine" data-train-v2-week>
          {weekStrip.map((day) => (
            <li key={day.dateKey}>
              <div
                className={`train-v2-day${day.isToday ? ' train-v2-day--today' : ''}${
                  day.hasSession ? ' train-v2-day--done' : ''
                }`}
                aria-label={day.accessibleLabel}
                aria-current={day.isToday ? 'date' : undefined}
              >
                <span className="train-v2-day__w">{day.shortLabel}</span>
                <span className="train-v2-day__n">{day.dayNumber}</span>
                <span className="train-v2-day__dot" aria-hidden />
              </div>
            </li>
          ))}
        </ol>

        <div
          className="train-v2-stats"
          aria-label="Résumé de la semaine"
          data-week-summary
          data-train-v2-stats
        >
          <div className="train-v2-stat" data-train-v2-stat="sessions">
            <p className="train-v2-stat__val">{sessionCount}</p>
            <p className="train-v2-stat__lab">Séances</p>
          </div>
          <div className="train-v2-stat" data-train-v2-stat="active_min">
            <p className="train-v2-stat__val">
              {activeMin}
              <small>min</small>
            </p>
            <p className="train-v2-stat__lab">Temps actif</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCreneau}
          className="train-v2-creneau ios-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/35"
          data-creneau-entry
          data-train-v2-creneau
          aria-label="Mon créneau"
        >
          <img src={thumbCreneau} alt="" draggable={false} />
          <div className="train-v2-creneau__txt">
            <span>
              <h2>Mon créneau</h2>
              <p>Salle ou marche — ton créneau du jour</p>
            </span>
            <span className="train-v2-creneau__go">Ouvrir</span>
          </div>
        </button>

        {lastSession ? (
          <section data-train-v2-last aria-label="Dernière séance">
            <p className="train-v2-last-label">Dernière séance</p>
            <button
              type="button"
              onClick={() => onOpenLastSession(lastSession.id)}
              className="train-v2-last ios-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/35"
              data-last-session={lastSession.id}
            >
              <div className="train-v2-last__thumb">
                <img src={thumbBench} alt="" draggable={false} />
              </div>
              <div className="train-v2-last__info">
                <div className="train-v2-last__top">
                  <h3>{lastSession.title}</h3>
                  <span className="train-v2-last__when">{lastSession.dateLabel}</span>
                </div>
                <p className="train-v2-last__sport">{lastSession.sportLabel}</p>
                <p className="train-v2-last__line">{lastSession.summary}</p>
              </div>
            </button>
          </section>
        ) : (
          <p className="text-[14px] text-[#ACB4BA]" data-train-v2-last-empty>
            Aucune séance enregistrée
          </p>
        )}
      </div>
    </div>
  )
}
