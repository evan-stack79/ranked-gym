/** @vitest-environment jsdom */
/**
 * Release IPA must never show the AlarmKit diagnostic panel by default.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/sleepAlarmDiagGate', () => ({
  isSleepAlarmDiagEnabled: () => false,
  setSleepAlarmDiagEnabled: vi.fn(),
  isSleepAlarmDiagUnlocked: () => false,
  SLEEP_ALARM_DIAG_STORAGE_KEY: 'ranked-gym:sleep-alarm-diag',
}))

vi.mock('../../services/sleepAlarmService', () => ({
  collectSleepAlarmDiagnostics: vi.fn(async () => ({
    buildSha: 'test',
    iosVersion: '—',
    pluginJsName: 'RankedAlarm',
    pluginAvailable: false,
    alarmKitAvailable: false,
    authorization: '—',
    alarmCount: 0,
    soundResolvedName: null,
    soundInBundle: false,
    lastError: null,
    native: false,
    platform: 'web',
    capacitorNative: false,
    hasUsageDescription: false,
  })),
  runOneMinuteAlarmTest: vi.fn(),
  syncFailureMessage: () => 'err',
}))

describe('SleepAlarmDiagBlock — hidden by default (release)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('does not render diagnostic lines or « Tester dans 1 min » when gate is closed', async () => {
    const { SleepAlarmDiagBlock } = await import('./SleepAlarmDiagBlock')
    const { isSleepAlarmDiagEnabled } = await import('../../utils/sleepAlarmDiagGate')
    const open = isSleepAlarmDiagEnabled()
    expect(open).toBe(false)

    await act(async () => {
      root.render(<SleepAlarmDiagBlock open={open} expanded={false} />)
    })

    expect(host.querySelector('[data-sleep-alarm-diag]')).toBeNull()
    expect(host.querySelector('[data-sleep-alarm-test-1min]')).toBeNull()
    expect(host.textContent ?? '').not.toMatch(/Tester dans 1 min/)
    expect(host.textContent ?? '').not.toMatch(/AlarmKit/)
  })
})
