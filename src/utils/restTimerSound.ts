/**
 * Son de fin de repos — schedule / cancel / preview (SON-01..20).
 * Volume lecteur ≤ 1.0 ; aucun dB affiché ; pas de promesse « sûr ».
 */
import {
  loadRestTimerSoundPrefs,
  patchRestTimerSoundPrefs,
  type RestTimerSoundPrefs,
} from '../services/restTimerSoundPrefs'
import {
  isRestTimerSoundNativeIos,
  nativeCancel,
  nativePlayNow,
  nativePreview,
  nativeSchedule,
  nativeVibrate,
} from '../services/restTimerSoundNative'
import { vibrate } from './haptics'

const WEB_CHIME_URL = '/sounds/rest_timer_chime.mp3'
/** Gain Web Audio ≤ 1.0 (Vérificateur). */
const WEB_CHIME_GAIN = 0.2

let activeToken: string | null = null
let playedToken: string | null = null
let webEndTimer: number | null = null
let countdownBeepKeys = new Set<string>()

/** Test / DI seams */
let scheduleImpl = nativeSchedule
let cancelImpl = nativeCancel
let previewImpl = nativePreview
let playNowImpl = nativePlayNow
let vibrateNativeImpl = nativeVibrate
let prefsLoader = loadRestTimerSoundPrefs
let audioPlayImpl: ((url: string, gain: number) => void) | null = null

export function __setRestTimerSoundTestHooks(hooks: {
  schedule?: typeof nativeSchedule
  cancel?: typeof nativeCancel
  preview?: typeof nativePreview
  playNow?: typeof nativePlayNow
  vibrateNative?: typeof nativeVibrate
  loadPrefs?: typeof loadRestTimerSoundPrefs
  playAudio?: (url: string, gain: number) => void
}): void {
  if (hooks.schedule) scheduleImpl = hooks.schedule
  if (hooks.cancel) cancelImpl = hooks.cancel
  if (hooks.preview) previewImpl = hooks.preview
  if (hooks.playNow) playNowImpl = hooks.playNow
  if (hooks.vibrateNative) vibrateNativeImpl = hooks.vibrateNative
  if (hooks.loadPrefs) prefsLoader = hooks.loadPrefs
  if (hooks.playAudio) audioPlayImpl = hooks.playAudio
}

export function __resetRestTimerSoundTestHooks(): void {
  scheduleImpl = nativeSchedule
  cancelImpl = nativeCancel
  previewImpl = nativePreview
  playNowImpl = nativePlayNow
  vibrateNativeImpl = nativeVibrate
  prefsLoader = loadRestTimerSoundPrefs
  audioPlayImpl = null
  activeToken = null
  playedToken = null
  countdownBeepKeys = new Set()
  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }
}

export function getRestTimerSoundPrefs(): RestTimerSoundPrefs {
  return prefsLoader()
}

export function setRestTimerSoundEnabled(enabled: boolean): RestTimerSoundPrefs {
  return patchRestTimerSoundPrefs({ soundEnabled: enabled })
}

export function setRestTimerCountdownBeeps(enabled: boolean): RestTimerSoundPrefs {
  return patchRestTimerSoundPrefs({ countdownBeeps: enabled })
}

export function setRestTimerHaptics(enabled: boolean): RestTimerSoundPrefs {
  return patchRestTimerSoundPrefs({ haptics: enabled })
}

function makeToken(endAtMs: number): string {
  return `rest-${Math.round(endAtMs)}`
}

function playWebChime(): void {
  if (audioPlayImpl) {
    audioPlayImpl(WEB_CHIME_URL, WEB_CHIME_GAIN)
    return
  }
  try {
    const audio = new Audio(WEB_CHIME_URL)
    audio.volume = Math.min(1, WEB_CHIME_GAIN)
    void audio.play().catch(() => {
      playWebAudioFallback()
    })
  } catch {
    playWebAudioFallback()
  }
}

/** Repli Web Audio (ancien chime) — gains ≤ 1.0. */
function playWebAudioFallback(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const playTone = (freq: number, start: number, dur: number, gain = WEB_CHIME_GAIN) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(Math.min(1, gain), start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.02)
    }
    void ctx.resume()
    playTone(784, now, 0.14, 0.16)
    playTone(1046.5, now + 0.13, 0.22, 0.2)
    window.setTimeout(() => {
      void ctx.close()
    }, 600)
  } catch {
    // silent / blocked
  }
}

async function playEndChimeOnce(token: string): Promise<boolean> {
  if (playedToken === token) return false
  playedToken = token
  const prefs = prefsLoader()
  if (!prefs.soundEnabled) return false
  if (isRestTimerSoundNativeIos()) {
    const res = await playNowImpl(token)
    return res.played
  }
  playWebChime()
  return true
}

async function fireHapticIfNeeded(soundPlayed: boolean): Promise<void> {
  const prefs = prefsLoader()
  if (!prefs.haptics) return
  // Son coupé → petite vibration ; silencieux haut-parleur (pas de son) → vibration.
  if (!prefs.soundEnabled || !soundPlayed) {
    if (isRestTimerSoundNativeIos()) {
      await vibrateNativeImpl()
    } else {
      vibrate([40, 60, 40])
    }
    return
  }
  vibrate([40, 60, 40, 60, 80])
}

/**
 * Programme l’alerte de fin (notif locale iOS + garde JS).
 * Une seule fois — pas de boucle.
 */
export async function scheduleRestTimerSound(endAtMs: number): Promise<void> {
  const prefs = prefsLoader()
  const token = makeToken(endAtMs)
  activeToken = token
  playedToken = null
  countdownBeepKeys = new Set()

  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }

  await cancelImpl()
  await scheduleImpl({
    endAtMs,
    soundEnabled: prefs.soundEnabled,
    token,
  })

  // Web / secours : si le tick JS est suspendu, pas de double lecture (token).
  if (!isRestTimerSoundNativeIos()) {
    const delay = Math.max(0, endAtMs - Date.now())
    webEndTimer = window.setTimeout(() => {
      webEndTimer = null
      void onRestTimerSoundComplete()
    }, delay)
  }
}

/** Annule l’alerte (Reprendre / dismiss / pause). */
export async function cancelRestTimerSound(): Promise<void> {
  activeToken = null
  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }
  await cancelImpl()
}

/** Reprogramme (+15 s / reprise). */
export async function rescheduleRestTimerSound(endAtMs: number): Promise<void> {
  await scheduleRestTimerSound(endAtMs)
}

/**
 * Fin naturelle au premier plan : retire la notif, joue une fois (pas de double).
 * Son coupé → vibration seulement si haptics ON.
 */
export async function onRestTimerSoundComplete(): Promise<void> {
  const token = activeToken
  await cancelImpl()
  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }
  if (!token) {
    const prefs = prefsLoader()
    if (prefs.haptics) vibrate([40, 60, 40, 60, 80])
    return
  }
  // Déjà joué (ex. willPresent natif) → pas de second son / haptic.
  if (playedToken === token) {
    activeToken = null
    return
  }
  const played = await playEndChimeOnce(token)
  await fireHapticIfNeeded(played)
  activeToken = null
}

/** Bouton « Écouter » — toujours le chime court, ignore mute pour l’aperçu. */
export async function previewRestTimerSound(): Promise<void> {
  if (isRestTimerSoundNativeIos()) {
    await previewImpl()
    return
  }
  playWebChime()
}

/**
 * Option 3 bips (3,2,1) — OFF par défaut. Appelée depuis le tick quand remaining ∈ {3,2,1}.
 */
export async function maybePlayCountdownBeep(remainingSec: number): Promise<void> {
  const prefs = prefsLoader()
  if (!prefs.countdownBeeps || !prefs.soundEnabled) return
  if (remainingSec !== 3 && remainingSec !== 2 && remainingSec !== 1) return
  const key = `${activeToken ?? 'x'}:${remainingSec}`
  if (countdownBeepKeys.has(key)) return
  countdownBeepKeys.add(key)
  if (isRestTimerSoundNativeIos()) {
    // Ne pas annuler la notif de fin pendant les bips 3-2-1.
    await playNowImpl(`${key}-beep`, { cancelPending: false })
    return
  }
  playWebChime()
}

/** @deprecated Use onRestTimerSoundComplete — kept for older call sites / tests. */
export function playRestCompleteChime(): void {
  void onRestTimerSoundComplete()
}
