/** Affichage heures sommeil — français, sans jargon. */

export interface DurationParts {
  hours: number
  minutes: number
}

/** Parties heures/minutes pour typo « 8 » + « h » + « 29 » + « min ». */
export function durationPartsFromHours(hours: number): DurationParts {
  const totalMinutes = Math.round(hours * 60)
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  }
}

/** « 7 h 30 » / « 8 h » — minutes arrondies. */
export function formatDurationHoursLabel(hours: number): string {
  const { hours: h, minutes: m } = durationPartsFromHours(hours)
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** « Jeudi 12 novembre » — date du jour pour la page Sommeil. */
export function formatFrenchLongDate(now = new Date()): string {
  const raw = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
  // Capitalize weekday (fr-FR often returns lowercase).
  return raw.replace(/^\p{L}/u, (c) => c.toUpperCase())
}

/** Affiche HH:MM → « 6:30 » (sans zéro inutile sur l’heure). */
export function formatClockHm(hm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return hm
  const h = Number(m[1])
  const min = m[2]
  if (!Number.isFinite(h) || h < 0 || h > 23) return hm
  return `${h}:${min}`
}

export function formatNightRangeLabel(bedtime: string, waketime: string): string {
  return `${formatClockHm(bedtime)} → ${formatClockHm(waketime)}`
}

export function todayDateKey(now = new Date()): string {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return todayDateKey(dt)
}

/** Abréviation jour FR (lun. … dim.) ; « auj. » si dateKey = aujourd’hui. */
export function frenchDayShortLabel(dateKey: string, today = todayDateKey()): string {
  if (dateKey === today) return 'auj.'
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).getDay() // 0=dim
  const labels = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
  return labels[weekday] ?? ''
}

/** Lettre jour FR (L M M J V S D) — axe 7 barres v10. */
export function frenchDayLetter(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).getDay() // 0=dim
  const letters = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  return letters[weekday] ?? ''
}

export function dateToHm(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function hmToMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function minutesToHm(total: number): string {
  const t = ((Math.round(total) % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Snap minutes to step (défaut 5). */
export function snapMinutes(total: number, step = 5): number {
  const s = Math.max(1, step)
  return Math.round(total / s) * s
}
