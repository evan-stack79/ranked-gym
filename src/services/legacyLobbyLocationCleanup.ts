/**
 * One-shot removal of legacy Lobby gym location blobs from device storage.
 * Keys may be bare or scoped as `${base}:u:${userId}`.
 */
import { removeLocal } from './secureLocalStore'

export const LEGACY_LOBBY_LOCATION_KEY_BASES = [
  'ranked-gym:check-in',
  'ranked-gym:custom-gyms',
  'ranked-gym:last-location',
] as const

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined'
}

function listLocalKeys(): string[] {
  if (!storageAvailable()) return []
  const keys: string[] = []
  try {
    if (typeof localStorage.length !== 'number' || typeof localStorage.key !== 'function') {
      return keys
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
  } catch {
    return keys
  }
  return keys
}

export function isLegacyLobbyLocationKey(key: string): boolean {
  return LEGACY_LOBBY_LOCATION_KEY_BASES.some(
    (base) => key === base || key.startsWith(`${base}:`),
  )
}

/** Remove all legacy Lobby location keys (bare + per-user variants). */
export function purgeLegacyLobbyLocationKeys(): { removed: string[] } {
  const removed: string[] = []
  for (const key of listLocalKeys()) {
    if (!isLegacyLobbyLocationKey(key)) continue
    removeLocal(key)
    removed.push(key)
  }
  return { removed }
}
