/**
 * M1 — migration locale du journal eau nutrition → hydration* (idempotente).
 *
 * Justification M1-b (option retenue) :
 * importer via mutation dédiée `importLegacyLocalEntries` avec fenêtre 7 j
 * (cohérente historique boucle 2), plutôt que addEntry ±1 jour.
 * En cas de rejet : pas de flag « réussi », journal local conservé.
 */
import {
  ENTRY_MAX_ML,
  ENTRY_MIN_ML,
  lastNDayKeys,
  legacyWaterDayClientId,
  legacyWaterEntryClientId,
  localDayKey,
} from '../../shared/hydration'
import { api as generatedApi } from '../../../convex/_generated/api'
import { getConvex } from '../../lib/convex'
import { getConvexSessionToken } from '../convexAuthService'
import { getWaterEntriesForDate, getWaterMlForDate } from '../nutritionStorage'

const api = generatedApi as any

export type LegacyMigrateResult = {
  attempted: number
  ok: number
  rejected: number
  skipped: boolean
  /** true seulement si aucune entrée rejetée (migration complète). */
  complete: boolean
}

const localMigrateFlagKey = (userId: string) =>
  `ranked-gym:hydration-legacy-local-migrated:${userId}`

export function clearLocalLegacyMigrateFlag(userId: string | null): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(localMigrateFlagKey(userId))
  } catch {
    /* ignore */
  }
}

function hasSuccessFlag(userId: string): boolean {
  try {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(localMigrateFlagKey(userId)) === '1'
  } catch {
    return false
  }
}

function setSuccessFlag(userId: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(localMigrateFlagKey(userId), '1')
    }
  } catch {
    /* ignore */
  }
}

type LocalLegacyPayload = {
  clientId: string
  dayKey: string
  amountMl: number
  createdAt?: number
}

export function collectLocalLegacyEntries(endDayKey = localDayKey()): LocalLegacyPayload[] {
  const keys = lastNDayKeys(endDayKey, 7)
  const out: LocalLegacyPayload[] = []
  for (const dayKey of keys) {
    const entries = getWaterEntriesForDate(dayKey)
    if (entries.length > 0) {
      for (const entry of entries) {
        const amountMl = Math.max(0, Math.round(entry.amountMl))
        if (amountMl < ENTRY_MIN_ML || amountMl > ENTRY_MAX_ML) continue
        out.push({
          clientId: legacyWaterEntryClientId(entry.id),
          dayKey,
          amountMl,
          createdAt: entry.createdAt,
        })
      }
      continue
    }
    const dayTotal = Math.max(0, Math.round(getWaterMlForDate(dayKey)))
    if (dayTotal < ENTRY_MIN_ML || dayTotal > ENTRY_MAX_ML) continue
    out.push({
      clientId: legacyWaterDayClientId(dayKey),
      dayKey,
      amountMl: dayTotal,
    })
  }
  return out
}

/**
 * Pousse le journal local (7 j) via importLegacyLocalEntries (fenêtre migration).
 * Ne pose le flag « terminé » que si ok serveur (rejected === 0).
 */
export async function migrateLocalLegacyWaterToHydration(
  userId: string,
  endDayKey = localDayKey(),
): Promise<LegacyMigrateResult> {
  if (hasSuccessFlag(userId)) {
    return { attempted: 0, ok: 0, rejected: 0, skipped: true, complete: true }
  }

  const entries = collectLocalLegacyEntries(endDayKey)
  if (entries.length === 0) {
    setSuccessFlag(userId)
    return { attempted: 0, ok: 0, rejected: 0, skipped: false, complete: true }
  }

  const sessionToken = await getConvexSessionToken()
  if (!sessionToken) {
    // Pas de faux succès : local intact, flag non posé.
    return {
      attempted: entries.length,
      ok: 0,
      rejected: entries.length,
      skipped: false,
      complete: false,
    }
  }

  try {
    const result = (await getConvex().mutation(api.hydration.importLegacyLocalEntries, {
      sessionToken,
      endDayKey,
      entries,
    })) as {
      inserted: number
      skipped: number
      rejected: Array<{ clientId: string; dayKey: string; reason: string }>
      ok: boolean
    }

    const rejected = result.rejected?.length ?? 0
    const okCount = (result.inserted ?? 0) + (result.skipped ?? 0)
    if (result.ok && rejected === 0) {
      setSuccessFlag(userId)
    }
    return {
      attempted: entries.length,
      ok: okCount,
      rejected,
      skipped: false,
      complete: Boolean(result.ok) && rejected === 0,
    }
  } catch {
    // Échec réseau : ne pas annoncer succès, ne pas poser le flag, local conservé.
    return {
      attempted: entries.length,
      ok: 0,
      rejected: entries.length,
      skipped: false,
      complete: false,
    }
  }
}
