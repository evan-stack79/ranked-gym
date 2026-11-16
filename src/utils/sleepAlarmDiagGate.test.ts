/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import {
  isSleepAlarmDiagEnabled,
  setSleepAlarmDiagEnabled,
  SLEEP_ALARM_DIAG_STORAGE_KEY,
} from './sleepAlarmDiagGate'

describe('sleepAlarmDiagGate', () => {
  afterEach(() => {
    localStorage.removeItem(SLEEP_ALARM_DIAG_STORAGE_KEY)
  })

  it('release/IPA default: not enabled when not DEV and no localStorage flag', () => {
    localStorage.removeItem(SLEEP_ALARM_DIAG_STORAGE_KEY)
    expect(isSleepAlarmDiagEnabled({ dev: false })).toBe(false)
  })

  it('DEV builds can show diagnostics without localStorage', () => {
    localStorage.removeItem(SLEEP_ALARM_DIAG_STORAGE_KEY)
    expect(isSleepAlarmDiagEnabled({ dev: true })).toBe(true)
  })

  it('unlock via localStorage flag even outside DEV', () => {
    setSleepAlarmDiagEnabled(true)
    expect(localStorage.getItem(SLEEP_ALARM_DIAG_STORAGE_KEY)).toBe('1')
    expect(isSleepAlarmDiagEnabled({ dev: false })).toBe(true)
    setSleepAlarmDiagEnabled(false)
    expect(isSleepAlarmDiagEnabled({ dev: false })).toBe(false)
  })
})
