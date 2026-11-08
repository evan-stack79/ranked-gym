/**
 * M1 — migration locale du journal eau nutrition → hydration* (idempotente).
 * clientId = legacy:${entryId} (aligné serveur) pour éviter tout double compte.
 */
import {
  ENTRY_MAX_ML,
  ENTRY_MIN_ML,
  lastNDayKeys,
  legacyWaterDayClientId,
  legacyWaterEntryClientId,
  localDayKey,
} from '../../shared/hydration'
import { getWaterEntriesForDate, getWaterMlForDate } from '../nutritionStorage'
import { addHydrationEntry } from './hydrationService'

export type LegacyMigrateResult = {
  attempted: number
  ok: number
  skipped: boolean
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

/**
 * Pousse le journal local (7 j) vers hydration via addEntry (dédup clientId serveur).
 * Une seule passe par compte (flag local) ; rejouable serveur sans doublon.
 */
export async function migrateLocalLegacyWaterToHydration(
  userId: string,
  endDayKey = localDayKey(),
): Promise<LegacyMigrateResult> {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(localMigrateFlagKey(userId))) {
      return { attempted: 0, ok: 0, skipped: true }
    }
    // Pose le flag avant les ajouts pour éviter une boucle fetch→migrate→emit→fetch.
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(localMigrateFlagKey(userId), '1')
    }
  } catch {
    /* continue */
  }

  const keys = lastNDayKeys(endDayKey, 7)
  let attempted = 0
  let ok = 0
  for (const dayKey of keys) {
    const entries = getWaterEntriesForDate(dayKey)
    if (entries.length > 0) {
      for (const entry of entries) {
        const amountMl = Math.max(0, Math.round(entry.amountMl))
        if (amountMl < ENTRY_MIN_ML || amountMl > ENTRY_MAX_ML) continue
        attempted += 1
        try {
          await addHydrationEntry({
            userId,
            dayKey,
            amountMl,
            source: 'slider',
            clientId: legacyWaterEntryClientId(entry.id),
          })
          ok += 1
        } catch {
          /* réseau / session — file offline ou ignore */
        }
      }
      continue
    }
    const dayTotal = Math.max(0, Math.round(getWaterMlForDate(dayKey)))
    if (dayTotal < ENTRY_MIN_ML || dayTotal > ENTRY_MAX_ML) continue
    attempted += 1
    try {
      await addHydrationEntry({
        userId,
        dayKey,
        amountMl: dayTotal,
        source: 'slider',
        clientId: legacyWaterDayClientId(dayKey),
      })
      ok += 1
    } catch {
      /* ignore */
    }
  }

  return { attempted, ok, skipped: false }
}
