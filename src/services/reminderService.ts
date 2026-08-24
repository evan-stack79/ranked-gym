/**
 * Session reminders for the PWA.
 * Needs Notification permission (requested on user gesture when saving agenda).
 * Polls while the app is open; uses Service Worker when available (better on mobile).
 */

const FIRED_KEY = 'ranked-gym:reminder-fired'

/** Titre sans nom d'app — iOS/macOS affiche déjà le short_name du manifest. */
export const REMINDER_TITLE = "L'arène t'attend 🥊"
export const REMINDER_TITLE_DUE = 'Prêt pour le combat ?'
export const REMINDER_TEST_BODY =
  'Rappel activé. Prépare-toi à tout donner pour ta prochaine séance.'

type ScheduleItem = {
  id: string
  title: string
  days: number[]
  time: string
  enabled: boolean
  remindBeforeMin?: number
}

/** Payload minimal — title + body uniquement (pas de subtitle). */
type ReminderNotificationPayload = {
  body: string
  icon: string
  badge: string
  tag: string
}

function readFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function writeFired(map: Record<string, number>) {
  localStorage.setItem(FIRED_KEY, JSON.stringify(map))
}

function buildNotificationPayload(body: string, tagKey: string): ReminderNotificationPayload {
  return {
    body,
    icon: '/icon.png',
    badge: '/pwa-192x192.png',
    tag: `ranked-gym-${tagKey}`.slice(0, 64),
  }
}

function buildSessionReminderBody(item: ScheduleItem, minutesLeft: number): string {
  if (minutesLeft === 0) {
    return `${item.title} · c'est l'heure (${item.time}). Entre dans l'arène.`
  }
  return `${item.title} dans ${minutesLeft} min · ${item.time}. Prépare-toi à tout donner.`
}

export async function requestReminderPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export async function sendReminderNotification(title: string, body: string): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false

  const payload = buildNotificationPayload(body, `${title}-${body}`)

  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg?.showNotification) {
      await reg.showNotification(title, payload)
      return true
    }
  } catch {
    // fall through
  }

  try {
    new Notification(title, { body: payload.body, icon: payload.icon, tag: payload.tag })
    return true
  } catch {
    return false
  }
}

export async function sendTestNotification(): Promise<boolean> {
  const ok = await requestReminderPermission()
  if (!ok) return false
  return sendReminderNotification(REMINDER_TITLE, REMINDER_TEST_BODY)
}

/**
 * Fire reminders in a window: [time - remindBefore, time + 2 min].
 * Deduped per schedule id + date + slot.
 */
export async function checkUpcomingReminders(
  schedule: ScheduleItem[],
): Promise<{ id: string; title: string; time: string; minutesLeft: number } | null> {
  const now = new Date()
  const day = now.getDay()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const fired = readFired()
  let due: { id: string; title: string; time: string; minutesLeft: number } | null = null

  for (const item of schedule) {
    if (!item.enabled || !item.days.includes(day)) continue
    const [h, m] = item.time.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) continue
    const target = h * 60 + m
    const before = item.remindBeforeMin ?? 10
    const delta = target - minutesNow
    // Window: from N min before until 2 min after
    if (delta > before || delta < -2) continue

    const fireKey = `${item.id}:${dateKey}:${item.time}`
    if (fired[fireKey]) continue

    fired[fireKey] = Date.now()
    writeFired(fired)

    const minutesLeft = Math.max(0, delta)
    const notifTitle = minutesLeft === 0 ? REMINDER_TITLE_DUE : REMINDER_TITLE
    const body = buildSessionReminderBody(item, minutesLeft)

    await sendReminderNotification(notifTitle, body)
    due = { id: item.id, title: item.title, time: item.time, minutesLeft }
  }

  // prune old fired keys (> 3 days)
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
  let changed = false
  for (const [k, ts] of Object.entries(fired)) {
    if (ts < cutoff) {
      delete fired[k]
      changed = true
    }
  }
  if (changed) writeFired(fired)

  return due
}

/** Keep checking while Train tab / app is open. */
export function startReminderWatcher(
  getSchedule: () => ScheduleItem[],
  onDue?: (info: { title: string; time: string; minutesLeft: number }) => void,
): () => void {
  let stopped = false

  const tick = async () => {
    if (stopped) return
    const due = await checkUpcomingReminders(getSchedule())
    if (due && onDue) onDue(due)
  }

  void tick()
  const id = window.setInterval(() => {
    void tick()
  }, 30_000)

  const onVis = () => {
    if (document.visibilityState === 'visible') void tick()
  }
  document.addEventListener('visibilitychange', onVis)

  return () => {
    stopped = true
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVis)
  }
}
