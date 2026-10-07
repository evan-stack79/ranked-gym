import { safeWarn } from '../utils/safeLog'

export const AVIS_BETA_DRAFT_KEY = 'ranked-gym:avis-beta-draft'
export const AVIS_BETA_QUEUE_PREFIX = 'ranked-gym:avis-beta-queue:u:'

function listAvisQueueKeys(): string[] {
  if (typeof localStorage === 'undefined') return []
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(AVIS_BETA_QUEUE_PREFIX)) keys.push(key)
    }
  } catch {
    return []
  }
  return keys
}

/** True si au moins une file hors ligne contient encore des avis. */
export function hasPendingAvisBetaQueue(): boolean {
  if (typeof localStorage === 'undefined') return false
  for (const key of listAvisQueueKeys()) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

/**
 * AV-08 — purge brouillon + file hors ligne à la déconnexion / suppression de compte.
 * Le brouillon n’est pas lié à un compte : on l’efface toujours.
 * Toutes les files d’attente préfixées sont purgées (appareil partagé).
 */
export function clearAvisBetaLocalData(_opts?: { userId?: string | null }): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(AVIS_BETA_DRAFT_KEY)
  } catch (error) {
    safeWarn('[avis-beta] clear draft failed', error)
  }

  try {
    for (const key of listAvisQueueKeys()) {
      localStorage.removeItem(key)
    }
  } catch (error) {
    safeWarn('[avis-beta] clear queue scan failed', error)
  }
}
