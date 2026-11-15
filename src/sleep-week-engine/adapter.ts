import type { SleepEngineNight } from './engine.ts'

const DAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const

export type SleepEntryLike = {
  dateKey: string
  bedtime: string
  waketime: string
  feelingLevel?: number | null
}

/** Parse YYYY-MM-DD as local calendar date. */
function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

function formatDateKey(dt: Date): string {
  const y = dt.getFullYear()
  const mo = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

function shiftDateKey(dateKey: string, deltaDays: number): string | null {
  const dt = parseDateKey(dateKey)
  if (!dt) return null
  dt.setDate(dt.getDate() + deltaDays)
  return formatDateKey(dt)
}

/** Index 0=lun … 6=dim for a calendar date. */
function dayIndexFromDateKey(dateKey: string): number | null {
  const dt = parseDateKey(dateKey)
  if (!dt) return null
  // JS: 0=dim → FR week index Mon=0
  return (dt.getDay() + 6) % 7
}

function mondayOnOrBefore(dateKey: string): string | null {
  const idx = dayIndexFromDateKey(dateKey)
  if (idx == null) return null
  return shiftDateKey(dateKey, -idx)
}

/**
 * Convertit les entrées app (dateKey = matin du lever) en nuits moteur
 * (day = soir du jour : lun…dim). FREE = ven/sam = nuits du vendredi et samedi.
 *
 * weekStartDateKey = lundi calendaire de la semaine de nuits (soir du lun → soir du dim).
 * Si absent : lundi de la nuit la plus récente.
 */
export function nightsFromSleepEntries(
  entries: SleepEntryLike[],
  weekStartDateKey?: string,
): SleepEngineNight[] {
  type Row = { nightDateKey: string; night: SleepEngineNight }
  const rows: Row[] = []

  for (const entry of entries) {
    // dateKey app = lever → nuit = veille
    const nightDateKey = shiftDateKey(entry.dateKey, -1)
    if (!nightDateKey) continue
    const dayIdx = dayIndexFromDateKey(nightDateKey)
    if (dayIdx == null) continue
    const R =
      typeof entry.feelingLevel === 'number' && Number.isFinite(entry.feelingLevel)
        ? entry.feelingLevel
        : 3
    rows.push({
      nightDateKey,
      night: {
        day: DAYS[dayIdx]!,
        bed: entry.bedtime,
        wake: entry.waketime,
        R,
      },
    })
  }

  if (rows.length === 0) return []

  let weekStart = weekStartDateKey
  if (!weekStart || dayIndexFromDateKey(weekStart) !== 0) {
    const latest = rows.map((r) => r.nightDateKey).sort().at(-1)!
    weekStart = mondayOnOrBefore(latest) ?? latest
  }

  const weekEnd = shiftDateKey(weekStart, 6)
  if (!weekEnd) return []

  const byDay = new Map<string, SleepEngineNight>()
  for (const row of rows) {
    if (row.nightDateKey < weekStart || row.nightDateKey > weekEnd) continue
    // Dernière entrée gagne si doublon sur le même soir.
    byDay.set(row.night.day, row.night)
  }

  return DAYS.map((day) => byDay.get(day)).filter((n): n is SleepEngineNight => n != null)
}
