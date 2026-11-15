/**
 * Emploi du temps variable — pure engine (25 états VALIDÉ + choix Evan).
 * Local data only. No Convex. No forbidden scoring vocabulary.
 */

import {
  HV_AUTO_PAUSE_IDLE_DAYS,
  HV_DEFAULT_DECOMPRESSION_MIN,
  HV_MAX_ARMED_ALARMS,
  HV_PLAN_HORIZON_DAYS,
  HV_REST_SOFT_WAKE_HM,
  HV_SUNDAY_REMINDER_MAX_HM,
  HV_SUNDAY_REMINDER_MIN_HM,
} from './constants.ts'

export type HvDayKind = 'tot' | 'soir' | 'nuit' | 'repos' | 'unset'

export type HvWeekTemplate = 'A' | 'B'

/** ISO weekday 1=lun … 7=dim — template row for activation / A/B. */
export type HvIsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type HvWeekdaySlot = {
  weekday: HvIsoWeekday
  /** repos = pas de réveil ; work = début + réveil calculé */
  kind: 'work' | 'repos'
  /** HH:MM when kind=work */
  startHm: string | null
}

export type HvDayPlan = {
  /** YYYY-MM-DD local */
  dateKey: string
  kind: HvDayKind
  /** Start of activity HH:MM, null if unset / rest */
  startHm: string | null
  /** Override wake HH:MM for this day only */
  wakeOverrideHm: string | null
  /** Soft wake enabled on rest day */
  softWake: boolean
  softWakeHm: string
  /** No alarm this day */
  noAlarm: boolean
  /** One-shot offset minutes applied today only (cleared after day) */
  oneShotOffsetMin: number
}

export type HvSettings = {
  enabled: boolean
  trajetMin: number
  prepMin: number
  decompressionMin: number
  weeksAb: boolean
  /** Semaine unique (A/B off) ou modèle A */
  weekASlots: HvWeekdaySlot[]
  /** Modèle B (utilisé seulement si weeksAb) */
  weekBSlots: HvWeekdaySlot[]
  /** Reference Monday dateKey that starts week A */
  weekARefMondayKey: string
  sundayReminderHm: string
  sundayReminderEnabled: boolean
  /** Vacation pause end dateKey (inclusive last pause day); null = not paused */
  vacationPauseUntilKey: string | null
  /** Auto-pause after idle */
  autoPaused: boolean
  autoPauseCardDismissed: boolean
  /** Last time a startHm was set (ISO) — for idle detection */
  lastStartEditAt: string | null
  activatedAt: string | null
}

/** Duration / start-time step for activation pickers (Evan 21h03). */
export const HV_DURATION_STEP_MIN = 15
export const HV_DURATION_MAX_MIN = 120

export const HV_WEEKDAY_LABELS_FR: Record<HvIsoWeekday, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
}

export type HvSleepSegment = {
  /** Minutes from midnight of the sleep-day (can span) */
  startMin: number
  endMin: number
  kind: 'nuit' | 'sieste'
}

export type HvWeekDebtInput = {
  /** Time in bed + naps hours per day (7 entries, oldest→newest or any order summed) */
  tibHours: number[]
  /** Age band floor hours (B_bas) or personal goal, never below B_bas */
  referenceHours: number
}

export type HvWeekDebt = {
  manqueHours: number
  recupereHours: number
  /** Rounded to 30 min for display */
  manqueDisplayHours: number
  recupereDisplayHours: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseHm(hm: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export function formatHm(hour: number, minute: number): string {
  const h = ((hour % 24) + 24) % 24
  const m = ((minute % 60) + 60) % 60
  return `${pad2(h)}:${pad2(m)}`
}

export function hmToMinutes(hm: string): number | null {
  const p = parseHm(hm)
  if (!p) return null
  return p.hour * 60 + p.minute
}

export function minutesToHm(total: number): string {
  const n = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return formatHm(Math.floor(n / 60), n % 60)
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function defaultWeekSlots(startHm = '08:00'): HvWeekdaySlot[] {
  return ([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => {
    if (weekday >= 6) {
      return { weekday, kind: 'repos' as const, startHm: null }
    }
    return { weekday, kind: 'work' as const, startHm }
  })
}

export function defaultHvSettings(now = new Date()): HvSettings {
  return {
    enabled: false,
    trajetMin: 75,
    prepMin: 30,
    decompressionMin: HV_DEFAULT_DECOMPRESSION_MIN,
    weeksAb: false,
    weekASlots: defaultWeekSlots('08:00'),
    weekBSlots: defaultWeekSlots('14:00'),
    weekARefMondayKey: mondayKeyOf(now),
    sundayReminderHm: HV_SUNDAY_REMINDER_MIN_HM,
    sundayReminderEnabled: true,
    vacationPauseUntilKey: null,
    autoPaused: false,
    autoPauseCardDismissed: false,
    lastStartEditAt: null,
    activatedAt: null,
  }
}

export function sanitizeSundayReminderHm(hm: string): string {
  const min = hmToMinutes(HV_SUNDAY_REMINDER_MIN_HM)!
  const max = hmToMinutes(HV_SUNDAY_REMINDER_MAX_HM)!
  const v = hmToMinutes(hm)
  if (v == null) return HV_SUNDAY_REMINDER_MIN_HM
  return minutesToHm(clampInt(v, min, max))
}

/** Snap to 15 min steps in [0, 120]. */
export function snapDurationMin(
  min: number,
  step = HV_DURATION_STEP_MIN,
  max = HV_DURATION_MAX_MIN,
): number {
  if (!Number.isFinite(min)) return 0
  const snapped = Math.round(min / step) * step
  return clampInt(snapped, 0, max)
}

export function sanitizeDecompressionMin(min: number): number {
  return snapDurationMin(min)
}

export function sanitizeTrajetMin(min: number): number {
  return snapDurationMin(min)
}

export function sanitizePrepMin(min: number): number {
  return snapDurationMin(min)
}

/** All allowed duration values 0…120 by 15 min. */
export function durationOptionsMin(
  step = HV_DURATION_STEP_MIN,
  max = HV_DURATION_MAX_MIN,
): number[] {
  const out: number[] = []
  for (let m = 0; m <= max; m += step) out.push(m)
  return out
}

/** Start times 00:00…23:45 by 15 min. */
export function startHmOptions(step = HV_DURATION_STEP_MIN): string[] {
  const out: string[] = []
  for (let m = 0; m < 24 * 60; m += step) {
    out.push(minutesToHm(m))
  }
  return out
}

export function formatDurationFr(totalMin: number): string {
  const m = snapDurationMin(totalMin)
  if (m === 0) return '0 min'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  if (r === 0) return h === 1 ? '1 h' : `${h} h`
  return `${h} h ${r}`
}

export function sanitizeWeekSlots(
  raw: unknown,
  fallback: HvWeekdaySlot[],
): HvWeekdaySlot[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback.map((s) => ({ ...s }))
  const byWd = new Map<number, HvWeekdaySlot>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Partial<HvWeekdaySlot>
    const wd = Number(r.weekday)
    if (wd < 1 || wd > 7) continue
    const kind = r.kind === 'repos' ? 'repos' : 'work'
    let startHm: string | null = null
    if (kind === 'work') {
      startHm = typeof r.startHm === 'string' ? snapHmToStep(r.startHm) ?? '08:00' : '08:00'
    }
    byWd.set(wd, {
      weekday: wd as HvIsoWeekday,
      kind,
      startHm: kind === 'repos' ? null : startHm,
    })
  }
  return ([1, 2, 3, 4, 5, 6, 7] as const).map(
    (weekday) => byWd.get(weekday) ?? fallback.find((s) => s.weekday === weekday) ?? {
      weekday,
      kind: weekday >= 6 ? 'repos' : 'work',
      startHm: weekday >= 6 ? null : '08:00',
    },
  )
}

/** Snap HH:MM to 15-minute grid. */
export function snapHmToStep(hm: string, step = HV_DURATION_STEP_MIN): string | null {
  const total = hmToMinutes(hm)
  if (total == null) return null
  const snapped = Math.round(total / step) * step
  return minutesToHm(((snapped % (24 * 60)) + 24 * 60) % (24 * 60))
}

export function slotWakeLabel(
  slot: HvWeekdaySlot,
  trajetMin: number,
  prepMin: number,
): string | null {
  if (slot.kind === 'repos' || !slot.startHm) return null
  return computeWakeHm(slot.startHm, trajetMin, prepMin)
}

/**
 * Expand week A/B templates into concrete day plans for the next horizon.
 * Preserves one-shot overrides on existing days when dateKey matches.
 */
export function materializeDaysFromTemplates(args: {
  settings: HvSettings
  existingDays?: HvDayPlan[]
  fromDateKey: string
  horizonDays?: number
}): HvDayPlan[] {
  const horizon = args.horizonDays ?? HV_PLAN_HORIZON_DAYS
  const existing = new Map((args.existingDays ?? []).map((d) => [d.dateKey, d]))
  const out: HvDayPlan[] = []
  for (let i = 0; i < horizon; i++) {
    const key = addDaysKey(args.fromDateKey, i)
    if (!key) continue
    const wd = isoWeekdayFromKey(key)
    if (!wd) continue
    const tmpl = args.settings.weeksAb
      ? weekTemplateForDate(key, args.settings.weekARefMondayKey)
      : 'A'
    const slots = tmpl === 'B' ? args.settings.weekBSlots : args.settings.weekASlots
    const slot = slots.find((s) => s.weekday === wd) ?? {
      weekday: wd,
      kind: 'repos' as const,
      startHm: null,
    }
    const prev = existing.get(key)
    if (slot.kind === 'repos') {
      out.push({
        ...(prev ?? emptyDayPlan(key)),
        dateKey: key,
        kind: 'repos',
        startHm: null,
        noAlarm: !(prev?.softWake),
        softWake: prev?.softWake ?? false,
        softWakeHm: prev?.softWakeHm ?? HV_REST_SOFT_WAKE_HM,
        wakeOverrideHm: null,
        oneShotOffsetMin: 0,
      })
      continue
    }
    out.push({
      ...(prev ?? emptyDayPlan(key)),
      dateKey: key,
      kind: 'tot',
      startHm: slot.startHm,
      noAlarm: false,
      // Keep same-day one-shot / override if already set for this date
      wakeOverrideHm: prev?.wakeOverrideHm ?? null,
      oneShotOffsetMin: prev?.oneShotOffsetMin ?? 0,
    })
  }
  return out
}

/**
 * Réveil calculé = début − trajet − préparation (état 13).
 * Returns null if start missing.
 */
export function computeWakeHm(
  startHm: string,
  trajetMin: number,
  prepMin: number,
): string | null {
  const start = hmToMinutes(startHm)
  if (start == null) return null
  const offset = clampInt(trajetMin, 0, 24 * 60) + clampInt(prepMin, 0, 24 * 60)
  return minutesToHm(start - offset)
}

/** Apply one-shot offset to a wake time (état 30 / 10). */
export function applyOneShotOffset(wakeHm: string, offsetMin: number): string | null {
  const base = hmToMinutes(wakeHm)
  if (base == null) return null
  return minutesToHm(base + offsetMin)
}

export function effectiveWakeForDay(
  day: HvDayPlan,
  trajetMin: number,
  prepMin: number,
): string | null {
  if (day.noAlarm) return null
  if (day.kind === 'repos') {
    if (!day.softWake) return null
    return day.softWakeHm || HV_REST_SOFT_WAKE_HM
  }
  if (day.wakeOverrideHm) {
    return applyOneShotOffset(day.wakeOverrideHm, day.oneShotOffsetMin)
  }
  if (!day.startHm) return null
  const computed = computeWakeHm(day.startHm, trajetMin, prepMin)
  if (!computed) return null
  return applyOneShotOffset(computed, day.oneShotOffsetMin)
}

/** Coucher conseillé = fin + décompression (état 25). */
export function suggestedBedtimeHm(finishHm: string, decompressionMin: number): string | null {
  const fin = hmToMinutes(finishHm)
  if (fin == null) return null
  return minutesToHm(fin + sanitizeDecompressionMin(decompressionMin))
}

export function decompressionCopy(finishHm: string, decompressionMin: number): string {
  const bed = suggestedBedtimeHm(finishHm, decompressionMin)
  const dec = sanitizeDecompressionMin(decompressionMin)
  const decLabel =
    dec === 0 ? '0 min' : dec < 60 ? `${dec} min` : dec % 60 === 0 ? `${dec / 60} h` : `${Math.floor(dec / 60)} h ${dec % 60}`
  const finLabel = finishHm.replace(/^0/, '')
  const bedLabel = (bed ?? '?').replace(/^0/, '')
  return `Fin à ${finLabel}, ${decLabel} pour souffler : coucher conseillé vers ${bedLabel}.`
}

/** Total sleep on a day = principal + planned naps (état 7 / 8). */
export function totalSleepMinutes(segments: HvSleepSegment[]): number {
  let sum = 0
  for (const s of segments) {
    const dur = s.endMin - s.startMin
    if (dur > 0) sum += dur
  }
  return sum
}

export function formatHoursMinutesFr(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (r === 0) return `${h} h`
  if (h === 0) return `${r} min`
  return `${h} h ${pad2(r).replace(/^0/, '') === String(r) ? r : r}`
}

/** Round to nearest 30 minutes (display). */
export function roundHalfHour(hours: number): number {
  if (!Number.isFinite(hours)) return 0
  return Math.round(hours * 2) / 2
}

/**
 * Weekly debt (SCIENCE §2.2) — grey bars, no guilt wording here.
 */
export function computeWeekDebt(input: HvWeekDebtInput): HvWeekDebt {
  const R = Math.max(0, input.referenceHours)
  let manque = 0
  let surplus = 0
  for (const t of input.tibHours) {
    const T = Math.max(0, t)
    manque += Math.max(0, R - T)
    surplus += Math.max(0, T - R)
  }
  const recupere = Math.min(manque, surplus)
  return {
    manqueHours: manque,
    recupereHours: recupere,
    manqueDisplayHours: roundHalfHour(manque),
    recupereDisplayHours: roundHalfHour(recupere),
  }
}

export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

export function addDaysKey(key: string, days: number): string | null {
  const dt = parseDateKey(key)
  if (!dt) return null
  dt.setDate(dt.getDate() + days)
  return dateKeyOf(dt)
}

/** Monday of the week containing `d` (ISO-like: Mon=start). */
export function mondayKeyOf(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = copy.getDay() // 0=Sun
  const delta = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + delta)
  return dateKeyOf(copy)
}

export function isoWeekdayFromKey(dateKey: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  const dt = parseDateKey(dateKey)
  if (!dt) return null
  const js = dt.getDay()
  return (js === 0 ? 7 : js) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}

/**
 * Week A/B parity from reference Monday (état 29).
 * Even weeks from ref → A, odd → B (ref week is A).
 */
export function weekTemplateForDate(
  dateKey: string,
  weekARefMondayKey: string,
): HvWeekTemplate {
  const mon = mondayKeyOf(parseDateKey(dateKey) ?? new Date())
  const ref = parseDateKey(weekARefMondayKey)
  const cur = parseDateKey(mon)
  if (!ref || !cur) return 'A'
  const diffDays = Math.round((cur.getTime() - ref.getTime()) / 86_400_000)
  const weeks = Math.floor(diffDays / 7)
  return ((weeks % 2) + 2) % 2 === 0 ? 'A' : 'B'
}

export function isHvPaused(
  settings: HvSettings,
  todayKey: string,
): { paused: boolean; reason: 'vacation' | 'auto' | null } {
  if (settings.autoPaused) return { paused: true, reason: 'auto' }
  if (settings.vacationPauseUntilKey) {
    if (todayKey <= settings.vacationPauseUntilKey) {
      return { paused: true, reason: 'vacation' }
    }
  }
  return { paused: false, reason: null }
}

/**
 * Auto-pause after 7 days without start time (état 31 A).
 * Uses lastStartEditAt or activatedAt as anchor when no starts exist.
 */
export function shouldAutoPause(args: {
  settings: HvSettings
  hasAnyStart: boolean
  now?: Date
}): boolean {
  const { settings, hasAnyStart } = args
  if (!settings.enabled || settings.autoPaused) return false
  if (hasAnyStart) return false
  const now = args.now ?? new Date()
  const anchorIso = settings.lastStartEditAt ?? settings.activatedAt
  if (!anchorIso) return false
  const anchor = new Date(anchorIso)
  if (Number.isNaN(anchor.getTime())) return false
  const idleMs = now.getTime() - anchor.getTime()
  return idleMs >= HV_AUTO_PAUSE_IDLE_DAYS * 86_400_000
}

/** Resume Monday after vacation pause ending on `untilKey` (inclusive). */
export function vacationResumeKey(untilKey: string): string | null {
  return addDaysKey(untilKey, 1)
}

/**
 * Build armed wake list for next horizon (état 29 A).
 * Caps at HV_MAX_ARMED_ALARMS.
 */
export function buildArmedWakes(args: {
  days: HvDayPlan[]
  trajetMin: number
  prepMin: number
  fromDateKey: string
  horizonDays?: number
  maxArmed?: number
}): { dateKey: string; wakeHm: string }[] {
  const horizon = args.horizonDays ?? HV_PLAN_HORIZON_DAYS
  const maxArmed = Math.min(
    args.maxArmed ?? HV_MAX_ARMED_ALARMS,
    HV_MAX_ARMED_ALARMS,
  )
  const byKey = new Map(args.days.map((d) => [d.dateKey, d]))
  const out: { dateKey: string; wakeHm: string }[] = []
  for (let i = 0; i < horizon; i++) {
    const key = addDaysKey(args.fromDateKey, i)
    if (!key) continue
    const day = byKey.get(key)
    if (!day) continue
    const wake = effectiveWakeForDay(day, args.trajetMin, args.prepMin)
    if (!wake) continue
    out.push({ dateKey: key, wakeHm: wake })
    if (out.length >= maxArmed) break
  }
  return out
}

/**
 * Water day key: from last wake to next wake (état 26 A).
 * If `lastWakeAt` is provided, day belongs to the sleep-day that started at that wake
 * until the next wake. Without wake data, fall back to calendar date (caller may use 04:00 rule).
 */
export function waterDayKeyWakeToWake(args: {
  now: Date
  /** ISO timestamp of last principal wake */
  lastWakeAt: string | null
  /** ISO timestamp of next expected wake (optional) */
  nextWakeAt?: string | null
}): string {
  const { now, lastWakeAt } = args
  if (!lastWakeAt) return dateKeyOf(now)
  const last = new Date(lastWakeAt)
  if (Number.isNaN(last.getTime())) return dateKeyOf(now)
  if (now < last) return dateKeyOf(last)
  const nextIso = args.nextWakeAt
  if (nextIso) {
    const next = new Date(nextIso)
    if (!Number.isNaN(next.getTime()) && now >= next) {
      return dateKeyOf(next)
    }
  }
  // Day key = calendar date of the wake that opened the current water day
  return dateKeyOf(last)
}

/**
 * Short night: wake rings soon after "Dormir maintenant" (état 15 / 08).
 * Suggest delay = +4 h from current wake (product example).
 */
export function shortNightShiftSuggestion(wakeHm: string, delayMin = 240): string | null {
  return applyOneShotOffset(wakeHm, delayMin)
}

export function isMinorAge(age: number): boolean {
  return Number.isFinite(age) && age >= 13 && age < 18
}

/** Night mode (écran 3 h) forbidden for minors. */
export function canUseNightMode(age: number): boolean {
  return Number.isFinite(age) && age >= 18
}

export function emptyDayPlan(dateKey: string): HvDayPlan {
  return {
    dateKey,
    kind: 'unset',
    startHm: null,
    wakeOverrideHm: null,
    softWake: false,
    softWakeHm: HV_REST_SOFT_WAKE_HM,
    noAlarm: false,
    oneShotOffsetMin: 0,
  }
}

export function copyWeekTemplate(
  sourceDays: HvDayPlan[],
  targetMondayKey: string,
): HvDayPlan[] {
  const byWd = new Map<number, HvDayPlan>()
  for (const d of sourceDays) {
    const wd = isoWeekdayFromKey(d.dateKey)
    if (wd) byWd.set(wd, d)
  }
  const out: HvDayPlan[] = []
  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(targetMondayKey, i)
    if (!key) continue
    const src = byWd.get((i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7)
    if (!src) {
      out.push(emptyDayPlan(key))
      continue
    }
    out.push({
      ...src,
      dateKey: key,
      oneShotOffsetMin: 0,
      wakeOverrideHm: null,
    })
  }
  return out
}
