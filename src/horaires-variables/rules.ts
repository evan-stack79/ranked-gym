/**
 * SOLUTIONS_15 + verdicts Vérificateur (15/11) — pure calc rules.
 * Prevails over older engine helpers when they diverge.
 */

import {
  addDaysKey,
  clampInt,
  dateKeyOf,
  formatHm,
  hmToMinutes,
  parseDateKey,
  parseHm,
  snapDurationMin,
  type HvDayKind,
  type HvDayPlan,
  type HvIsoWeekday,
  type HvSettings,
  type HvWeekdaySlot,
} from './engine.ts'

/** Coucher margin (temps au lit) — verifier 2a/2b. */
export const HV_BED_MARGIN_ADULT_H = 8
export const HV_BED_MARGIN_TEEN_H = 9

/** Debt reference B_bas — verifier 2c / S32 §2.2. */
export const HV_DEBT_R_ADULT_H = 7
export const HV_DEBT_R_TEEN_H = 8

/** Quick-return / volant — verifier 3: ≤ 11 h adults. */
export const HV_QUICK_RETURN_MAX_H = 11

/** Minor rest alert — verifier 1: < 12 h (16–17), < 14 h (<16). */
export const HV_MINOR_REST_MIN_H = 12
export const HV_MINOR_REST_MIN_UNDER16_H = 14

/** Min lead before start (état 13). */
export const HV_MIN_WAKE_LEAD_MIN = 30

export function bedMarginHours(age: number): number {
  if (Number.isFinite(age) && age >= 13 && age <= 18) return HV_BED_MARGIN_TEEN_H
  return HV_BED_MARGIN_ADULT_H
}

export function debtReferenceHours(age: number): number {
  if (Number.isFinite(age) && age >= 13 && age <= 18) return HV_DEBT_R_TEEN_H
  return HV_DEBT_R_ADULT_H
}

/**
 * Type du jour d'après l'heure de début (verifier point 7 / S32 §0 corrigé).
 * Nuit = 20:00–3:59 ; Tôt = 4:00–7:59 ; Journée = 8:00–13:59 ; Soir = 14:00–19:59.
 * Mineurs : jamais typé « Nuit » (état 4) — 20:00+ reste « Soir ».
 */
export function classifyStartKind(
  startHm: string,
  opts?: { isMinor?: boolean },
): Exclude<HvDayKind, 'repos' | 'unset'> {
  const m = hmToMinutes(startHm)
  if (m == null) return 'tot'
  const h = Math.floor(m / 60)
  if (h >= 20 || h <= 3) {
    if (opts?.isMinor) return 'soir'
    return 'nuit'
  }
  if (h >= 4 && h <= 7) return 'tot'
  if (h >= 8 && h <= 13) return 'journee'
  return 'soir'
}

/** Combine dateKey + HH:MM into a Date (local). */
export function dateTimeFrom(dateKey: string, hm: string): Date | null {
  const d = parseDateKey(dateKey)
  const p = parseHm(hm)
  if (!d || !p) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), p.hour, p.minute, 0, 0)
}

export type WakeInstant = {
  /** Calendar day the alarm fires */
  wakeDateKey: string
  wakeHm: string
  wakeAt: Date
  /** True when wake calendar day ≠ start calendar day */
  crossesMidnight: boolean
}

/**
 * Réveil = début(datetime) − trajet − préparation, en vraie date/heure.
 * Garde-fou : au moins 30 min avant le début.
 */
export function computeWakeInstant(args: {
  startDateKey: string
  startHm: string
  trajetMin: number
  prepMin: number
  wakeOverrideHm?: string | null
}): WakeInstant | null {
  const startAt = dateTimeFrom(args.startDateKey, args.startHm)
  if (!startAt) return null

  let wakeAt: Date
  if (args.wakeOverrideHm) {
    const override = dateTimeFrom(args.startDateKey, args.wakeOverrideHm)
    if (!override) return null
    // Override same calendar day; if after start, treat as previous day
    wakeAt = override.getTime() < startAt.getTime() ? override : new Date(override.getTime() - 86_400_000)
  } else {
    const offsetMin =
      clampInt(args.trajetMin, 0, 24 * 60) + clampInt(args.prepMin, 0, 24 * 60)
    const lead = Math.max(offsetMin, HV_MIN_WAKE_LEAD_MIN)
    wakeAt = new Date(startAt.getTime() - lead * 60_000)
  }

  // Enforce ≥ 30 min before start
  const minWake = new Date(startAt.getTime() - HV_MIN_WAKE_LEAD_MIN * 60_000)
  if (wakeAt.getTime() > minWake.getTime()) wakeAt = minWake

  const wakeDateKey = dateKeyOf(wakeAt)
  return {
    wakeDateKey,
    wakeHm: formatHm(wakeAt.getHours(), wakeAt.getMinutes()),
    wakeAt,
    crossesMidnight: wakeDateKey !== args.startDateKey,
  }
}

/** Night-shift explanation line when wake is another calendar day. */
export function nightShiftExplain(args: {
  startDateKey: string
  startHm: string
  wake: WakeInstant
}): string {
  const startLabel = formatShortFrDate(args.startDateKey)
  const prevKey = addDaysKey(args.startDateKey, -1) ?? args.startDateKey
  const prevLabel = formatShortFrDate(prevKey)
  const wakeLabel = formatShortFrDate(args.wake.wakeDateKey)
  const startHmDisp = args.startHm.replace(/^0/, '')
  const wakeHmDisp = args.wake.wakeHm.replace(/^0/, '')
  return `${startLabel} ${startHmDisp}, c'est dans la nuit de ${prevLabel} à ${startLabel.split(' ').slice(-1)[0] ?? startLabel}. Réveil ${wakeLabel} ${wakeHmDisp}.`
}

export function formatShortFrDate(dateKey: string): string {
  const d = parseDateKey(dateKey)
  if (!d) return dateKey
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatWeekRangeFr(mondayKey: string): string {
  const sun = addDaysKey(mondayKey, 6)
  const a = parseDateKey(mondayKey)
  const b = sun ? parseDateKey(sun) : null
  if (!a || !b) return ''
  const sameMonth = a.getMonth() === b.getMonth()
  if (sameMonth) {
    return `${a.getDate()}–${b.getDate()} ${a.toLocaleDateString('fr-FR', { month: 'short' })}`
  }
  return `${a.getDate()} ${a.toLocaleDateString('fr-FR', { month: 'short' })}–${b.getDate()} ${b.toLocaleDateString('fr-FR', { month: 'short' })}`
}

/**
 * Coucher conseillé = réveil − margin (8 h adulte / 9 h ado).
 * Si fin connue : max(réveil−R, fin + trajetRetour + souffler).
 */
export function suggestedBedFromWake(args: {
  wakeDateKey: string
  wakeHm: string
  age: number
  finishDateKey?: string | null
  finishHm?: string | null
  trajetReturnMin?: number
  decompressionMin?: number
}): { bedDateKey: string; bedHm: string } | null {
  const wakeAt = dateTimeFrom(args.wakeDateKey, args.wakeHm)
  if (!wakeAt) return null
  const marginH = bedMarginHours(args.age)
  let bedAt = new Date(wakeAt.getTime() - marginH * 3_600_000)

  if (args.finishDateKey && args.finishHm) {
    const fin = dateTimeFrom(args.finishDateKey, args.finishHm)
    if (fin) {
      const fromFin = new Date(
        fin.getTime() +
          (args.trajetReturnMin ?? 0) * 60_000 +
          snapDurationMin(args.decompressionMin ?? 60) * 60_000,
      )
      if (fromFin.getTime() > bedAt.getTime()) bedAt = fromFin
    }
  }

  return {
    bedDateKey: dateKeyOf(bedAt),
    bedHm: formatHm(bedAt.getHours(), bedAt.getMinutes()),
  }
}

/** Rest hours between previous finish and next start (real datetimes). */
export function restHoursBetween(
  prevFinish: { dateKey: string; hm: string },
  nextStart: { dateKey: string; hm: string },
): number | null {
  const a = dateTimeFrom(prevFinish.dateKey, prevFinish.hm)
  let b = dateTimeFrom(nextStart.dateKey, nextStart.hm)
  if (!a || !b) return null
  // If finish ≤ start on same calendar interpretation but finish after start clock with overnight shift
  if (b.getTime() <= a.getTime()) {
    b = new Date(b.getTime() + 86_400_000)
  }
  return (b.getTime() - a.getTime()) / 3_600_000
}

export function isQuickReturnAdult(restH: number | null): boolean {
  if (restH == null) return false
  return restH <= HV_QUICK_RETURN_MAX_H
}

export function minorRestAlertHours(age: number): number | null {
  if (!Number.isFinite(age) || age < 13 || age >= 18) return null
  return age < 16 ? HV_MINOR_REST_MIN_UNDER16_H : HV_MINOR_REST_MIN_H
}

/** True if minor should see passive rest card (strictly less than threshold). */
export function shouldShowMinorRestCard(age: number, restH: number | null): boolean {
  const thr = minorRestAlertHours(age)
  if (thr == null || restH == null) return false
  return restH < thr
}

/**
 * Resolve trajet/prep for a day: day override → settings.
 */
export function resolveDayOffsets(
  day: Pick<HvDayPlan, 'trajetMin' | 'prepMin'>,
  settings: Pick<HvSettings, 'trajetMin' | 'prepMin'>,
): { trajetMin: number; prepMin: number } {
  return {
    trajetMin: day.trajetMin ?? settings.trajetMin,
    prepMin: day.prepMin ?? settings.prepMin,
  }
}

/**
 * Cycle index for a Monday: (weeks since ref) mod N.
 */
export function cycleIndexForMonday(
  mondayKey: string,
  refMondayKey: string,
  cycleLength: number,
): number {
  const ref = parseDateKey(refMondayKey)
  const cur = parseDateKey(mondayKey)
  if (!ref || !cur) return 0
  const diffDays = Math.round((cur.getTime() - ref.getTime()) / 86_400_000)
  const weeks = Math.floor(diffDays / 7)
  const n = Math.max(1, Math.min(4, cycleLength))
  return ((weeks % n) + n) % n
}

export function cycleLetter(index: number): string {
  return ['A', 'B', 'C', 'D'][clampInt(index, 0, 3)] ?? 'A'
}

/**
 * Night mode availability: not age-gated (verifier 5).
 * Callers must still enforce the 5 minor conditions in UI.
 */
export function canUseNightMode(): boolean {
  return true
}

/** Whether now is inside planned night window [bed, wake). */
export function isInPlannedNight(args: {
  now: Date
  bedDateKey: string
  bedHm: string
  wakeDateKey: string
  wakeHm: string
}): boolean {
  const bed = dateTimeFrom(args.bedDateKey, args.bedHm)
  const wake = dateTimeFrom(args.wakeDateKey, args.wakeHm)
  if (!bed || !wake) return false
  const t = args.now.getTime()
  if (wake.getTime() <= bed.getTime()) {
    // wraps
    return t >= bed.getTime() || t < wake.getTime()
  }
  return t >= bed.getTime() && t < wake.getTime()
}

/** Within 3 h before bed → show Prochain réveil first (Evan choice 3 / point 8). */
export function shouldShowNextAlarmFirst(args: {
  now: Date
  bedDateKey: string
  bedHm: string
  wakeDateKey: string
  wakeHm: string
}): boolean {
  if (isInPlannedNight(args)) return true
  const bed = dateTimeFrom(args.bedDateKey, args.bedHm)
  if (!bed) return false
  const threeH = 3 * 3_600_000
  const t = args.now.getTime()
  return t >= bed.getTime() - threeH && t < bed.getTime()
}

export function finishDateKeyIfOvernight(
  startDateKey: string,
  startHm: string,
  finishHm: string,
): string {
  const s = hmToMinutes(startHm)
  const f = hmToMinutes(finishHm)
  if (s == null || f == null) return startDateKey
  if (f <= s) return addDaysKey(startDateKey, 1) ?? startDateKey
  return startDateKey
}

export function defaultCycleNames(n: number): string[] {
  const names = ['A', 'B', 'C', 'D']
  return names.slice(0, Math.max(1, Math.min(4, n)))
}

export function slotForWeekday(
  slots: HvWeekdaySlot[],
  weekday: HvIsoWeekday,
): HvWeekdaySlot {
  return (
    slots.find((s) => s.weekday === weekday) ?? {
      weekday,
      kind: weekday >= 6 ? 'repos' : 'work',
      startHm: weekday >= 6 ? null : '08:00',
    }
  )
}

export function exceptionPhrase(dateKey: string, wakeHm: string, normalWakeHm: string): string {
  const d = parseDateKey(dateKey)
  const dayLabel = d
    ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })
    : dateKey
  return `${wakeHm.replace(/^0/, '')}, juste pour ${dayLabel}. Après, tu reviens à ${normalWakeHm.replace(/^0/, '')}.`
}
