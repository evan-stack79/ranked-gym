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
  nativeReleaseAudioSession,
  nativeSchedule,
  nativeVibrate,
  type RestTimerSoundCancelOptions,
  type RestTimerSoundPlayNowOptions,
} from '../services/restTimerSoundNative'
import { vibrate } from './haptics'

const WEB_CHIME_URL = '/sounds/rest_timer_chime.mp3'
const WEB_CHIME_GAIN = 0.2
const COUNTDOWN_BEEP_MAX_SEC = 0.12
const COUNTDOWN_BEEP_VOLUME = 1.0

let activeToken: string | null = null
let playedToken: string | null = null
let scheduledEndAtMs: number | null = null
let webEndTimer: number | null = null
let countdownBeepKeys = new Set<string>()
let visibilityHookInstalled = false

/** Test / DI seams */
let scheduleImpl = nativeSchedule
let cancelImpl = nativeCancel
let previewImpl = nativePreview
let playNowImpl = nativePlayNow
let vibrateNativeImpl = nativeVibrate
let releaseSessionImpl = nativeReleaseAudioSession
let isNativeIosImpl = isRestTimerSoundNativeIos
let prefsLoader = loadRestTimerSoundPrefs
let audioPlayImpl: ((url: string, gain: number) => void) | null = null

export function __setRestTimerSoundTestHooks(hooks: {
  schedule?: typeof nativeSchedule
  cancel?: typeof nativeCancel
  preview?: typeof nativePreview
  playNow?: typeof nativePlayNow
  vibrateNative?: typeof nativeVibrate
  releaseAudioSession?: typeof nativeReleaseAudioSession
  isNativeIos?: typeof isRestTimerSoundNativeIos
  loadPrefs?: typeof loadRestTimerSoundPrefs
  playAudio?: (url: string, gain: number) => void
}): void {
  if (hooks.schedule) scheduleImpl = hooks.schedule
  if (hooks.cancel) cancelImpl = hooks.cancel
  if (hooks.preview) previewImpl = hooks.preview
  if (hooks.playNow) playNowImpl = hooks.playNow
  if (hooks.vibrateNative) vibrateNativeImpl = hooks.vibrateNative
  if (hooks.releaseAudioSession) releaseSessionImpl = hooks.releaseAudioSession
  if (hooks.isNativeIos) isNativeIosImpl = hooks.isNativeIos
  if (hooks.loadPrefs) prefsLoader = hooks.loadPrefs
  if (hooks.playAudio) audioPlayImpl = hooks.playAudio
}

export function __resetRestTimerSoundTestHooks(): void {
  scheduleImpl = nativeSchedule
  cancelImpl = nativeCancel
  previewImpl = nativePreview
  playNowImpl = nativePlayNow
  vibrateNativeImpl = nativeVibrate
  releaseSessionImpl = nativeReleaseAudioSession
  isNativeIosImpl = isRestTimerSoundNativeIos
  prefsLoader = loadRestTimerSoundPrefs
  audioPlayImpl = null
  activeToken = null
  playedToken = null
  scheduledEndAtMs = null
  countdownBeepKeys = new Set()
  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }
}

export function getRestTimerSoundPrefs(): RestTimerSoundPrefs {
  return prefsLoader()
}

/**
 * Mute/unmute — releases ducked audio session and reschedules lock-screen
 * notification so the alert matches the new soundEnabled flag.
 */
export function setRestTimerSoundEnabled(enabled: boolean): RestTimerSoundPrefs {
  const next = patchRestTimerSoundPrefs({ soundEnabled: enabled })
  void syncActiveScheduleAfterPrefsChange(next)
  return next
}

export function setRestTimerCountdownBeeps(enabled: boolean): RestTimerSoundPrefs {
  return patchRestTimerSoundPrefs({ countdownBeeps: enabled })
}

export function setRestTimerHaptics(enabled: boolean): RestTimerSoundPrefs {
  const next = patchRestTimerSoundPrefs({ haptics: enabled })
  void syncActiveScheduleAfterPrefsChange(next)
  return next
}

async function syncActiveScheduleAfterPrefsChange(
  prefs: RestTimerSoundPrefs,
): Promise<void> {
  // Mute mid-countdown (after bip 3): unduck music immediately.
  if (!prefs.soundEnabled) {
    await releaseSessionImpl()
  }
  if (activeToken == null || scheduledEndAtMs == null) return
  if (scheduledEndAtMs <= Date.now()) return
  // Reschedule lock-screen alert with updated soundEnabled / haptics.
  await cancelImpl({ releaseSession: false, cancelPending: true })
  await scheduleImpl({
    endAtMs: scheduledEndAtMs,
    soundEnabled: prefs.soundEnabled,
    haptics: prefs.haptics,
    token: activeToken,
  })
}

function makeToken(endAtMs: number): string {
  return `rest-${Math.round(endAtMs)}`
}

function ensureVisibilityHook(): void {
  if (visibilityHookInstalled || typeof document === 'undefined') return
  visibilityHookInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Mid 3-2-1 duck must end when leaving the app.
      void releaseRestTimerAudioSession()
    }
  })
}

function playWebChime(gain = WEB_CHIME_GAIN, maxDurationSec?: number): void {
  if (audioPlayImpl) {
    audioPlayImpl(WEB_CHIME_URL, gain)
    return
  }
  try {
    const audio = new Audio(WEB_CHIME_URL)
    audio.volume = Math.min(1, gain)
    void audio.play().catch(() => {
      playWebAudioFallback(gain)
    })
    if (maxDurationSec != null && maxDurationSec > 0) {
      window.setTimeout(() => {
        try {
          audio.pause()
          audio.currentTime = 0
        } catch {
          // ignore
        }
      }, maxDurationSec * 1000)
    }
  } catch {
    playWebAudioFallback(gain)
  }
}

function playWebAudioFallback(gain = WEB_CHIME_GAIN): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const playTone = (freq: number, start: number, dur: number, gLevel = gain) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(Math.min(1, gLevel), start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.02)
    }
    void ctx.resume()
    playTone(784, now, 0.14, Math.min(1, gain))
    playTone(1046.5, now + 0.13, 0.22, Math.min(1, gain))
    window.setTimeout(() => {
      void ctx.close()
    }, 600)
  } catch {
    // silent / blocked
  }
}

function playWebCountdownBeep(): void {
  if (audioPlayImpl) {
    audioPlayImpl(WEB_CHIME_URL, WEB_CHIME_GAIN)
    return
  }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) {
      playWebChime(WEB_CHIME_GAIN, COUNTDOWN_BEEP_MAX_SEC)
      return
    }
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(Math.min(1, WEB_CHIME_GAIN), now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + COUNTDOWN_BEEP_MAX_SEC)
    osc.connect(g)
    g.connect(ctx.destination)
    void ctx.resume()
    osc.start(now)
    osc.stop(now + COUNTDOWN_BEEP_MAX_SEC + 0.02)
    window.setTimeout(() => {
      void ctx.close()
    }, 300)
  } catch {
    playWebChime(WEB_CHIME_GAIN, COUNTDOWN_BEEP_MAX_SEC)
  }
}

async function playEndChimeOnce(token: string): Promise<boolean> {
  if (playedToken === token) return false
  playedToken = token
  const prefs = prefsLoader()
  if (!prefs.soundEnabled) return false
  if (isNativeIosImpl()) {
    const res = await playNowImpl(token, { holdSession: false })
    return res.played
  }
  playWebChime()
  return true
}

/** Une seule vibration de fin (JS) — willPresent natif ne vibre pas. */
async function fireHapticAtEnd(): Promise<void> {
  const prefs = prefsLoader()
  if (!prefs.haptics) return
  if (isNativeIosImpl()) {
    await vibrateNativeImpl()
  } else {
    vibrate([40, 60, 40, 60, 80])
  }
}

export async function scheduleRestTimerSound(endAtMs: number): Promise<void> {
  ensureVisibilityHook()
  const prefs = prefsLoader()
  const token = makeToken(endAtMs)
  activeToken = token
  playedToken = null
  scheduledEndAtMs = endAtMs
  countdownBeepKeys = new Set()

  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }

  await cancelImpl({ releaseSession: true, cancelPending: true })
  await scheduleImpl({
    endAtMs,
    soundEnabled: prefs.soundEnabled,
    haptics: prefs.haptics,
    token,
  })

  if (!isNativeIosImpl()) {
    const delay = Math.max(0, endAtMs - Date.now())
    webEndTimer = window.setTimeout(() => {
      webEndTimer = null
      void onRestTimerSoundComplete()
    }, delay)
  }
}

/** Annule l’alerte (Reprendre / dismiss / pause) — libère la session duckée. */
export async function cancelRestTimerSound(
  options?: RestTimerSoundCancelOptions,
): Promise<void> {
  activeToken = null
  scheduledEndAtMs = null
  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }
  await cancelImpl({
    releaseSession: options?.releaseSession ?? true,
    cancelPending: options?.cancelPending ?? true,
  })
}

/** Libère la session audio (musique revient) sans annuler la notif. */
export async function releaseRestTimerAudioSession(): Promise<void> {
  await releaseSessionImpl()
}

export async function rescheduleRestTimerSound(endAtMs: number): Promise<void> {
  await scheduleRestTimerSound(endAtMs)
}

export async function onRestTimerSoundComplete(): Promise<void> {
  const token = activeToken
  // Keep held countdown session until final chime (releaseSession: false).
  await cancelImpl({ releaseSession: false, cancelPending: true })
  if (webEndTimer != null) {
    window.clearTimeout(webEndTimer)
    webEndTimer = null
  }
  scheduledEndAtMs = null
  if (!token) {
    // Cancel / Reprendre already cleared the token — no stray haptic.
    return
  }
  if (playedToken === token) {
    // Already completed (incl. haptic) — no second vibration.
    activeToken = null
    return
  }
  await playEndChimeOnce(token)
  await fireHapticAtEnd()
  activeToken = null
}

export async function previewRestTimerSound(): Promise<void> {
  if (isNativeIosImpl()) {
    await previewImpl()
    return
  }
  playWebChime()
}

export async function maybePlayCountdownBeep(remainingSec: number): Promise<void> {
  const prefs = prefsLoader()
  if (!prefs.countdownBeeps || !prefs.soundEnabled) return
  if (remainingSec !== 3 && remainingSec !== 2 && remainingSec !== 1) return
  const key = `${activeToken ?? 'x'}:${remainingSec}`
  if (countdownBeepKeys.has(key)) return
  countdownBeepKeys.add(key)
  ensureVisibilityHook()
  if (isNativeIosImpl()) {
    const opts: RestTimerSoundPlayNowOptions = {
      cancelPending: false,
      volume: COUNTDOWN_BEEP_VOLUME,
      maxDurationSec: COUNTDOWN_BEEP_MAX_SEC,
      holdSession: true,
    }
    await playNowImpl(`${key}-beep`, opts)
    return
  }
  playWebCountdownBeep()
}

/** @deprecated Use onRestTimerSoundComplete */
export function playRestCompleteChime(): void {
  void onRestTimerSoundComplete()
}
