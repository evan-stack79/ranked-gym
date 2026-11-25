/** Local unlock for AlarmKit beta diagnostics (never on by default in release IPA). */
export const SLEEP_ALARM_DIAG_STORAGE_KEY = 'ranked-gym:sleep-alarm-diag'

export type SleepAlarmDiagGateOptions = {
  /** Override for tests — defaults to `import.meta.env.DEV`. */
  dev?: boolean
}

/**
 * Diagnostics (build / plugin / Tester dans 1 min) — DEV builds, or localStorage unlock.
 * Release IPA: always false unless the hidden flag was set (5 taps on title).
 */
export function isSleepAlarmDiagEnabled(options?: SleepAlarmDiagGateOptions): boolean {
  const dev = options?.dev ?? Boolean(import.meta.env.DEV)
  if (dev) return true
  try {
    return globalThis.localStorage?.getItem(SLEEP_ALARM_DIAG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSleepAlarmDiagEnabled(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(SLEEP_ALARM_DIAG_STORAGE_KEY, '1')
    else globalThis.localStorage?.removeItem(SLEEP_ALARM_DIAG_STORAGE_KEY)
  } catch {
    /* private mode / SSR */
  }
}

/** True only from the localStorage unlock (ignores DEV). Used by hidden-tap UX. */
export function isSleepAlarmDiagUnlocked(): boolean {
  try {
    return globalThis.localStorage?.getItem(SLEEP_ALARM_DIAG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
