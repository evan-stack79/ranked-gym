/**
 * Local wipe after a confirmed server account deletion.
 * Does not run on ordinary sign-out — AlarmKit logout stays in AuthContext.
 */

import { ACCUEIL_WIDGET_PREFS_KEY } from '../utils/accueilWidgetPrefs'
import { USER_WATER_GOAL_KEY, clearUserWaterGoal } from '../utils/userWaterGoal'
import { clearBottleShapeLocal } from './hydration/bottleShapeStorage'
import { CONTAINER_LEVEL_STORAGE_KEY } from './hydration/containerLevelStorage'
import { cancelHydrationReminders } from './hydration/hydrationReminders'
import { clearHydrationLocalState } from './hydration/hydrationService'
import { HV_STORAGE_BASE, clearHvState } from './horairesVariables/storage'
import { CRENEAU_STORAGE_BASE, clearCreneauSettings } from './creneau/storage'

/** Exact localStorage keys removed on account delete (hydration + bottle). */
export const ACCOUNT_DELETE_LOCAL_WIPE_KEYS = [
  'ranked-gym:hydration-pending-entries',
  'ranked-gym:hydration-active-user',
  'ranked-gym:hydration-settings-cache',
  'ranked-gym:hydration-settings-pending',
  'ranked-gym:hydration-deleted-entries',
  CONTAINER_LEVEL_STORAGE_KEY,
  USER_WATER_GOAL_KEY,
  'ranked-gym:my-bottle-shape-dataurl',
] as const

/**
 * Expected wipe list for account deletion (client).
 * - clearHvState() + `ranked-gym:horaires-variables*`
 * - clearCreneauSettings() + `ranked-gym:creneau*`
 * - hydration keys in ACCOUNT_DELETE_LOCAL_WIPE_KEYS
 * - accueil-widget-prefs: strip hydration-related `waterGoalMl` only
 * - clearBottleShapeLocal()
 * - cancelHydrationReminders() (ids 7101–7103)
 */
export const ACCOUNT_DELETE_LOCAL_WIPE_LIST = [
  'clearHvState',
  'clearCreneauSettings',
  ...ACCOUNT_DELETE_LOCAL_WIPE_KEYS,
  'ranked-gym:accueil-widget-prefs#waterGoalMl',
  'clearBottleShapeLocal',
  'cancelHydrationReminders',
] as const

function removeLocalKeysByPrefix(prefix: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (typeof localStorage.length !== 'number' || typeof localStorage.key !== 'function') {
      return
    }
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && (key === prefix || key.startsWith(`${prefix}:`))) keys.push(key)
    }
    for (const key of keys) {
      localStorage.removeItem(key)
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function stripAccueilHydrationPrefs(): void {
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(ACCUEIL_WIDGET_PREFS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { waterGoalMl?: unknown }
    if (!parsed || typeof parsed !== 'object' || !('waterGoalMl' in parsed)) return
    parsed.waterGoalMl = null
    localStorage.setItem(ACCUEIL_WIDGET_PREFS_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

export async function wipeDeletedAccountLocalData(): Promise<void> {
  clearHvState()
  removeLocalKeysByPrefix(HV_STORAGE_BASE)

  clearCreneauSettings()
  removeLocalKeysByPrefix(CRENEAU_STORAGE_BASE)

  clearHydrationLocalState()
  clearUserWaterGoal()
  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of ACCOUNT_DELETE_LOCAL_WIPE_KEYS) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* ignore */
  }
  stripAccueilHydrationPrefs()

  try {
    await clearBottleShapeLocal()
  } catch {
    /* ignore */
  }
  try {
    await cancelHydrationReminders()
  } catch {
    /* ignore */
  }
}
