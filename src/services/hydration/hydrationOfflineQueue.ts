/**
 * File locale des ajouts hydratation non confirmés (hors-ligne).
 * dayKey figé à l’ajout — bon jour même sans réseau.
 * M5 — cloisonnée par userId ; jamais rejouée sur un autre compte.
 */

export type PendingHydrationEntry = {
  userId: string
  clientId: string
  dayKey: string
  amountMl: number
  source: 'glass' | 'half_bottle' | 'full_bottle' | 'slider'
  createdAt: number
}

const KEY = 'ranked-gym:hydration-pending-entries'
const ACTIVE_USER_KEY = 'ranked-gym:hydration-active-user'

function readAllRaw(): PendingHydrationEntry[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((row): row is PendingHydrationEntry => {
      if (row == null || typeof row !== 'object') return false
      const r = row as Partial<PendingHydrationEntry>
      return (
        typeof r.userId === 'string'
        && typeof r.clientId === 'string'
        && typeof r.dayKey === 'string'
        && typeof r.amountMl === 'number'
      )
    })
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

export function getHydrationQueueUserId(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(ACTIVE_USER_KEY)
  } catch {
    return null
  }
}

/** Bind / switch compte — purge si userId change (M5). */
export function bindHydrationQueueUser(userId: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    const prev = localStorage.getItem(ACTIVE_USER_KEY)
    if (userId == null) {
      writeAll([])
      localStorage.removeItem(ACTIVE_USER_KEY)
      return
    }
    if (prev != null && prev !== userId) {
      writeAll([])
    }
    localStorage.setItem(ACTIVE_USER_KEY, userId)
  } catch {
    /* ignore */
  }
}

export function clearHydrationOfflineQueue(): void {
  writeAll([])
}

export function listPendingHydrationEntries(userId?: string | null): PendingHydrationEntry[] {
  const uid = userId ?? getHydrationQueueUserId()
  if (!uid) return []
  return readAllRaw().filter((r) => r.userId === uid)
}

export function enqueuePendingHydrationEntry(entry: PendingHydrationEntry): void {
  if (!entry.userId) return
  bindHydrationQueueUser(entry.userId)
  const rows = readAllRaw().filter(
    (r) => !(r.userId === entry.userId && r.clientId === entry.clientId),
  )
  rows.push(entry)
  writeAll(rows)
}

export function removePendingHydrationEntry(clientId: string, userId?: string | null): void {
  const uid = userId ?? getHydrationQueueUserId()
  if (!uid) return
  writeAll(readAllRaw().filter((r) => !(r.userId === uid && r.clientId === clientId)))
}

export function pendingDrunkMlForDay(dayKey: string, userId?: string | null): number {
  return listPendingHydrationEntries(userId)
    .filter((r) => r.dayKey === dayKey)
    .reduce((sum, r) => sum + Math.max(0, Math.round(r.amountMl)), 0)
}

export const HYDRATION_CHANGED_EVENT = 'ranked-gym:hydration-changed'

export function emitHydrationChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HYDRATION_CHANGED_EVENT))
  }
}
