/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCUEIL_WIDGET_PREFS_KEY } from '../utils/accueilWidgetPrefs'
import { USER_WATER_GOAL_KEY } from '../utils/userWaterGoal'
import { HV_STORAGE_BASE } from './horairesVariables/storage'
import { CRENEAU_STORAGE_BASE } from './creneau/storage'
import { CONTAINER_LEVEL_STORAGE_KEY } from './hydration/containerLevelStorage'

const cancelHydrationReminders = vi.fn(async () => undefined)
const clearBottleShapeLocal = vi.fn(async () => undefined)

vi.mock('./hydration/hydrationReminders', () => ({
  cancelHydrationReminders: () => cancelHydrationReminders(),
}))

vi.mock('./hydration/bottleShapeStorage', () => ({
  clearBottleShapeLocal: () => clearBottleShapeLocal(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => 'user-wipe'),
}))

describe('wipeDeletedAccountLocalData', () => {
  beforeEach(async () => {
    localStorage.clear()
    cancelHydrationReminders.mockClear()
    clearBottleShapeLocal.mockClear()
    const { saveHvState, getHvState } = await import('./horairesVariables/storage')
    saveHvState({
      settings: { ...getHvState().settings, enabled: true },
    })
    localStorage.setItem('ranked-gym:hydration-pending-entries', '[{"userId":"user-wipe"}]')
    localStorage.setItem('ranked-gym:hydration-active-user', 'user-wipe')
    localStorage.setItem('ranked-gym:hydration-settings-cache', '{}')
    localStorage.setItem('ranked-gym:hydration-settings-pending', '{}')
    localStorage.setItem('ranked-gym:hydration-deleted-entries', '[]')
    localStorage.setItem(CONTAINER_LEVEL_STORAGE_KEY, '{"user-wipe":{"gourd":200}}')
    localStorage.setItem(
      USER_WATER_GOAL_KEY,
      JSON.stringify({ version: 1, goalMl: 2000, source: 'user', updatedAt: Date.now() }),
    )
    localStorage.setItem(
      ACCUEIL_WIDGET_PREFS_KEY,
      JSON.stringify({
        version: 2,
        order: ['seance', 'eau'],
        hidden: [],
        updatedAt: Date.now(),
        waterGoalMl: 2000,
      }),
    )
    localStorage.setItem('ranked-gym:my-bottle-shape-dataurl', 'data:image/png;base64,xx')
    localStorage.setItem(`${HV_STORAGE_BASE}:u:other`, '{"keep":false}')
    const { saveCreneauSettings, getCreneauSettings } = await import('./creneau/storage')
    saveCreneauSettings({ heatVigilanceToday: true, eveningWalkEnabled: true })
    expect(getCreneauSettings().heatVigilanceToday).toBe(true)
    localStorage.setItem(`${CRENEAU_STORAGE_BASE}:u:other`, '{"keep":false}')
  })

  it('calls clearHvState, bottle, reminders and clears the documented hydration keys', async () => {
    const { getHvState } = await import('./horairesVariables/storage')
    expect(getHvState().settings.enabled).toBe(true)

    const {
      ACCOUNT_DELETE_LOCAL_WIPE_KEYS,
      ACCOUNT_DELETE_LOCAL_WIPE_LIST,
      wipeDeletedAccountLocalData,
    } = await import('./wipeDeletedAccountLocalData')

    expect(ACCOUNT_DELETE_LOCAL_WIPE_LIST).toEqual(
      expect.arrayContaining([
        'clearHvState',
        'clearCreneauSettings',
        'ranked-gym:hydration-pending-entries',
        'ranked-gym:hydration-active-user',
        'ranked-gym:hydration-settings-cache',
        'ranked-gym:hydration-settings-pending',
        'ranked-gym:hydration-deleted-entries',
        CONTAINER_LEVEL_STORAGE_KEY,
        USER_WATER_GOAL_KEY,
        'ranked-gym:accueil-widget-prefs#waterGoalMl',
        'clearBottleShapeLocal',
        'cancelHydrationReminders',
      ]),
    )

    await wipeDeletedAccountLocalData()

    for (const key of ACCOUNT_DELETE_LOCAL_WIPE_KEYS) {
      expect(localStorage.getItem(key), key).toBeNull()
    }
    expect(getHvState().settings.enabled).toBe(false)
    expect(localStorage.getItem(`${HV_STORAGE_BASE}:u:user-wipe`)).toBeNull()
    expect(localStorage.getItem(`${HV_STORAGE_BASE}:u:other`)).toBeNull()
    const { getCreneauSettings } = await import('./creneau/storage')
    expect(getCreneauSettings().heatVigilanceToday).toBe(false)
    expect(localStorage.getItem(`${CRENEAU_STORAGE_BASE}:u:user-wipe`)).toBeNull()
    expect(localStorage.getItem(`${CRENEAU_STORAGE_BASE}:u:other`)).toBeNull()

    const prefs = JSON.parse(localStorage.getItem(ACCUEIL_WIDGET_PREFS_KEY) ?? '{}') as {
      waterGoalMl?: unknown
      order?: string[]
    }
    expect(prefs.waterGoalMl).toBeNull()
    expect(prefs.order).toContain('seance')

    expect(clearBottleShapeLocal).toHaveBeenCalledTimes(1)
    expect(cancelHydrationReminders).toHaveBeenCalledTimes(1)
  })
})
