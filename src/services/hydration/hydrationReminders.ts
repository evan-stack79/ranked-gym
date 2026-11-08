/**
 * Rappels locaux opt-in (HY-c). Web = pas de rappels v0.
 * Natif : @capacitor/local-notifications si le plugin est présent.
 *
 * M2-b2 — NEVER `at` + `repeats` (plugin 8.3.1 → intervalle variable / nuit).
 * Quotidien fixe via `schedule.on: { hour, minute }` uniquement.
 * Pause jour (objectif) : cancel + ne replanifie que les créneaux déjà passés
 * (prochaine occurrence = demain) ; le lendemain un sync sans goalReached
 * rétablit les 3 créneaux (récurrence intacte).
 */
import {
  DEFAULT_REMINDER_TIMES,
  MSG_REMINDER_BODY,
  REMINDER_NOTIFICATION_IDS,
  REMINDERS_MAX_PER_DAY,
  isReminderTimeAllowed,
} from '../../shared/hydration'
import { Capacitor } from '@capacitor/core'

export type ReminderScheduleInput = {
  enabled: boolean
  times: string[]
  /** Si true → pause du jour (pas de créneau encore à venir aujourd’hui). */
  goalReachedToday?: boolean
}

export type HydrationReminderNotification = {
  id: number
  title: string
  body: string
  schedule: {
    on: { hour: number; minute: number }
    allowWhileIdle: true
  }
  extra: { kind: 'hydration'; skipToday: boolean }
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

type LocalNotificationsMod = typeof import('@capacitor/local-notifications')

async function loadLocalNotifications(): Promise<LocalNotificationsMod | null> {
  if (!isNative()) return null
  try {
    return await import('@capacitor/local-notifications')
  } catch {
    return null
  }
}

export function sanitizeReminderTimes(times: string[]): string[] {
  const out: string[] = []
  for (const t of times) {
    if (!isReminderTimeAllowed(t)) continue
    if (out.includes(t)) continue
    out.push(t)
    if (out.length >= REMINDERS_MAX_PER_DAY) break
  }
  return out
}

export function defaultReminderTimes(): string[] {
  return [...DEFAULT_REMINDER_TIMES]
}

/** Prochaine occurrence locale de HH:MM ; si skipToday, force ≥ demain 00:00. */
export function nextReminderAt(
  hour: number,
  minute: number,
  now = new Date(),
  skipToday = false,
): Date {
  const at = new Date(now)
  at.setSeconds(0, 0)
  at.setHours(hour, minute, 0, 0)
  if (skipToday) {
    const tomorrow = new Date(now)
    tomorrow.setHours(0, 0, 0, 0)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (at < tomorrow) {
      at.setFullYear(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
    }
    return at
  }
  if (at.getTime() <= now.getTime()) {
    at.setDate(at.getDate() + 1)
  }
  return at
}

/** True si HH:MM est encore strictement dans le futur aujourd’hui. */
export function isReminderStillAheadToday(
  hour: number,
  minute: number,
  now = new Date(),
): boolean {
  const slot = new Date(now)
  slot.setSeconds(0, 0)
  slot.setHours(hour, minute, 0, 0)
  return slot.getTime() > now.getTime()
}

/**
 * Construit le payload plugin — tests M2 vérifient cette forme.
 * Jamais `at` / `repeats` / `every`.
 */
export function buildHydrationReminderNotifications(
  times: string[],
  opts?: { goalReachedToday?: boolean; now?: Date },
): HydrationReminderNotification[] {
  const skipToday = Boolean(opts?.goalReachedToday)
  const now = opts?.now ?? new Date()
  const sanitized = sanitizeReminderTimes(times)
  const selected = skipToday
    ? sanitized.filter((hhmm) => {
        const [hour, minute] = hhmm.split(':').map(Number)
        // Uniquement créneaux déjà passés → prochaine occ. = demain (pause jour).
        return !isReminderStillAheadToday(hour, minute, now)
      })
    : sanitized

  return selected.map((hhmm) => {
    const [hour, minute] = hhmm.split(':').map(Number)
    // ID stable par créneau dans la liste sanitizée (10→7101, 14→7102, 18→7103).
    const slotIndex = sanitized.indexOf(hhmm)
    const id = REMINDER_NOTIFICATION_IDS[slotIndex] ?? 7101 + Math.max(0, slotIndex)
    return {
      id,
      title: 'Ranked Gym',
      body: MSG_REMINDER_BODY,
      schedule: {
        on: { hour, minute },
        allowWhileIdle: true as const,
      },
      extra: { kind: 'hydration' as const, skipToday },
    }
  })
}

/** Annule toutes les notifs hydratation (ids 7101–7103). */
export async function cancelHydrationReminders(): Promise<void> {
  const mod = await loadLocalNotifications()
  if (!mod) return
  await mod.LocalNotifications.cancel({
    notifications: REMINDER_NOTIFICATION_IDS.map((id) => ({ id })),
  })
}

/**
 * Planifie rappels quotidiens fixes (on hour/minute).
 * Permission OS demandée seulement si enabled=true.
 */
export async function syncHydrationReminders(
  input: ReminderScheduleInput,
): Promise<{ ok: boolean; reason?: string }> {
  if (!input.enabled) {
    await cancelHydrationReminders()
    return { ok: true, reason: 'OFF' }
  }

  if (!isNative()) {
    return { ok: false, reason: 'WEB_NO_REMINDERS_V0' }
  }

  const mod = await loadLocalNotifications()
  if (!mod) {
    return { ok: false, reason: 'PLUGIN_MISSING' }
  }

  const perm = await mod.LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') {
    await cancelHydrationReminders()
    return { ok: false, reason: 'PERMISSION_DENIED' }
  }

  const times = sanitizeReminderTimes(input.times)
  if (times.length === 0) {
    await cancelHydrationReminders()
    return { ok: true, reason: 'NO_TIMES' }
  }

  await cancelHydrationReminders()

  const skipToday = Boolean(input.goalReachedToday)
  const notifications = buildHydrationReminderNotifications(times, {
    goalReachedToday: skipToday,
  })

  // Même si aucun créneau à planifier (objectif atteint avant le 1er),
  // cancel a déjà assuré la pause du jour ; reprise demain au prochain sync.
  if (notifications.length > 0) {
    await mod.LocalNotifications.schedule({ notifications })
  }

  return { ok: true, reason: skipToday ? 'GOAL_REACHED_RESUME_TOMORROW' : 'SCHEDULED' }
}

/** Après un ajout : si objectif atteint et rappels on → pause jour / reprise demain. */
export async function pauseHydrationRemindersIfGoalReached(input: {
  remindersEnabled: boolean
  reminderTimes: string[]
  drunkMl: number
  goalMl: number
}): Promise<void> {
  if (!input.remindersEnabled) return
  if (input.drunkMl < input.goalMl) return
  await syncHydrationReminders({
    enabled: true,
    times: input.reminderTimes,
    goalReachedToday: true,
  })
}
