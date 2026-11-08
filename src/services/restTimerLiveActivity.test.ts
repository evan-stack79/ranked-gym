/** @vitest-environment jsdom */
/**
 * Compat re-exports — le pont réel est testé dans liveActivity.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.fn(async () => ({ activityId: 'a1' }))
const update = vi.fn(async () => ({ updated: true }))
const end = vi.fn(async () => {})
const isAvailable = vi.fn(async () => ({ available: true }))
const alert = vi.fn(async () => ({ alerted: true }))
const isNativePlatform = vi.fn(() => true)
const getPlatform = vi.fn(() => 'ios')

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
    getPlatform: () => getPlatform(),
  },
  registerPlugin: () => ({ start, update, end, isAvailable, alert }),
}))

describe('restTimerLiveActivity compat bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    start.mockClear()
    update.mockClear()
    end.mockClear()
    isAvailable.mockClear()
    isAvailable.mockResolvedValue({ available: true })
    isNativePlatform.mockReturnValue(true)
    getPlatform.mockReturnValue('ios')
  })

  it('forwards start/update/end to LiveActivity (kind rest) on iOS', async () => {
    const live = await import('./liveActivity')
    live.__resetLiveActivityBridgeForTests()
    const mod = await import('./restTimerLiveActivity')
    const endDateMs = Date.now() + 90_000
    const startDateMs = endDateMs - 90_000
    await mod.startRestLiveActivity({
      remainingSec: 90.4,
      totalSec: 90,
      startDateMs,
      endDateMs,
      subtitle: 'Squat · Série 2',
    })
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        remainingSec: 90,
        totalSec: 90,
        startDateMs,
        endDateMs,
        subtitle: 'Squat · Série 2',
      }),
    )

    await mod.updateRestLiveActivity({ remainingSec: 44.2 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ remainingSec: 44 }),
    )

    await mod.endRestLiveActivity(true)
    expect(end).toHaveBeenCalledWith({ immediate: true })
  })

  it('no-ops on web', async () => {
    isNativePlatform.mockReturnValue(false)
    getPlatform.mockReturnValue('web')
    const live = await import('./liveActivity')
    live.__resetLiveActivityBridgeForTests()
    const mod = await import('./restTimerLiveActivity')
    await mod.startRestLiveActivity({ remainingSec: 30, totalSec: 30 })
    expect(start).not.toHaveBeenCalled()
  })
})
