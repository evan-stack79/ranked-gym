/**
 * Rappels locaux opt-in (HY-c). Web = pas de rappels v0.
 * Natif : @capacitor/local-notifications si le plugin est présent.
 * Stop rappels du jour dès objectif atteint (Evan).
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
  /** Si true → annule les notifs restantes du jour (objectif atteint). */
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
 * Retourne false si permission refusée / non natif / plugin absent.
 */
export async function syncHydrationReminders(
  input: ReminderScheduleInput,
): Promise<{ ok: boolean; reason?: string }> {
  if (!input.enabled || input.goalReachedToday) {
    await cancelHydrationReminders()
    return { ok: true, reason: input.goalReachedToday ? 'GOAL_REACHED' : 'OFF' }
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

  const notifications = times.map((hhmm, index) => {
    const [hour, minute] = hhmm.split(':').map(Number)
    return {
      id: REMINDER_NOTIFICATION_IDS[index] ?? 7101 + index,
      title: 'Ranked Gym',
      body: MSG_REMINDER_BODY,
      schedule: {
        on: { hour, minute },
        repeats: true,
        allowWhileIdle: true,
      },
      extra: { kind: 'hydration' },
    }
  })

  await mod.LocalNotifications.schedule({ notifications })
  return { ok: true }
}
