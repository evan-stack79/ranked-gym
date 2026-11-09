import { Layers } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { CountUpNumber } from '../motion'
import { AccueilProgressRing } from './AccueilProgressRing'
import { FlatGlassIcon } from '../hydration/FlatGlassIcon'
import { GLASS_ML } from '../../shared/hydration'
import {
  formatWaterGoalHint,
  type NextSessionTileModel,
  type ProgramTileModel,
  type SetsTileModel,
  type WaterTileModel,
  type WeekSessionBar,
} from '../../utils/accueilWidgetTiles'

type MotionOpts = {
  coldEntering: boolean
  prefersReducedMotion: boolean
  /** Skip CountUp restart (edit mode / freezeReveals) — no 0→value flash. */
  freezeCountUp?: boolean
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
      ? 'ios-press text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/45'
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
  const instant =
    motion.coldEntering || motion.prefersReducedMotion || Boolean(motion.freezeCountUp)
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
          <CountUpNumber
            kind="sessions"
            value={sessionCount}
            instant={instant}
            stableId="accueil-seances-semaine"
          />
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

function formatLitersCompact(ml: number): string {
  const liters = Math.max(0, ml) / 1000
  if (Number.isInteger(liters)) return String(liters)
  return liters.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
}

/**
 * Tuile carrée Eau — grille de petits verres (maquette v2 validée).
 * Objectif = userWaterGoal / hydration goal ; jamais de formule poids.
 */
export function EauTile({
  model,
  motion,
  onSetGoal,
  interactive = true,
}: {
  model: WaterTileModel
  motion: MotionOpts
  onSetGoal: () => void
  /** False in Accueil edit mode — no water-goal sheet. */
  interactive?: boolean
}) {
  const instant =
    motion.coldEntering || motion.prefersReducedMotion || Boolean(motion.freezeCountUp)
  const ready = model.ready !== false
  const showValue = ready
  const goalMl = model.goalMl != null && model.goalMl > 0 ? model.goalMl : null
  const glassCount = goalMl != null
    ? Math.min(12, Math.max(1, Math.round(goalMl / GLASS_ML)))
    : 8
  const filledCount = showValue
    ? Math.min(glassCount, Math.floor(Math.max(0, model.waterMl) / GLASS_ML))
    : 0
  const drunkLiters = formatLitersCompact(model.waterMl)
  const goalLiters = goalMl != null ? formatLitersCompact(goalMl) : null

  return (
    <TileShell
      accent="#0A84FF"
      label="Eau"
      ariaLabel={
        !showValue
          ? 'Eau, chargement'
          : goalMl != null
            ? `Eau, ${drunkLiters} litre sur ${goalLiters} litres`
            : `Eau, ${drunkLiters} litre`
      }
      dataAttr="eau"
      onClick={interactive ? onSetGoal : undefined}
    >
      {showValue ? (
        <div
          className="mt-3 grid grid-cols-4 gap-x-1.5 gap-y-2"
          aria-hidden="true"
          data-accueil-eau-glasses="1"
        >
          {Array.from({ length: glassCount }, (_, i) => (
            <span key={i} className="flex items-center justify-center">
              <FlatGlassIcon filled={i < filledCount} size={20} />
            </span>
          ))}
        </div>
      ) : (
        <span
          className="accueil-metric-tile__value mt-3"
          data-accueil-eau-placeholder="1"
          aria-hidden="true"
        >
          —
        </span>
      )}
      <div className="accueil-metric-tile__stack mt-auto pt-3">
        <div className="accueil-metric-tile__value-row">
          {showValue ? (
            <>
              <span className="accueil-metric-tile__value text-[1.35rem]">
                <CountUpNumber
                  kind="water"
                  value={model.waterMl / 1000}
                  instant={instant}
                  stableId="accueil-eau"
                  format={(n) => formatLitersCompact(Math.round(n * 1000))}
                />
              </span>
              <span className="accueil-metric-tile__unit">
                {goalLiters != null ? `L / ${goalLiters} L` : 'L'}
              </span>
            </>
          ) : null}
        </div>
        {!showValue ? null : goalMl != null ? (
          <p className="sr-only">{formatWaterGoalHint(goalMl)}</p>
        ) : (
          <p className="accueil-metric-tile__hint">Choisir mon objectif</p>
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
  const instant =
    motion.coldEntering || motion.prefersReducedMotion || Boolean(motion.freezeCountUp)
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
              <CountUpNumber
                kind="successful_sets"
                value={model.doneSets}
                instant={instant}
                stableId="accueil-series-jour"
              />
            </span>
            <span className="accueil-metric-tile__unit">
              {model.showRing ? `/ ${model.plannedSets}` : 'séries'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#ACB4BA]">
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
  interactive = true,
}: {
  model: NextSessionTileModel
  onStart: (routineId: string) => void
  onOpenTrain: () => void
  interactive?: boolean
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
      <p className="mt-1 text-[13px] text-[#ACB4BA]">{model.subtitle}</p>
      <div className="mt-4">
        {model.canStart && model.routineId ? (
          <button
            type="button"
            disabled={!interactive}
            onClick={() => {
              if (!interactive) return
              onStart(model.routineId!)
            }}
            className="accueil-metric-tile__cta ios-press disabled:opacity-60"
            data-accueil-next-start
            data-accueil-next-cta={model.inProgress ? 'reprendre' : 'demarrer'}
          >
            {model.inProgress ? 'Reprendre' : 'Démarrer'}
          </button>
        ) : (
          <button
            type="button"
            disabled={!interactive}
            onClick={() => {
              if (!interactive) return
              onOpenTrain()
            }}
            className="accueil-metric-tile__cta accueil-metric-tile__cta--ghost ios-press disabled:opacity-60"
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
  interactive = true,
}: {
  model: ProgramTileModel
  onOpenTrain: () => void
  motion: MotionOpts
  interactive?: boolean
}) {
  void motion
  return (
    <TileShell
      accent="#FF0702"
      label="Programme"
      ariaLabel={`Programme, ${model.percent} pour cent`}
      wide
      dataAttr="programme"
      onClick={interactive ? onOpenTrain : undefined}
    >
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="accueil-metric-tile__value" data-accueil-program-percent>
          {model.percent}
        </span>
        <span className="accueil-metric-tile__unit">%</span>
      </div>
      <p className="mt-1 text-[12px] text-[#ACB4BA]">{model.label}</p>
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
