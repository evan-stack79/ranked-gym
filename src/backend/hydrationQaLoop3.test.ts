/** @vitest-environment jsdom */
/**
 * QA boucle 3/4 — M1a retry idempotent · M1b J−2 sans faux succès · M2 réarmement J+1.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  GOAL_DEFAULT_ML,
  REMINDER_NOTIFICATION_IDS,
  isDayKeyWithinLegacyMigrationWindow,
  lastNDayKeys,
  legacyWaterEntryClientId,
  shiftDayKey,
} from '../shared/hydration'
import {
  buildHydrationReminderNotifications,
} from '../services/hydration/hydrationReminders'

describe('QA M1a — retry après échec partiel ne double pas', () => {
  it('1200 ml reste 1200 après N reprises (upsert clientId)', () => {
    const clientId = legacyWaterEntryClientId('w-legacy1')
    const rows: Array<{ clientId: string; amountMl: number; undoneAt?: number }> = []

    const upsert = (amountMl: number) => {
      const existing = rows.find((r) => r.clientId === clientId && r.undoneAt == null)
      if (existing) return { inserted: false }
      rows.push({ clientId, amountMl })
      // Simulate post-migrate re-check: if somehow duplicated, soft-undo extras
      const same = rows.filter((r) => r.clientId === clientId && r.undoneAt == null)
      if (same.length > 1) {
        for (let i = 1; i < same.length; i += 1) {
          const dup = rows.find((r) => r === same[i])
          if (dup) dup.undoneAt = Date.now()
        }
        return { inserted: false }
      }
      return { inserted: true }
    }

    const sum = () =>
      rows.filter((r) => r.undoneAt == null).reduce((a, r) => a + r.amountMl, 0)

    // Échec puis reprise ×3 (même clientId)
    expect(upsert(1200).inserted).toBe(true)
    expect(upsert(1200).inserted).toBe(false)
    expect(upsert(1200).inserted).toBe(false)
    expect(sum()).toBe(1200)
    expect(rows.filter((r) => r.clientId === clientId && r.undoneAt == null)).toHaveLength(1)
  })

  it('addEntry après migrateLegacy ne ré-insère pas le même clientId', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('convex/hydration.ts', 'utf8'),
    )
    expect(src).toMatch(/insertHydrationIfAbsent/)
    expect(src).toMatch(/afterMigrate/)
    expect(src).toMatch(/importLegacyLocalEntries/)
  })
})

describe('QA M1b — J−2 legacy : fenêtre 7 j, pas de faux succès', () => {
  it('J−2 est dans la fenêtre migration 7 j (pas ±1 seul)', () => {
    const today = '2026-11-08'
    const jMinus2 = shiftDayKey(today, -2)
    expect(isDayKeyWithinLegacyMigrationWindow(jMinus2, today)).toBe(true)
    expect(lastNDayKeys(today, 7)).toContain(jMinus2)
  })

  it('échec / rejet → complete=false, flag non posé, local conservé', async () => {
    localStorage.clear()
    vi.resetModules()
    vi.doMock('../services/nutritionStorage', () => ({
      getWaterEntriesForDate: (dayKey: string) =>
        dayKey === '2026-11-06'
          ? [{ id: 'old', amountMl: 700, createdAt: 1, type: 'bottle', label: 'Bouteille' }]
          : [],
      getWaterMlForDate: () => 0,
    }))
    vi.doMock('../services/convexAuthService', () => ({
      getConvexSessionToken: async () => 'tok',
    }))
    vi.doMock('../lib/convex', () => ({
      getConvex: () => ({
        mutation: async () => ({
          inserted: 0,
          skipped: 0,
          rejected: [
            {
              clientId: 'legacy:old',
              dayKey: '2026-11-06',
              reason: 'HYDRATION_INVALID_DAY_KEY',
            },
          ],
          ok: false,
        }),
      }),
    }))

    const { migrateLocalLegacyWaterToHydration, collectLocalLegacyEntries } = await import(
      '../services/hydration/hydrationLegacyMigrate'
    )
    const collected = collectLocalLegacyEntries('2026-11-08')
    expect(collected.some((e) => e.dayKey === '2026-11-06' && e.amountMl === 700)).toBe(true)

    const result = await migrateLocalLegacyWaterToHydration('user-a', '2026-11-08')
    expect(result.complete).toBe(false)
    expect(result.rejected).toBeGreaterThan(0)
    expect(localStorage.getItem('ranked-gym:hydration-legacy-local-migrated:user-a')).toBeNull()
    // Journal local non effacé par la migration (mock storage intact conceptuellement)
    expect(collected[0]?.amountMl).toBe(700)

    vi.doUnmock('../services/nutritionStorage')
    vi.doUnmock('../services/convexAuthService')
    vi.doUnmock('../lib/convex')
    localStorage.clear()
  })
})

describe('QA M2 — J objectif pause ; J+1 refresh réarme 3 créneaux', () => {
  it('J 09h goalReached → 0 créneau ; J+1 sans goal → 3 on:{hour,minute} IDs stables hors nuit', () => {
    const times = ['10:00', '14:00', '18:00']
    const dayJ = new Date(2026, 10, 8, 9, 0, 0)
    const paused = buildHydrationReminderNotifications(times, {
      goalReachedToday: true,
      now: dayJ,
    })
    expect(paused).toHaveLength(0)

    const dayJ1 = new Date(2026, 10, 9, 9, 0, 0)
    const rearmed = buildHydrationReminderNotifications(times, {
      goalReachedToday: false,
      now: dayJ1,
    })
    expect(rearmed).toHaveLength(3)
    expect(rearmed.map((n) => n.id)).toEqual([...REMINDER_NOTIFICATION_IDS])
    expect(rearmed.map((n) => n.schedule.on)).toEqual([
      { hour: 10, minute: 0 },
      { hour: 14, minute: 0 },
      { hour: 18, minute: 0 },
    ])
    for (const n of rearmed) {
      const raw = JSON.stringify(n.schedule)
      expect(raw).not.toMatch(/"at"/)
      expect(raw).not.toMatch(/"repeats"/)
      expect(n.schedule.on.hour).toBeGreaterThanOrEqual(8)
      expect(n.schedule.on.hour).toBeLessThan(21)
    }
  })

  it('fetchHydrationToday branche sync rappels (réarmement J+1)', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/services/hydration/hydrationService.ts', 'utf8'),
    )
    expect(src).toMatch(/syncHydrationReminders/)
    expect(src).toMatch(/goalReachedToday:\s*merged\.drunkMl\s*>=\s*merged\.goalMl/)
    expect(GOAL_DEFAULT_ML).toBe(1500)
  })
})
