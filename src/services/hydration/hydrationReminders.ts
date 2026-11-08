/**
 * Rappels locaux opt-in (HY-c). Web = pas de rappels v0.
 * Natif : @capacitor/local-notifications si le plugin est présent.
 * M2 — stop restants du jour à l’objectif, sans casser la récurrence demain.
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
  /** Si true → ignore les créneaux restants aujourd’hui, reprend demain (récurrence intacte). */
  goalReachedToday?: boolean
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

/** Annule toutes les notifs hydratation (ids 7101–7103). */
export async function cancelHydrationReminders(): Promise<void> {
  const mod = await loadLocalNotifications()
  if (!mod) return
  await mod.LocalNotifications.cancel({
    notifications: REMINDER_NOTIFICATION_IDS.map((id) => ({ id })),
  })
}

/**
 * Planifie rappels quotidiens. Permission OS demandée seulement si enabled=true.
 * goalReachedToday : annule le reste du jour puis reprogramme en daily à partir de demain
 * (la récurrence n’est pas cassée — contrairement à un cancel nu).
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
  const now = new Date()
  const notifications = times.map((hhmm, index) => {
    const [hour, minute] = hhmm.split(':').map(Number)
    const at = nextReminderAt(hour, minute, now, skipToday)
    return {
      id: REMINDER_NOTIFICATION_IDS[index] ?? 7101 + index,
      title: 'Ranked Gym',
      body: MSG_REMINDER_BODY,
      schedule: {
        at,
        repeats: true,
        every: 'day' as const,
        allowWhileIdle: true,
      },
      extra: { kind: 'hydration', skipToday },
    }
  })

  await mod.LocalNotifications.schedule({ notifications })
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
