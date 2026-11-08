/** @vitest-environment jsdom */
/**
 * QA boucle 2 — M1 legacy / M2 rappels on / M7 goal serveur effectif.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  GOAL_DEFAULT_ML,
  REMINDER_NOTIFICATION_IDS,
  effectiveHydrationGoalMl,
  legacyWaterDayClientId,
  legacyWaterEntryClientId,
} from '../../shared/hydration/constants'
import {
  buildHydrationReminderNotifications,
  isReminderStillAheadToday,
  sanitizeReminderTimes,
} from '../services/hydration/hydrationReminders'

describe('QA M1 — legacy → hydration sans double compte', () => {
  it('1200 ml legacy visible via clientId stable + rejeu idempotent', () => {
    const entryId = 'w-legacy-1'
    const clientId = legacyWaterEntryClientId(entryId)
    expect(clientId).toBe('legacy:w-legacy-1')

    // Simulate sumDrunkMl: hydration empty + legacy 1200 not migrated → 1200
    const hydration: Array<{ clientId: string; amountMl: number; undoneAt?: number }> = []
    const legacy = [{ entryId, amountMl: 1200 }]

    const sum = (
      hy: typeof hydration,
      leg: typeof legacy,
    ) => {
      let total = hy.filter((r) => r.undoneAt == null).reduce((a, r) => a + r.amountMl, 0)
      for (const row of leg) {
        const cid = legacyWaterEntryClientId(row.entryId)
        if (hy.some((h) => h.clientId === cid && h.undoneAt == null)) continue
        if (hy.some((h) => h.clientId === cid && h.undoneAt != null)) continue
        total += row.amountMl
      }
      return total
    }

    expect(sum(hydration, legacy)).toBe(1200)

    // Migrate once
    hydration.push({ clientId, amountMl: 1200 })
    expect(sum(hydration, legacy)).toBe(1200)

    // Rejeu migration (même clientId) — pas de doublon
    const already = hydration.some((h) => h.clientId === clientId)
    expect(already).toBe(true)
    expect(sum(hydration, legacy)).toBe(1200)

    // Coexistence lecture legacy + hydration migrée → toujours 1200
    expect(sum(hydration, legacy)).toBe(1200)
  })

  it('legacy-day total sans entrées discrètes a un clientId stable', () => {
    expect(legacyWaterDayClientId('2026-11-08')).toBe('legacy-day:2026-11-08')
  })
})

describe('QA M2 — payload LocalNotifications on hour/minute', () => {
  it('pas de at/repeats/every ; on hour/minute exacts ; IDs stables ; ≤3 ; hors 21–8', () => {
    const notifications = buildHydrationReminderNotifications(
      ['10:00', '14:00', '18:00', '21:00', '03:00', '12:00'],
      { goalReachedToday: false, now: new Date(2026, 10, 8, 9, 0, 0) },
    )
    expect(notifications.length).toBeLessThanOrEqual(3)
    expect(notifications.map((n) => n.id)).toEqual([
      REMINDER_NOTIFICATION_IDS[0],
      REMINDER_NOTIFICATION_IDS[1],
      REMINDER_NOTIFICATION_IDS[2],
    ])
    for (const n of notifications) {
      const schedule = n.schedule as Record<string, unknown>
      expect(schedule.at).toBeUndefined()
      expect(schedule.repeats).toBeUndefined()
      expect(schedule.every).toBeUndefined()
      expect(schedule.on).toEqual(
        expect.objectContaining({
          hour: expect.any(Number),
          minute: expect.any(Number),
        }),
      )
      const on = schedule.on as { hour: number; minute: number }
      expect(on.hour).toBeGreaterThanOrEqual(8)
      expect(on.hour).toBeLessThan(21)
      // Pas de composant nuit
      expect(on.hour === 21 || on.hour < 8).toBe(false)
    }
    expect(notifications.map((n) => n.schedule.on)).toEqual([
      { hour: 10, minute: 0 },
      { hour: 14, minute: 0 },
      { hour: 18, minute: 0 },
    ])
  })

  it('goalReached en journée : pause (pas de créneau encore à venir), IDs stables', () => {
    const now = new Date(2026, 10, 8, 13, 0, 0)
    expect(isReminderStillAheadToday(14, 0, now)).toBe(true)
    expect(isReminderStillAheadToday(10, 0, now)).toBe(false)

    const notifications = buildHydrationReminderNotifications(['10:00', '14:00', '18:00'], {
      goalReachedToday: true,
      now,
    })
    // Seul 10:00 déjà passé → reprogrammé (demain via on) ; 14/18 omis = pause jour
    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.id).toBe(REMINDER_NOTIFICATION_IDS[0])
    expect(notifications[0]?.schedule.on).toEqual({ hour: 10, minute: 0 })
    expect(notifications[0]?.schedule).not.toHaveProperty('at')
    expect(notifications[0]?.schedule).not.toHaveProperty('repeats')
  })

  it('sanitize refuse la nuit et borne à 3', () => {
    expect(sanitizeReminderTimes(['21:00', '07:59', '10:00', '14:00', '18:00', '12:00'])).toEqual([
      '10:00',
      '14:00',
      '18:00',
    ])
  })
})

describe('QA M7 — goal effectif serveur 1500 mineur / inconnu', () => {
  it('âge 17 / 0 / null → 1500 même si stocké 3000', () => {
    expect(effectiveHydrationGoalMl(3000, 17)).toBe(GOAL_DEFAULT_ML)
    expect(effectiveHydrationGoalMl(3000, 0)).toBe(GOAL_DEFAULT_ML)
    expect(effectiveHydrationGoalMl(3000, null)).toBe(GOAL_DEFAULT_ML)
    expect(effectiveHydrationGoalMl(3000, undefined)).toBe(GOAL_DEFAULT_ML)
    expect(GOAL_DEFAULT_ML).toBe(1500)
  })

  it('adulte 18+ conserve la cible stockée (inchangé)', () => {
    expect(effectiveHydrationGoalMl(3000, 18)).toBe(3000)
    expect(effectiveHydrationGoalMl(1000, 30)).toBe(1000)
    expect(effectiveHydrationGoalMl(1500, 85)).toBe(1500)
  })

  it('handlers Convex exposent migrateLegacyWater + effectiveHydrationGoalMl', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('convex/hydration.ts', 'utf8'),
    )
    expect(src).toMatch(/export const migrateLegacyWater = mutation/)
    expect(src).toMatch(/effectiveHydrationGoalMl/)
    expect(src).toMatch(/normalizeStoredGoalIfLocked/)
    expect(src).toMatch(/legacyWaterEntryClientId/)
    expect(src).toMatch(/listLegacyWaterRows/)
  })
})

describe('QA M1 client helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('migrateLocalLegacyWaterToHydration est idempotente (2e passe skipped)', async () => {
    vi.resetModules()
    vi.doMock('../services/nutritionStorage', () => ({
      getWaterEntriesForDate: (dayKey: string) =>
        dayKey === '2026-11-08'
          ? [{ id: 'w1', amountMl: 1200, createdAt: 1, type: 'bottle', label: 'Bouteille' }]
          : [],
      getWaterMlForDate: () => 0,
    }))
    const addCalls: unknown[] = []
    vi.doMock('../services/hydration/hydrationService', () => ({
      addHydrationEntry: async (input: unknown) => {
        addCalls.push(input)
        return { drunkMl: 1200 }
      },
    }))
    const { migrateLocalLegacyWaterToHydration } = await import(
      '../services/hydration/hydrationLegacyMigrate'
    )
    const first = await migrateLocalLegacyWaterToHydration('user-a', '2026-11-08')
    expect(first.skipped).toBe(false)
    expect(first.attempted).toBeGreaterThanOrEqual(1)
    expect(addCalls[0]).toMatchObject({
      clientId: 'legacy:w1',
      amountMl: 1200,
    })
    const second = await migrateLocalLegacyWaterToHydration('user-a', '2026-11-08')
    expect(second.skipped).toBe(true)
    expect(second.attempted).toBe(0)
    expect(addCalls).toHaveLength(first.ok)
    vi.doUnmock('../services/nutritionStorage')
    vi.doUnmock('../services/hydration/hydrationService')
  })
})
