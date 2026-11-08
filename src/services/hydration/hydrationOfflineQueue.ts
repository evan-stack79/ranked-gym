/**
 * File locale des ajouts hydratation non confirmés (hors-ligne).
 * dayKey figé à l’ajout — bon jour même sans réseau.
 */

export type PendingHydrationEntry = {
  clientId: string
  dayKey: string
  amountMl: number
  source: 'glass' | 'half_bottle' | 'full_bottle' | 'slider'
  createdAt: number
}

const KEY = 'ranked-gym:hydration-pending-entries'

function readAll(): PendingHydrationEntry[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is PendingHydrationEntry =>
        row != null
        && typeof row === 'object'
        && typeof (row as PendingHydrationEntry).clientId === 'string'
        && typeof (row as PendingHydrationEntry).dayKey === 'string'
        && typeof (row as PendingHydrationEntry).amountMl === 'number',
    )
  } catch {
    return []
  }
}

function writeAll(rows: PendingHydrationEntry[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}

export function listPendingHydrationEntries(): PendingHydrationEntry[] {
  return readAll()
}

export function enqueuePendingHydrationEntry(entry: PendingHydrationEntry): void {
  const rows = readAll().filter((r) => r.clientId !== entry.clientId)
  rows.push(entry)
  writeAll(rows)
}

export function removePendingHydrationEntry(clientId: string): void {
  writeAll(readAll().filter((r) => r.clientId !== clientId))
}

export function pendingDrunkMlForDay(dayKey: string): number {
  return readAll()
    .filter((r) => r.dayKey === dayKey)
    .reduce((sum, r) => sum + Math.max(0, Math.round(r.amountMl)), 0)
}

export const HYDRATION_CHANGED_EVENT = 'ranked-gym:hydration-changed'

export function emitHydrationChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HYDRATION_CHANGED_EVENT))
  }
}
