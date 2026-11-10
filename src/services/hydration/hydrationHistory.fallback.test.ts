/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lastNDayKeys, localDayKey } from '../../shared/hydration'

vi.mock('../../lib/convex', () => ({
  getConvex: () => ({
    query: vi.fn(async () => {
      throw new Error('undeployed getHistory')
    }),
  }),
}))

vi.mock('../convexAuthService', () => ({
  getConvexSessionToken: vi.fn(async () => 'tok'),
}))

describe('fetchHydrationHistory fallback local', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('retourne 7 jours locaux si getHistory échoue', async () => {
    const { fallbackHydrationHistory, fetchHydrationHistory } = await import(
      './hydrationService'
    )
    const end = localDayKey()
    const local = fallbackHydrationHistory(end, 'u1')
    expect(local).toHaveLength(7)
    expect(local.map((r) => r.dayKey)).toEqual(lastNDayKeys(end, 7))

    const rows = await fetchHydrationHistory(end)
    expect(rows).toHaveLength(7)
    expect(rows.every((r) => typeof r.drunkMl === 'number')).toBe(true)
  })
})
