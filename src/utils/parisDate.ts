/**
 * Dates « téléphone » pour Train — calendrier Europe/Paris.
 * Une séance offline comptée le bon jour même si sync plus tard.
 */

const PARIS_TZ = 'Europe/Paris'

/** YYYY-MM-DD dans le fuseau Europe/Paris. */
export function parisDateKey(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date
  // en-CA → YYYY-MM-DD stable
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Parts numériques (année, mois 1–12, jour) en Europe/Paris. */
export function parisYmd(date: Date | number = new Date()): {
  year: number
  month: number
  day: number
} {
  const key = parisDateKey(date)
  const [y, m, d] = key.split('-').map(Number)
  return { year: y, month: m, day: d }
}

/** Ajoute `deltaDays` à une dateKey YYYY-MM-DD (calendrier civil, sans TZ). */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d + deltaDays)
  const dt = new Date(utc)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Deux dateKeys consécutives (j, j+1). */
export function areConsecutiveDateKeys(a: string, b: string): boolean {
  if (!a || !b) return false
  const [earlier, later] = a <= b ? [a, b] : [b, a]
  return shiftDateKey(earlier, 1) === later
}

/**
 * Lundi → dimanche de la semaine civile contenant `date`, en Europe/Paris.
 * Renvoie les dateKeys bornes (inclusives).
 */
export function parisWeekDateKeys(now: Date | number = new Date()): {
  mondayKey: string
  sundayKey: string
  keys: string[]
} {
  const today = parisDateKey(now)
  const [y, m, d] = today.split('-').map(Number)
  // Jour de semaine à midi UTC du calendrier Paris (évite DST edges)
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  // Quel jour de semaine est « aujourd’hui » à Paris ?
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TZ,
    weekday: 'short',
  }).format(noonUtc)
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  const fromMonday = map[weekdayName] ?? 0
  const mondayKey = shiftDateKey(today, -fromMonday)
  const keys: string[] = []
  for (let i = 0; i < 7; i += 1) keys.push(shiftDateKey(mondayKey, i))
  return { mondayKey, sundayKey: keys[6]!, keys }
}

/** Clé de semaine = dateKey du lundi Paris (stable pour dismiss / once-per-week). */
export function parisWeekKey(now: Date | number = new Date()): string {
  return parisWeekDateKeys(now).mondayKey
}

export function isDateKeyInParisWeek(
  dateKey: string,
  now: Date | number = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false
  const { mondayKey, sundayKey } = parisWeekDateKeys(now)
  return dateKey >= mondayKey && dateKey <= sundayKey
}
