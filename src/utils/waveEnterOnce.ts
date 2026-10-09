const KEY = 'rg-wave-enter-seen'

/** First-load wave enter only — never again this browser session. */
export function shouldPlayWaveEnter(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return true
    if (sessionStorage.getItem(KEY) === '1') return false
    return true
  } catch {
    return true
  }
}

export function markWaveEnterSeen(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* private mode */
  }
}

/** Tests only. */
export function __resetWaveEnterForTests(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
