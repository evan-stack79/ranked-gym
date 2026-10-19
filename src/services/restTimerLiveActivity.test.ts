/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.fn(async () => ({ activityId: 'a1' }))
const update = vi.fn(async () => {})
const end = vi.fn(async () => {})
const isAvailable = vi.fn(async () => ({ available: true }))
const isNativePlatform = vi.fn(() => true)
const getPlatform = vi.fn(() => 'ios')

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
    getPlatform: () => getPlatform(),
  },
  registerPlugin: () => ({ start, update, end, isAvailable }),
}))

describe('restTimerLiveActivity bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    start.mockClear()
    update.mockClear()
    end.mockClear()
    isAvailable.mockClear()
    isAvailable.mockResolvedValue({ available: true })
    isNativePlatform.mockReset()
    getPlatform.mockReset()
    isNativePlatform.mockReturnValue(true)
    getPlatform.mockReturnValue('ios')
  })

  it('forwards start/update/end to the native plugin on iOS', async () => {
    const mod = await import('./restTimerLiveActivity')
    await mod.startRestLiveActivity({
      remainingSec: 90.4,
      totalSec: 90,
      subtitle: 'Squat · Série 2',
    })
    expect(start).toHaveBeenCalledWith({
      remainingSec: 90,
      totalSec: 90,
      subtitle: 'Squat · Série 2',
    })

    await mod.updateRestLiveActivity({ remainingSec: 44.2 })
    expect(update).toHaveBeenCalledWith({ remainingSec: 44, subtitle: undefined })

    await mod.endRestLiveActivity(true)
    expect(end).toHaveBeenCalledWith({ immediate: true })
  })

  it('no-ops on web', async () => {
    isNativePlatform.mockReturnValue(false)
    getPlatform.mockReturnValue('web')
    const mod = await import('./restTimerLiveActivity')
    await mod.startRestLiveActivity({ remainingSec: 30, totalSec: 30 })
    expect(start).not.toHaveBeenCalled()
  })
})
