/**
 * Rappel fin d’essai à J−2 (brief §12 + ARCHI §6.4).
 * Notification locale ; si permission refusée → info in-app seulement.
 */
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PRO_TRIAL_END_REMINDER_DAYS_BEFORE } from '../../shared/subscriptions/constants'

const REMINDER_ID = 72014

export async function scheduleTrialEndReminder(trialEndsAt: number | null | undefined): Promise<{
  scheduled: boolean
  reason?: string
}> {
  if (!trialEndsAt || !Number.isFinite(trialEndsAt)) {
    return { scheduled: false, reason: 'no_trial_end' }
  }
  const fireAt = trialEndsAt - PRO_TRIAL_END_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000
  if (fireAt <= Date.now()) {
    return { scheduled: false, reason: 'too_late' }
  }

  if (!Capacitor.isNativePlatform()) {
    return { scheduled: false, reason: 'web_no_local_push' }
  }

  try {
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') {
      return { scheduled: false, reason: 'permission_denied' }
    }
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: 'Fin de ton essai Ranked Pro',
          body: 'Ton essai se termine dans 2 jours. Résilie au moins 24 h avant si tu ne veux pas être prélevé.',
          schedule: { at: new Date(fireAt) },
        },
      ],
    })
    return { scheduled: true }
  } catch {
    return { scheduled: false, reason: 'schedule_failed' }
  }
}

export async function cancelTrialEndReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
  } catch {
    /* ignore */
  }
}
