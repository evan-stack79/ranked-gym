import { describe, expect, it } from 'vitest'
import {
  CAMERA_HEART_RATE_DISCLAIMER,
  isCameraHeartRateEnabled,
} from './featureFlag'
import type { CameraHeartRateResultEvent } from './types'
import { CameraHeartRateWeb } from './web'

describe('cameraHeartRate feature flag', () => {
  it('exposes a boolean gate and a non-medical disclaimer', () => {
    // Vitest uses the process env baked at config time; helper must reject non-true.
    expect(typeof isCameraHeartRateEnabled()).toBe('boolean')
    expect(CAMERA_HEART_RATE_DISCLAIMER.toLowerCase()).toContain('médical')
    expect(CAMERA_HEART_RATE_DISCLAIMER.toLowerCase()).toContain('bien-être')
    expect(CAMERA_HEART_RATE_DISCLAIMER.toLowerCase()).toContain('enregistr')
  })
})

describe('CameraHeartRateWeb stub', () => {
  it('reports unavailable and never invents a BPM', async () => {
    const plugin = new CameraHeartRateWeb()
    const availability = await plugin.isAvailable()
    expect(availability.available).toBe(false)
    expect(availability.platform).toBe('web')
    expect(availability.hasTorch).toBe(false)

    let resultBpm: number | undefined
    await plugin.addListener('result', (event: CameraHeartRateResultEvent) => {
      resultBpm = event.bpm
      expect(event.ok).toBe(false)
      expect(event.reason).toBe('unsupported')
    })
    await plugin.startMeasurement()
    expect(resultBpm).toBeUndefined()
  })

  it('stopMeasurement emits cancelled without bpm', async () => {
    const plugin = new CameraHeartRateWeb()
    const events: Array<{ ok: boolean; reason?: string; bpm?: number }> = []
    await plugin.addListener('result', (event: CameraHeartRateResultEvent) => {
      events.push(event)
    })
    await plugin.stopMeasurement()
    expect(events).toHaveLength(1)
    expect(events[0]?.ok).toBe(false)
    expect(events[0]?.reason).toBe('cancelled')
    expect(events[0]?.bpm).toBeUndefined()
  })

  it('removeAllListeners drops subsequent result callbacks', async () => {
    const plugin = new CameraHeartRateWeb()
    let calls = 0
    await plugin.addListener('result', () => {
      calls += 1
    })
    await plugin.removeAllListeners()
    await plugin.startMeasurement()
    expect(calls).toBe(0)
  })
})
