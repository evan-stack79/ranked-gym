import { Droplets, Layers } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { CountUpNumber } from '../motion'
import { AccueilProgressRing } from './AccueilProgressRing'
import type {
  NextSessionTileModel,
  ProgramTileModel,
  SetsTileModel,
  WaterTileModel,
  WeekSessionBar,
} from '../../utils/accueilWidgetTiles'

type MotionOpts = {
  coldEntering: boolean
  prefersReducedMotion: boolean
}

function TileShell({
  accent,
  label,
  ariaLabel,
  wide,
  children,
  dataAttr,
  onClick,
}: {
  accent: string
  label: string
  ariaLabel: string
  wide?: boolean
  children: ReactNode
  dataAttr: string
  onClick?: () => void
}) {
  const className = `accueil-metric-tile ${wide ? 'accueil-metric-tile--wide' : 'accueil-metric-tile--small'} ${
    onClick
      ? 'ios-press text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/45'
      : ''
  }`
  const style = { '--tile-accent': accent } as CSSProperties
  const body = (
    <>
      <span className="accueil-metric-tile__glow" aria-hidden="true" />
      <p className="accueil-metric-tile__label">{label}</p>
      {children}
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        data-accueil-metric-tile={dataAttr}
        className={className}
        style={style}
      >
        {body}
      </button>
    )
  }
  return (
    <div
      aria-label={ariaLabel}
      role="group"
      data-accueil-metric-tile={dataAttr}
      className={className}
      style={style}
    >
      {body}
    </div>
  )
}

export function SeancesSemaineTile({
  bars,
  sessionCount,
  motion,
}: {
  bars: WeekSessionBar[]
  sessionCount: number
  motion: MotionOpts
}) {
  const instant = motion.coldEntering || motion.prefersReducedMotion
  return (
    <TileShell
      accent="#34C759"
      label="Séances de la semaine"
      ariaLabel={`Séances de la semaine, ${sessionCount}`}
      wide
      dataAttr="seances_semaine"
    >
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="accueil-metric-tile__value">
          <CountUpNumber kind="sessions" value={sessionCount} instant={instant} />
        </span>
        <span className="accueil-metric-tile__unit">séance{sessionCount > 1 ? 's' : ''}</span>
      </div>
      <div
        className="accueil-metric-tile__bars mt-4"
        data-accueil-week-bars
        role="img"
        aria-label="Séances par jour de la semaine"
      >
        {bars.map((bar) => (
          <div key={bar.dateKey} className="accueil-metric-tile__bar-col">
            <div className="accueil-metric-tile__bar-track">
              <div
                className={`accueil-metric-tile__bar ${bar.isToday ? 'accueil-metric-tile__bar--today' : ''} ${
                  bar.count > 0 ? 'accueil-metric-tile__bar--filled' : ''
                }`}
                style={{
                  height: bar.count > 0 ? `${Math.max(18, bar.heightRatio * 100)}%` : '6%',
                }}
                data-accueil-week-bar={bar.dateKey}
                data-count={bar.count}
              />
            </div>
            <span
              className={`accueil-metric-tile__bar-label ${bar.isToday ? 'text-white' : ''}`}
            >
              {bar.shortLabel}
            </span>
          </div>
        ))}
      </div>
    </TileShell>
  )
}

export function EauTile({
  model,
  motion,
  onSetGoal,
}: {
  model: WaterTileModel
  motion: MotionOpts
  onSetGoal: () => void
}) {
  const instant = motion.coldEntering || motion.prefersReducedMotion
  return (
    <TileShell
      accent="#0A84FF"
      label="Eau"
      ariaLabel={
        model.showRing
          ? `Eau, ${model.waterMl} millilitres sur ${model.goalMl}`
          : `Eau, ${model.waterMl} millilitres`
      }
      dataAttr="eau"
      onClick={onSetGoal}
    >
      <div className="mt-1 flex flex-1 items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="accueil-metric-tile__value">
              <CountUpNumber kind="water" value={model.waterMl} instant={instant} />
            </span>
            <span className="accueil-metric-tile__unit">ml</span>
          </div>
          <p className="mt-1 text-[11px] text-[#8E8E93]">
            {model.showRing ? `Objectif ${model.goalMl} ml` : 'Définir un objectif'}
          </p>
        </div>
        {model.showRing ? (
          <AccueilProgressRing
            progress={model.progress}
            accent="#0A84FF"
            instant={instant}
            size={64}
          />
        ) : (
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0A84FF]/12 text-[#0A84FF]"
            aria-hidden="true"
          >
            <Droplets className="h-6 w-6" strokeWidth={1.75} />
          </span>
        )}
      </div>
    </TileShell>
  )
}

export function SeriesJourTile({
  model,
  motion,
}: {
  model: SetsTileModel
  motion: MotionOpts
}) {
  const instant = motion.coldEntering || motion.prefersReducedMotion
  return (
    <TileShell
      accent="#FF9F0A"
      label="Séries du jour"
      ariaLabel={
        model.showRing
          ? `Séries du jour, ${model.doneSets} sur ${model.plannedSets}`
          : `Séries du jour, ${model.doneSets}`
      }
      dataAttr="series_jour"
    >
      <div className="mt-1 flex flex-1 items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="accueil-metric-tile__value">
              <CountUpNumber kind="successful_sets" value={model.doneSets} instant={instant} />
            </span>
            <span className="accueil-metric-tile__unit">
              {model.showRing ? `/ ${model.plannedSets}` : 'séries'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#8E8E93]">
            {model.showRing ? 'Aujourd’hui' : 'Sans séance planifiée'}
          </p>
        </div>
        {model.showRing ? (
          <AccueilProgressRing
            progress={model.progress}
            accent="#FF9F0A"
            instant={instant}
            size={64}
          />
        ) : (
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF9F0A]/12 text-[#FF9F0A]"
            aria-hidden="true"
          >
            <Layers className="h-6 w-6" strokeWidth={1.75} />
          </span>
        )}
      </div>
    </TileShell>
  )
}

export function ProchaineSeanceTile({
  model,
  onStart,
  onOpenTrain,
}: {
  model: NextSessionTileModel
  onStart: (routineId: string) => void
  onOpenTrain: () => void
}) {
  return (
    <TileShell
      accent="#BF5AF2"
      label="Prochaine séance"
      ariaLabel={`Prochaine séance, ${model.title}`}
      wide
      dataAttr="prochaine_seance"
    >
      <p className="mt-2 truncate text-[22px] font-bold leading-tight tracking-tight text-white">
        {model.title}
      </p>
      <p className="mt-1 text-[13px] text-[#AEAEB2]">{model.subtitle}</p>
      <div className="mt-4">
        {model.canStart && model.routineId ? (
          <button
            type="button"
            onClick={() => onStart(model.routineId!)}
            className="accueil-metric-tile__cta ios-press"
            data-accueil-next-start
          >
            Démarrer
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenTrain}
            className="accueil-metric-tile__cta accueil-metric-tile__cta--ghost ios-press"
            data-accueil-next-open
          >
            Ouvrir Train
          </button>
        )}
      </div>
    </TileShell>
  )
}

export function ProgrammeProgressTile({
  model,
  onOpenTrain,
  motion,
}: {
  model: ProgramTileModel
  onOpenTrain: () => void
  motion: MotionOpts
}) {
  void motion
  return (
    <TileShell
      accent="#FF2B2B"
      label="Programme"
      ariaLabel={`Programme, ${model.percent} pour cent`}
      wide
      dataAttr="programme"
      onClick={onOpenTrain}
    >
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="accueil-metric-tile__value" data-accueil-program-percent>
          {model.percent}
        </span>
        <span className="accueil-metric-tile__unit">%</span>
      </div>
      <p className="mt-1 text-[12px] text-[#AEAEB2]">{model.label}</p>
      <div
        className="accueil-metric-tile__progress mt-4"
        role="progressbar"
        aria-valuenow={model.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        data-accueil-program-bar
      >
        <div
          className="accueil-metric-tile__progress-fill"
          style={{ width: `${model.percent}%` }}
        />
      </div>
    </TileShell>
  )
}
