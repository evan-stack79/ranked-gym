/**
 * Préférences locales du son de fin de repos (pas de dB, pas de promesse « sûr »).
 * countdownBeeps OFF par défaut (SON-02).
 */

export type RestTimerSoundPrefs = {
  soundEnabled: boolean
  countdownBeeps: boolean
  haptics: boolean
}

const STORAGE_KEY = 'ranked-gym:rest-timer-sound-prefs'

export const DEFAULT_REST_TIMER_SOUND_PREFS: RestTimerSoundPrefs = {
  soundEnabled: true,
  countdownBeeps: false,
  haptics: true,
}

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function loadRestTimerSoundPrefs(): RestTimerSoundPrefs {
  if (!canUseStorage()) return { ...DEFAULT_REST_TIMER_SOUND_PREFS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_REST_TIMER_SOUND_PREFS }
    const parsed = JSON.parse(raw) as Partial<RestTimerSoundPrefs>
    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_REST_TIMER_SOUND_PREFS.soundEnabled,
      countdownBeeps:
        typeof parsed.countdownBeeps === 'boolean'
          ? parsed.countdownBeeps
          : DEFAULT_REST_TIMER_SOUND_PREFS.countdownBeeps,
      haptics:
        typeof parsed.haptics === 'boolean'
          ? parsed.haptics
          : DEFAULT_REST_TIMER_SOUND_PREFS.haptics,
    }
  } catch {
    return { ...DEFAULT_REST_TIMER_SOUND_PREFS }
  }
}

export function saveRestTimerSoundPrefs(prefs: RestTimerSoundPrefs): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // quota / private mode
  }
}

export function patchRestTimerSoundPrefs(
  patch: Partial<RestTimerSoundPrefs>,
): RestTimerSoundPrefs {
  const next = { ...loadRestTimerSoundPrefs(), ...patch }
  saveRestTimerSoundPrefs(next)
  return next
}
