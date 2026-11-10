/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/convex', () => ({
  getConvex: () => ({
    mutation: vi.fn(async () => {
      throw new Error('deleteEntry undeployed')
    }),
    query: vi.fn(async () => {
      throw new Error('no query')
    }),
  }),
}))

vi.mock('../convexAuthService', () => ({
  getConvexSessionToken: vi.fn(async () => 'tok'),
}))

describe('deleteHydrationDayEntry — repli local', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('retire un pending local et baisse le total sans Convex', async () => {
    const {
      applyHydrationSettingsLocal,
      addHydrationEntry,
      deleteHydrationDayEntry,
      fallbackToday,
      fetchHydrationDayEntries,
      onHydrationAccountChanged,
    } = await import('./hydrationService')
    const { enqueuePendingHydrationEntry, bindHydrationQueueUser } = await import(
      './hydrationOfflineQueue'
    )

    onHydrationAccountChanged('u-del')
    bindHydrationQueueUser('u-del')
    applyHydrationSettingsLocal({ mode: 'classic_2l', goalMl: 2000 }, 'u-del')

    enqueuePendingHydrationEntry({
      userId: 'u-del',
      clientId: 'client-abc-900',
      dayKey: '2026-11-10',
      amountMl: 900,
      source: 'slider',
      createdAt: Date.now(),
    })

    const before = fallbackToday('2026-11-10', 'u-del')
    expect(before.drunkMl).toBe(900)

    const after = await deleteHydrationDayEntry({
      clientId: 'client-abc-900',
      dayKey: '2026-11-10',
      amountMl: 900,
    })
    expect(after.drunkMl).toBe(0)

    const entries = await fetchHydrationDayEntries('2026-11-10')
    expect(entries.find((e) => e.clientId === 'client-abc-900')).toBeUndefined()

    void addHydrationEntry
  })
})
