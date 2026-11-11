import { useEffect, useMemo, useState } from 'react'
import { computeTibHours } from '../../sleep-engine'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  getRecentSleepNights,
  getSleepGoalHours,
  getSleepNightByDateKey,
  getSleepSchedule,
  saveSleepFeeling,
  saveSleepGoalHours,
  saveSleepNight,
  SLEEP_CHANGED_EVENT,
  type SleepFeelingLevel,
} from '../../services/sleepStorage'
import {
  durationPartsFromHours,
  formatClockHm,
  todayDateKey,
} from '../../utils/sleepTimeFormat'
import { SleepClockDial } from './SleepClockDial'
import { SleepMoonIcon, SleepSunIcon } from './SleepMoonSunIcons'
import { SleepWeekChart } from './SleepWeekChart'
import {
  SLEEP_FEELING_LABELS,
  SLEEP_PANTHER_SLEEPING_SRC,
  SLEEP_PANTHER_SRC,
} from './sleepFeeling'

const RED = '#ff0702'
const CARD_BG = '#1C1C1E'

interface SleepNightSummaryCardProps {
  /** Affiche le bouton Noter/Modifier (Accueil + Sommeil). */
  showAction?: boolean
  /** Compact Accueil vs écran Sommeil. */
  variant?: 'accueil' | 'sommeil'
  onOpenSleepScreen?: () => void
}

function DurationHero({
  hours,
  empty,
}: {
  hours: number | null
  empty?: boolean
}) {
  if (empty || hours == null) {
    return (
      <p className="flex items-baseline gap-1.5 tabular-nums text-[#636366]" data-sleep-duration-empty>
        <span className="text-[40px] font-bold leading-none">-</span>
        <span className="text-[17px] font-medium">h</span>
        <span className="text-[40px] font-bold leading-none">--</span>
        <span className="text-[17px] font-medium">min</span>
      </p>
    )
  }
  const parts = durationPartsFromHours(hours)
  return (
    <p className="flex items-baseline gap-1.5 text-white tabular-nums" data-sleep-duration>
      <span className="text-[40px] font-bold leading-none tracking-tight">{parts.hours}</span>
      <span className="text-[17px] font-medium text-[#C7C7CC]">h</span>
      <span className="text-[40px] font-bold leading-none tracking-tight">
        {String(parts.minutes).padStart(2, '0')}
      </span>
      <span className="text-[17px] font-medium text-[#C7C7CC]">min</span>
    </p>
  )
}

/**
 * Bloc résumé unique — Accueil + haut Sommeil.
 * Notation inline (cadran dans la carte), pas de feuille séparée.
 */
export function SleepNightSummaryCard({
  showAction = true,
  variant = 'accueil',
  onOpenSleepScreen,
}: SleepNightSummaryCardProps) {
  const reduced = usePrefersReducedMotion()
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState(false)
  const [feelingOpen, setFeelingOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [bedtime, setBedtime] = useState('23:00')
  const [waketime, setWaketime] = useState('07:00')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener(SLEEP_CHANGED_EVENT, sync)
    window.addEventListener('ranked-gym:backup-restored', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener(SLEEP_CHANGED_EVENT, sync)
      window.removeEventListener('ranked-gym:backup-restored', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const dateKey = todayDateKey()
  const night = useMemo(() => getSleepNightByDateKey(dateKey), [tick, dateKey])
  const nights = useMemo(() => getRecentSleepNights(7), [tick])
  const schedule = useMemo(() => getSleepSchedule(), [tick])
  const goalHours = useMemo(() => getSleepGoalHours(), [tick])
  const logged = night != null
  const tib = night ? computeTibHours(night.bedtime, night.waketime) : null
  const plannedBed = schedule?.bedtime ?? '23:00'
  const plannedWake = schedule?.waketime ?? '07:00'
  const showBed = logged ? night!.bedtime : plannedBed
  const showWake = logged ? night!.waketime : plannedWake
  const fillRatio =
    tib != null && goalHours > 0 ? Math.min(1, Math.max(0, tib / goalHours)) : 0

  useEffect(() => {
    if (!editing) return
    if (night) {
      setBedtime(night.bedtime)
      setWaketime(night.waketime)
    } else {
      setBedtime(plannedBed)
      setWaketime(plannedWake)
    }
    setError(null)
  }, [editing, night, plannedBed, plannedWake])

  const startEdit = () => {
    setFeelingOpen(false)
    setGoalOpen(false)
    setEditing(true)
  }

  const saveNight = () => {
    setError(null)
    const saved = saveSleepNight({
      bedtime,
      waketime,
      tstHours: night?.tstHours ?? null,
      feelingLevel: night?.feelingLevel ?? null,
      dateKey,
      source: 'manual',
    })
    if (!saved) {
      setError('Impossible d’enregistrer — vérifie tes horaires.')
      return
    }
    setEditing(false)
  }

  const pickFeeling = (level: SleepFeelingLevel) => {
    if (!night) return
    saveSleepFeeling(dateKey, level)
    setFeelingOpen(false)
  }

  return (
    <section
      className="rounded-[22px] p-4"
      style={{ backgroundColor: CARD_BG }}
      data-sleep-summary-card
      data-sleep-summary-variant={variant}
      data-sleep-summary-logged={logged ? '1' : '0'}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            if (variant === 'accueil' && onOpenSleepScreen && !editing) onOpenSleepScreen()
          }}
          aria-label="Comment s'est passée ta nuit"
        >
          <p className="text-[15px] font-semibold text-white">Comment s&apos;est passée ta nuit ?</p>
        </button>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: logged ? RED : '#2C2C2E' }}
          aria-hidden
        >
          <SleepMoonIcon size={16} color="#FFFFFF" />
        </div>
      </div>

      <div className="mt-3">
        <DurationHero hours={tib} empty={!logged} />
      </div>

      {/* Timeline coucher → lever */}
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2C2C2E]">
          <div
            className="h-full rounded-full"
            style={{
              width: logged ? `${Math.max(8, fillRatio * 100)}%` : '0%',
              backgroundColor: logged ? RED : 'transparent',
              transition: reduced ? undefined : 'width 400ms ease',
            }}
            data-sleep-timeline-fill
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[13px] tabular-nums text-[#ACB4BA]">
          <span className="inline-flex items-center gap-1.5">
            <SleepMoonIcon size={13} />
            {formatClockHm(showBed)}
          </span>
          <span className="text-[11px] text-[#636366]">{logged ? '' : 'Prévu'}</span>
          <span className="inline-flex items-center gap-1.5">
            <SleepSunIcon size={13} />
            {formatClockHm(showWake)}
          </span>
        </div>
      </div>

      {/* Panthère / ressenti — une seule fois, pas sur chaque mini-carte */}
      <div className="mt-4 flex items-center gap-3" data-sleep-panther-row>
        {!logged ? (
          <div className="relative flex items-center gap-2" data-sleep-panther-sleeping>
            <img
              src={SLEEP_PANTHER_SLEEPING_SRC}
              alt=""
              className="h-10 w-10 object-contain opacity-40"
            />
            <span className="text-[12px] tracking-widest text-[#8E8E93]" aria-hidden>
              z z
            </span>
          </div>
        ) : night?.feelingLevel ? (
          <div
            className="flex items-center gap-2"
            data-sleep-panther-awake={night.feelingLevel}
            style={
              reduced
                ? undefined
                : { animation: 'sleep-panther-wake 320ms ease-out' }
            }
          >
            <img
              src={SLEEP_PANTHER_SRC[night.feelingLevel]}
              alt=""
              className="h-10 w-10 object-contain"
            />
            <span className="text-[14px] font-semibold text-white">
              {SLEEP_FEELING_LABELS[night.feelingLevel]}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFeelingOpen((v) => !v)}
            className="ios-press inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-[#E5E5EA]"
            data-sleep-add-feeling
          >
            <span style={{ color: RED }}>+</span> Ajouter mon ressenti
          </button>
        )}
      </div>

      {feelingOpen && logged ? (
        <div className="mt-3 flex justify-between gap-1" data-sleep-feeling-picker>
          {([1, 2, 3, 4, 5] as SleepFeelingLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => pickFeeling(level)}
              className="ios-press flex flex-1 flex-col items-center gap-1 rounded-xl bg-black/25 py-2"
              aria-label={SLEEP_FEELING_LABELS[level]}
            >
              <img src={SLEEP_PANTHER_SRC[level]} alt="" className="h-12 w-12 object-contain" />
              <span className="text-[10px] text-[#ACB4BA]">{SLEEP_FEELING_LABELS[level]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* 7 barres + moyenne une fois */}
      <div className="mt-4">
        <SleepWeekChart nights={nights} compact showAverage />
      </div>

      {/* Objectif perso */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setGoalOpen((v) => !v)}
          className="ios-press text-[13px] text-[#ACB4BA]"
          data-sleep-goal
        >
          ton objectif :{' '}
          <span className="font-semibold text-white">{goalHours} h</span>
        </button>
      </div>
      {goalOpen ? (
        <div className="mt-2 flex items-center gap-2" data-sleep-goal-stepper>
          <button
            type="button"
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full bg-[#2C2C2E] text-white"
            onClick={() => saveSleepGoalHours(goalHours - 0.5)}
            aria-label="Baisser l’objectif"
          >
            −
          </button>
          <span className="min-w-[4rem] text-center text-[15px] font-semibold text-white">
            {goalHours} h
          </span>
          <button
            type="button"
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full bg-[#2C2C2E] text-white"
            onClick={() => saveSleepGoalHours(goalHours + 0.5)}
            aria-label="Augmenter l’objectif"
          >
            +
          </button>
        </div>
      ) : null}

      {/* Notation inline dans la carte */}
      {editing ? (
        <div className="mt-4 space-y-3 border-t border-white/8 pt-4" data-sleep-inline-editor>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#2C2C2E] px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] text-[#ACB4BA]">
                <SleepMoonIcon size={12} />
                Coucher
              </p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-white">
                {formatClockHm(bedtime)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#2C2C2E] px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] text-[#ACB4BA]">
                <SleepSunIcon size={12} />
                Lever
              </p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-white">
                {formatClockHm(waketime)}
              </p>
            </div>
          </div>
          <SleepClockDial
            bedtime={bedtime}
            waketime={waketime}
            onChange={({ bedtime: b, waketime: w }) => {
              setBedtime(b)
              setWaketime(w)
              setError(null)
            }}
          />
          {error ? <p className="text-[13px] text-[#FF907F]">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="ios-press flex-1 rounded-2xl bg-[#2C2C2E] py-3 text-[15px] font-semibold text-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveNight}
              className="ios-press flex-1 rounded-2xl py-3 text-[15px] font-semibold text-white"
              style={{ backgroundColor: RED }}
              data-sleep-inline-save
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : showAction ? (
        <button
          type="button"
          onClick={startEdit}
          className="ios-press mt-4 w-full rounded-2xl py-3.5 text-[16px] font-semibold text-white"
          style={{ backgroundColor: RED }}
          data-sleep-primary-action={logged ? 'modifier' : 'noter'}
        >
          {logged ? 'Modifier' : 'Noter'}
        </button>
      ) : null}
    </section>
  )
}
