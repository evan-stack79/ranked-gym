/**
 * Health / steps helpers for the PWA.
 * Full Apple Health / Google Fit need a native shell (Capacitor).
 * Here we: request notification permission, store a “linked” intent,
 * and keep a simple manual / estimated steps path that still drives nutrition.
 */

export async function requestReminderPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png' })
  } catch {
    // ignore
  }
}

/** Check schedule and ping if a session starts within the next ~15 minutes (app open). */
export function checkUpcomingReminders(
  schedule: Array<{ title: string; days: number[]; time: string; enabled: boolean }>,
): void {
  const now = new Date()
  const day = now.getDay()
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  for (const item of schedule) {
    if (!item.enabled || !item.days.includes(day as 0 | 1 | 2 | 3 | 4 | 5 | 6)) continue
    const [h, m] = item.time.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) continue
    const target = h * 60 + m
    const delta = target - minutesNow
    if (delta >= 0 && delta <= 15) {
      notify('Séance Ranked Gym', `${item.title} dans ${delta === 0 ? 'quelques instants' : `${delta} min`} · ${item.time}`)
    }
  }
}

/**
 * Best-effort “connect health”:
 * - Requests notification permission (reminders)
 * - Marks health as linked in app storage (caller)
 * Native HealthKit / Health Connect can plug into `pullStepsFromOS` later.
 */
export async function connectHealthIntent(): Promise<{ ok: boolean; message: string }> {
  const notifOk = await requestReminderPermission()
  // Web cannot read Apple Santé / Google Fit steps directly.
  return {
    ok: true,
    message: notifOk
      ? 'Rappels activés. Les pas se saisissent ici (Santé Apple / Google Fit arriveront en app native).'
      : 'Tu peux entrer tes pas à la main. Active les notifs pour les rappels de séance.',
  }
}

export async function pullStepsFromOS(): Promise<number | null> {
  // Placeholder for future Capacitor HealthKit / Health Connect plugins.
  return null
}
