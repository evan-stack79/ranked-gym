/**
 * Règles v7 — auto-log de la nuit au 1er ouverture du matin (04:00–12:00).
 * Estimation sans montre : lever = min(ouverture app, lever prévu).
 * Aucune notification nocturne.
 */

import { hmToMinutes, minutesToHm, todayDateKey } from './sleepTimeFormat'

export const MORNING_AUTO_LOG_START_HOUR = 4
export const MORNING_AUTO_LOG_END_HOUR = 12

export interface SleepAutoLogSchedule {
  bedtime: string
  waketime: string
}

export interface SleepAutoLogDecisionInput {
  now: Date
  /** Horaires prévus (cadran « Tes horaires »). */
  schedule: SleepAutoLogSchedule | null
  /** true si une nuit existe déjà pour le dateKey du lever (aujourd’hui). */
  nightAlreadyLogged: boolean
  /** dateKey du dernier passage du flux matin (prompt affiché / traité). */
  morningPromptDateKey: string | null
}

export interface SleepAutoLogPlan {
  shouldRun: boolean
  reason:
    | 'ok'
    | 'outside_window'
    | 'no_schedule'
    | 'already_logged'
    | 'already_prompted_today'
  dateKey: string
  bedtime: string | null
  waketime: string | null
}

export function isInMorningAutoLogWindow(now: Date): boolean {
  const h = now.getHours()
  return h >= MORNING_AUTO_LOG_START_HOUR && h < MORNING_AUTO_LOG_END_HOUR
}

/**
 * Lever estimé = le plus tôt entre l’ouverture de l’app et le lever prévu.
 * Fenêtre matin uniquement (heures linéaires 0–12) — pas de wrap minuit ici.
 */
export function resolveAutoLogWaketime(openHm: string, plannedWakeHm: string): string | null {
  const openMin = hmToMinutes(openHm)
  const plannedMin = hmToMinutes(plannedWakeHm)
  if (openMin == null || plannedMin == null) return null
  return minutesToHm(Math.min(openMin, plannedMin))
}

export function planMorningAutoLog(input: SleepAutoLogDecisionInput): SleepAutoLogPlan {
  const dateKey = todayDateKey(input.now)

  if (!isInMorningAutoLogWindow(input.now)) {
    return {
      shouldRun: false,
      reason: 'outside_window',
      dateKey,
      bedtime: null,
      waketime: null,
    }
  }

  if (input.morningPromptDateKey === dateKey) {
    return {
      shouldRun: false,
      reason: 'already_prompted_today',
      dateKey,
      bedtime: null,
      waketime: null,
    }
  }

  if (input.nightAlreadyLogged) {
    return {
      shouldRun: false,
      reason: 'already_logged',
      dateKey,
      bedtime: null,
      waketime: null,
    }
  }

  if (!input.schedule) {
    return {
      shouldRun: false,
      reason: 'no_schedule',
      dateKey,
      bedtime: null,
      waketime: null,
    }
  }

  const openHm = minutesToHm(input.now.getHours() * 60 + input.now.getMinutes())
  const waketime = resolveAutoLogWaketime(openHm, input.schedule.waketime)
  if (!waketime) {
    return {
      shouldRun: false,
      reason: 'no_schedule',
      dateKey,
      bedtime: null,
      waketime: null,
    }
  }

  return {
    shouldRun: true,
    reason: 'ok',
    dateKey,
    bedtime: input.schedule.bedtime,
    waketime,
  }
}
