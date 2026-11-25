import {
  besoin,
  etat,
  fmtClock,
  fmtDur,
  nightsFromSleepEntries,
  type SleepEngineNight,
  type SleepEtatQ,
} from '../../../sleep-week-engine'
import type { SleepNightEntry } from '../../../services/sleepStorage'

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const
const DAY_KEYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const
const DAY_NAMES = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const

function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function formatDateKey(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function shift(dateKey: string, days: number): string | null {
  const dt = parseDateKey(dateKey)
  if (!dt) return null
  dt.setDate(dt.getDate() + days)
  return formatDateKey(dt)
}

/** Lundi local de la date civile `now` (0=lun … 6=dim). */
export function mondayOfLocalDate(now: Date): string {
  const key = formatDateKey(now)
  const idx = (now.getDay() + 6) % 7
  return shift(key, -idx)!
}

/** @deprecated kept for call-site greps — prefer mondayOfLocalDate. */
export function mondayOfLatestNight(_entries: SleepNightEntry[]): string | null {
  return mondayOfLocalDate(new Date())
}

function hm(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}

function nightDurationMin(bed: string, wake: string): number {
  return mod(hm(wake) - hm(bed), 1440)
}

export type SleepWeekDaySlot = {
  index: number
  letter: string
  dateNum: number
  nightDateKey: string
  night: SleepEngineNight | null
  durationMin: number | null
  /** Calendar night after today — no bar / no stub / no fake figure. */
  future: boolean
  label: string
  hoursLabel: string
}

export type SleepWeekModel = {
  weekStart: string
  weekLabel: string
  /** 0 = cette semaine (lundi d’aujourd’hui), -1 = semaine dernière. */
  weekOffset: 0 | -1
  todayKey: string
  days: SleepWeekDaySlot[]
  nights: SleepEngineNight[]
  validCount: number
  provisional: boolean
  avgMin: number | null
  avgLabel: string
  coucherLabel: string
  ressentiHalf: number
  repereHours: number
  Bb: number
  Bh: number
  etatId: number
}

export type BuildSleepWeekModelOpts = {
  now?: Date
  /** 0 = current week from today’s Monday; -1 = previous week. */
  weekOffset?: 0 | -1
}

export function buildSleepWeekModel(
  entries: SleepNightEntry[],
  age: number,
  q: SleepEtatQ = {},
  opts: BuildSleepWeekModelOpts = {},
): SleepWeekModel {
  const now = opts.now ?? new Date()
  const weekOffset: 0 | -1 = opts.weekOffset === -1 ? -1 : 0
  const todayKey = formatDateKey(now)
  let weekStart = mondayOfLocalDate(now)
  if (weekOffset === -1) {
    weekStart = shift(weekStart, -7)!
  }

  const nights = nightsFromSleepEntries(entries, weekStart)
  const ageSafe = age > 0 ? age : 24
  const [Bb, Bh] = besoin(ageSafe)
  const result = etat(nights, ageSafe, q)
  const s = result.s

  const days: SleepWeekDaySlot[] = DAY_KEYS.map((key, i) => {
    const nightDateKey = shift(weekStart, i)!
    const dt = parseDateKey(nightDateKey)!
    const future = nightDateKey > todayKey
    const night = future ? null : (nights.find((n) => n.day === key) ?? null)
    const durationMin =
      !future && night ? nightDurationMin(night.bed, night.wake) : null
    return {
      index: i,
      letter: DAY_LETTERS[i]!,
      dateNum: dt.getDate(),
      nightDateKey,
      night,
      durationMin,
      future,
      label: DAY_NAMES[i]!,
      hoursLabel:
        night && durationMin != null
          ? `${fmtClock(hm(night.bed))} → ${fmtClock(hm(night.wake))}`
          : '',
    }
  })

  const startDt = parseDateKey(weekStart)!
  const endDt = parseDateKey(shift(weekStart, 6)!)!
  const months = [
    'jan.',
    'fév.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ]
  const weekLabel = `${startDt.getDate()} – ${endDt.getDate()} ${months[endDt.getMonth()]}`

  return {
    weekStart,
    weekLabel,
    weekOffset,
    todayKey,
    days,
    nights,
    validCount: s.n,
    provisional: s.n < 5,
    avgMin: s.n > 0 ? s.D : null,
    avgLabel: s.n > 0 ? fmtDur(s.D) : '—',
    coucherLabel: s.n > 0 ? fmtClock(s.Cmed) : '—',
    ressentiHalf: s.n > 0 ? s.Rhalf : 0,
    repereHours: Math.round(Bb / 60),
    Bb,
    Bh,
    etatId: result.id,
  }
}

export function fmtDurParts(min: number): { h: string; m: string } {
  const rounded = Math.round(min / 5) * 5
  return {
    h: String(Math.floor(rounded / 60)),
    m: String(rounded % 60).padStart(2, '0'),
  }
}
