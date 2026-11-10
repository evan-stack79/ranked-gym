/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bottleScreenLabelForMode } from '../../utils/hydrationModeDisplay'

const mutation = vi.fn()

vi.mock('../../lib/convex', () => ({
  getConvex: () => ({
    mutation,
    query: vi.fn(async () => {
      throw new Error('no query in this test')
    }),
  }),
}))

vi.mock('../convexAuthService', () => ({
  getConvexSessionToken: vi.fn(async () => 'tok'),
}))

describe('updateHydrationSettings optimiste', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    mutation.mockReset()
    mutation.mockRejectedValue(new Error('ArgumentValidationError: classic_15'))
  })

  it('choix 1,5 L + updateSettings rejeté → cache local + libellé carte 1,5 L', async () => {
    const {
      updateHydrationSettings,
      readPendingHydrationSettings,
      fallbackToday,
      applyHydrationSettingsLocal,
    } = await import('./hydrationService')

    applyHydrationSettingsLocal(
      {
        mode: 'classic_2l',
        goalMl: 1500,
        remindersEnabled: false,
        reminderTimes: ['10:00'],
      },
      'u-opt',
    )

    const result = await updateHydrationSettings({ mode: 'classic_15' })
    expect((result as { pendingLocal?: boolean }).pendingLocal).toBe(true)
    expect(readPendingHydrationSettings()?.mode).toBe('classic_15')

    const today = fallbackToday('2026-11-10', 'u-opt')
    expect(today.mode).toBe('classic_15')
    expect(today.effectiveVisualMode).toBe('classic_15')
    expect(bottleScreenLabelForMode(today.effectiveVisualMode)).toBe('Cristaline 1,5 L')
  })
})
