import type { ProfileRow } from '../types/database'
import { getActiveCloudUserId } from './cloudSession'

const KEY_BASE = 'ranked-gym:ghost-mode'

function scopedKey(): string {
  const uid = getActiveCloudUserId()
  return uid ? `${KEY_BASE}:u:${uid}` : KEY_BASE
}

export function getLocalGhostModeEnabled(): boolean {
  try {
    return localStorage.getItem(scopedKey()) === '1'
  } catch {
    return false
  }
}

export function setLocalGhostModeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(scopedKey(), enabled ? '1' : '0')
  } catch {
    // private mode / quota
  }
}

/** Lit le flag depuis Supabase ou le cache local (fallback si colonne absente). */
export function resolveGhostModeEnabled(profile: ProfileRow | null | undefined): boolean {
  if (profile && typeof profile.is_ghost_mode_enabled === 'boolean') {
    return profile.is_ghost_mode_enabled
  }
  return getLocalGhostModeEnabled()
}
