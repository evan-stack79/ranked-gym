/** @vitest-environment jsdom */
/**
 * QA boucle 1 — un test par point B1 / M1…M7.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  bindHydrationQueueUser,
  clearHydrationOfflineQueue,
  enqueuePendingHydrationEntry,
  listPendingHydrationEntries,
  pendingDrunkMlForDay,
} from '../services/hydration/hydrationOfflineQueue'
import {
  FACE_UNAVAILABLE_MESSAGE,
  isFaceDetectorAvailable,
  refuseIfFaceDetected,
} from '../services/hydration/faceRefuse'
import { nextReminderAt } from '../services/hydration/hydrationReminders'
import { GOAL_DEFAULT_ML } from '../../shared/hydration/constants'
import { isDayKeyWithinTolerance, isValidDayKey } from '../../shared/hydration/math'
import { isMinorOrUnknownAge } from '../services/nutritionSafetyRules'

describe('QA B1 — setProForTests internal only', () => {
  it('n’est plus une mutation publique api.*', () => {
    const src = readFileSync(resolve('convex/hydration.ts'), 'utf8')
    expect(src).toMatch(/export const setProForTests = internalMutation/)
    expect(src).not.toMatch(/export const setProForTests = mutation/)
    expect(src).toMatch(/internalMutation/)
  })
})

describe('QA M1 — un seul compteur visible', () => {
  it('Accueil/Alimentation n’affichent plus le journal legacy', () => {
    const gallery = readFileSync(resolve('src/components/home/HomeGalleryView.tsx'), 'utf8')
    expect(gallery).toMatch(/id !== 'eau'/)
    expect(gallery).not.toMatch(/getTodayWaterMl/)
    expect(gallery).toMatch(/WaterCard/)
    const snap = readFileSync(resolve('src/components/home/NutritionSnapshot.tsx'), 'utf8')
    expect(snap).not.toMatch(/getTodayWaterMl/)
    expect(snap).not.toMatch(/tryAddHomeQuickWater/)
    const dash = readFileSync(resolve('src/components/nutrition/NutritionDashboard.tsx'), 'utf8')
    expect(dash).not.toMatch(/SmartWaterGauge/)
    expect(dash).toMatch(/WaterCard/)
  })
})

describe('QA M2 — pause jour sans casser récurrence', () => {
  it('nextReminderAt skipToday force demain', () => {
    const now = new Date('2026-11-08T15:00:00')
    const at = nextReminderAt(10, 0, now, true)
    expect(at.getDate()).toBe(9)
    expect(at.getHours()).toBe(10)
    const sameDayLater = nextReminderAt(18, 0, now, false)
    expect(sameDayLater.getDate()).toBe(8)
    expect(sameDayLater.getHours()).toBe(18)
  })
})

describe('QA M3 — photo indisponible sans FaceDetector', () => {
  it('unavailable → message + pas de chemin sauvegarde sans contrôle', async () => {
    delete (window as unknown as { FaceDetector?: unknown }).FaceDetector
    expect(isFaceDetectorAvailable()).toBe(false)
    const canvas = document.createElement('canvas')
    const result = await refuseIfFaceDetected(canvas)
    expect(result.status).toBe('unavailable')
    expect(FACE_UNAVAILABLE_MESSAGE).toContain('2 L')
    const capture = readFileSync(resolve('src/components/hydration/BottleCaptureFlow.tsx'), 'utf8')
    expect(capture).toMatch(/FACE_UNAVAILABLE_MESSAGE/)
    expect(capture).toMatch(/faceCleared/)
  })
})

describe('QA M4 — offline = confirmed + pending', () => {
  beforeEach(() => {
    clearHydrationOfflineQueue()
    bindHydrationQueueUser('user-a')
    localStorage.clear()
    bindHydrationQueueUser('user-a')
  })
  afterEach(() => {
    clearHydrationOfflineQueue()
    localStorage.clear()
  })

  it('pendingDrunkMlForDay s’additionne au confirmed cache', async () => {
    vi.resetModules()
    vi.doMock('../services/convexAuthService', () => ({
      getConvexSessionToken: async () => null,
    }))
    const { fetchHydrationToday } = await import('../services/hydration/hydrationService')
    localStorage.setItem(
      'ranked-gym:hydration-settings-cache',
      JSON.stringify({
        userId: 'user-a',
        mode: 'classic_2l',
        goalMl: 1500,
        myBottleVolumeMl: null,
        myBottleHasShape: false,
        remindersEnabled: false,
        reminderTimes: ['10:00', '14:00', '18:00'],
        proActive: false,
        confirmedByDay: { '2026-11-08': 1000 },
      }),
    )
    bindHydrationQueueUser('user-a')
    enqueuePendingHydrationEntry({
      userId: 'user-a',
      clientId: 'c1',
      dayKey: '2026-11-08',
      amountMl: 250,
      source: 'glass',
      createdAt: Date.now(),
    })
    expect(pendingDrunkMlForDay('2026-11-08', 'user-a')).toBe(250)
    const today = await fetchHydrationToday('2026-11-08')
    expect(today.confirmedMl).toBe(1000)
    expect(today.pendingMl).toBe(250)
    expect(today.drunkMl).toBe(1250)
    vi.doUnmock('../services/convexAuthService')
  })
})

describe('QA M5 — file liée au compte', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('switch A→B purge / isole la file', () => {
    bindHydrationQueueUser('user-a')
    enqueuePendingHydrationEntry({
      userId: 'user-a',
      clientId: 'a1',
      dayKey: '2026-11-08',
      amountMl: 250,
      source: 'glass',
      createdAt: 1,
    })
    expect(listPendingHydrationEntries('user-a')).toHaveLength(1)
    bindHydrationQueueUser('user-b')
    expect(listPendingHydrationEntries('user-a')).toHaveLength(0)
    expect(listPendingHydrationEntries('user-b')).toHaveLength(0)
  })
})

describe('QA M6 — entrée trop vieille écartée', () => {
  it('dayKey hors tolérance détecté', () => {
    const now = Date.parse('2026-11-08T12:00:00.000Z')
    expect(isValidDayKey('2026-11-01')).toBe(true)
    expect(isDayKeyWithinTolerance('2026-11-01', now)).toBe(false)
    const flushSrc = readFileSync(resolve('src/services/hydration/hydrationService.ts'), 'utf8')
    expect(flushSrc).toMatch(/isDayKeyWithinTolerance/)
    expect(flushSrc).toMatch(/isPermanentReject/)
    expect(flushSrc).toMatch(/continue/)
  })
})

describe('QA M7 — mineurs : objectif non réglable, défaut existant', () => {
  it('isMinorOrUnknownAge + défaut GOAL_DEFAULT_ML, pas d’invention', () => {
    expect(isMinorOrUnknownAge(17)).toBe(true)
    expect(isMinorOrUnknownAge(null)).toBe(true)
    expect(isMinorOrUnknownAge(18)).toBe(false)
    expect(GOAL_DEFAULT_ML).toBe(1500)
    const card = readFileSync(resolve('src/components/hydration/WaterCard.tsx'), 'utf8')
    expect(card).toMatch(/isMinorOrUnknownAge/)
    expect(card).toMatch(/GOAL_DEFAULT_ML/)
    expect(card).toMatch(/data-hydration-minor/)
    const server = readFileSync(resolve('convex/hydration.ts'), 'utf8')
    expect(server).toMatch(/HYDRATION_GOAL_LOCKED_MINOR/)
  })
})
