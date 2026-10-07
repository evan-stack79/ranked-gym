import { getActiveCloudUserId } from './cloudSession'
import { safeWarn } from '../utils/safeLog'
import { submitAvisBeta, type AvisType } from './convexAvisBetaService'
import { AVIS_BETA_QUEUE_PREFIX } from './clearAvisBetaLocalData'

/** 7 jours max hors ligne (VP). */
export const AVIS_OFFLINE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type PendingAvis = {
  id: string
  type: AvisType
  texte: string
  page: string
  version: string
  cleAntiDoublon: string
  consentementAccepte: true
  forcerEnvoiAvecInsultes?: boolean
  enqueuedAt: number
}

let flushInFlight: Promise<void> | null = null
let lifecycleWired = false

function queueKey(userId: string): string {
  return `${AVIS_BETA_QUEUE_PREFIX}${userId}`
}

function readQueue(userId: string): PendingAvis[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(queueKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as PendingAvis[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeQueue(userId: string, entries: PendingAvis[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(queueKey(userId), JSON.stringify(entries))
  } catch (error) {
    safeWarn('[avis-beta] queue write failed', error)
  }
}

function pruneExpired(entries: PendingAvis[], now = Date.now()): PendingAvis[] {
  return entries.filter((entry) => now - entry.enqueuedAt <= AVIS_OFFLINE_TTL_MS)
}

export function enqueueAvisOffline(
  payload: Omit<PendingAvis, 'id' | 'enqueuedAt' | 'consentementAccepte'> & {
    consentementAccepte: true
  },
): PendingAvis {
  const userId = getActiveCloudUserId()
  if (!userId) {
    throw new Error('AVIS_OFFLINE_NO_USER')
  }
  const entry: PendingAvis = {
    ...payload,
    id: `avis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    enqueuedAt: Date.now(),
    consentementAccepte: true,
  }
  const next = pruneExpired([...readQueue(userId), entry])
  writeQueue(userId, next)
  wireAvisQueueLifecycleOnce()
  return entry
}

export async function flushAvisBetaQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight
  flushInFlight = (async () => {
    const userId = getActiveCloudUserId()
    if (!userId) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return

    let entries = pruneExpired(readQueue(userId))
    writeQueue(userId, entries)

    for (const entry of [...entries]) {
      try {
        const result = await submitAvisBeta({
          type: entry.type,
          texte: entry.texte,
          page: entry.page,
          version: entry.version,
          cleAntiDoublon: entry.cleAntiDoublon,
          consentementAccepte: true,
          forcerEnvoiAvecInsultes: entry.forcerEnvoiAvecInsultes ?? true,
        })
        // AV-07 : ne pas jeter silencieusement à la limite — garder jusqu’au lendemain / TTL.
        if (result.ok) {
          entries = entries.filter((item) => item.id !== entry.id)
          writeQueue(userId, entries)
        } else if (result.error === 'AVIS_BETA_DAILY_LIMIT') {
          break
        } else if (result.error === 'AVIS_BETA_AGE_REQUIRED') {
          entries = entries.filter((item) => item.id !== entry.id)
          writeQueue(userId, entries)
        }
      } catch (error) {
        safeWarn('[avis-beta] flush failed', error)
        break
      }
    }
  })().finally(() => {
    flushInFlight = null
  })
  return flushInFlight
}

export function wireAvisQueueLifecycleOnce(): void {
  if (lifecycleWired || typeof window === 'undefined') return
  lifecycleWired = true
  const trigger = () => {
    void flushAvisBetaQueue()
  }
  window.addEventListener('online', trigger)
  window.addEventListener('focus', trigger)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') trigger()
  })
}
