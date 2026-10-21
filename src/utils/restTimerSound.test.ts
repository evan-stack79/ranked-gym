/** @vitest-environment jsdom */
/**
 * SON-01..20 — tests JS (fausses clés / mocks, pas de réseau).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_REST_TIMER_SOUND_PREFS,
  loadRestTimerSoundPrefs,
  saveRestTimerSoundPrefs,
} from '../services/restTimerSoundPrefs'
import {
  __resetRestTimerSoundTestHooks,
  __setRestTimerSoundTestHooks,
  cancelRestTimerSound,
  getRestTimerSoundPrefs,
  maybePlayCountdownBeep,
  onRestTimerSoundComplete,
  previewRestTimerSound,
  rescheduleRestTimerSound,
  scheduleRestTimerSound,
  setRestTimerCountdownBeeps,
  setRestTimerSoundEnabled,
} from './restTimerSound'

const STORAGE_KEY = 'ranked-gym:rest-timer-sound-prefs'

describe('restTimerSound', () => {
  const schedule = vi.fn(
    async (_opts: {
      endAtMs: number
      soundEnabled: boolean
      haptics: boolean
      token: string
    }) => ({
      scheduled: true as boolean,
      permission: true as boolean,
    }),
  )
  const cancel = vi.fn(async (_opts?: { releaseSession?: boolean }) => {})
  const preview = vi.fn(async () => {})
  const playNow = vi.fn(
    async (
      _token?: string,
      _opts?: {
        cancelPending?: boolean
        volume?: number
        maxDurationSec?: number
        holdSession?: boolean
      },
    ) => ({
      played: true,
    }),
  )
  const vibrateNative = vi.fn(async () => {})
  const playAudio = vi.fn((_url: string, _gain: number) => {})

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    schedule.mockClear()
    cancel.mockClear()
    preview.mockClear()
    playNow.mockClear()
    vibrateNative.mockClear()
    playAudio.mockClear()
    __resetRestTimerSoundTestHooks()
    __setRestTimerSoundTestHooks({
      schedule,
      cancel,
      preview,
      playNow,
      vibrateNative,
      playAudio,
      loadPrefs: loadRestTimerSoundPrefs,
    })
  })

  afterEach(() => {
    __resetRestTimerSoundTestHooks()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('countdownBeeps true par défaut', () => {
    expect(getRestTimerSoundPrefs().countdownBeeps).toBe(true)
    expect(DEFAULT_REST_TIMER_SOUND_PREFS.countdownBeeps).toBe(true)
  })

  it('schedule passe haptics + soundEnabled', async () => {
    const endAt = Date.now() + 90_000
    await scheduleRestTimerSound(endAt)
    expect(schedule).toHaveBeenCalledTimes(1)
    expect(schedule.mock.calls[0]?.[0]).toMatchObject({
      endAtMs: endAt,
      soundEnabled: true,
      haptics: true,
    })
  })

  it('schedule puis cancel sur Reprendre (skip)', async () => {
    const endAt = Date.now() + 90_000
    await scheduleRestTimerSound(endAt)
    expect(schedule).toHaveBeenCalledTimes(1)
    expect(schedule.mock.calls[0]?.[0]?.endAtMs).toBe(endAt)

    await cancelRestTimerSound()
    expect(cancel).toHaveBeenCalled()

    await onRestTimerSoundComplete()
    // Token annulé → pas de playNow (pas de son après Reprendre).
    expect(playNow).not.toHaveBeenCalled()
    expect(playAudio).not.toHaveBeenCalled()
  })

  it('reprogrammation sur +15 s', async () => {
    const end1 = Date.now() + 60_000
    await scheduleRestTimerSound(end1)
    const end2 = Date.now() + 75_000
    await rescheduleRestTimerSound(end2)
    expect(cancel).toHaveBeenCalled()
    expect(schedule).toHaveBeenCalledTimes(2)
    expect(schedule.mock.calls[1]?.[0]?.endAtMs).toBe(end2)
  })

  it('pas de double son à la fin', async () => {
    const endAt = Date.now() + 5_000
    await scheduleRestTimerSound(endAt)
    await onRestTimerSoundComplete()
    await onRestTimerSoundComplete()
    // Web path uses playAudio once (token already played).
    expect(playAudio).toHaveBeenCalledTimes(1)
    expect(playAudio.mock.calls[0]?.[1]).toBeLessThanOrEqual(1)
  })

  it('fin de repos → vibration web même avec son actif', async () => {
    const vibrateSpy = vi.spyOn(await import('./haptics'), 'vibrate')
    const endAt = Date.now() + 5_000
    await scheduleRestTimerSound(endAt)
    await onRestTimerSoundComplete()
    expect(playAudio).toHaveBeenCalled()
    expect(vibrateSpy).toHaveBeenCalled()
    // Complete path keeps countdown session until final chime.
    expect(cancel.mock.calls.some((c) => c[0]?.releaseSession === false)).toBe(true)
    vibrateSpy.mockRestore()
  })

  it('fin de repos iOS → vibrateNative même avec son actif', async () => {
    __setRestTimerSoundTestHooks({
      schedule,
      cancel,
      preview,
      playNow,
      vibrateNative,
      playAudio,
      loadPrefs: loadRestTimerSoundPrefs,
      isNativeIos: () => true,
    })
    const endAt = Date.now() + 5_000
    await scheduleRestTimerSound(endAt)
    await onRestTimerSoundComplete()
    expect(playNow).toHaveBeenCalled()
    expect(playNow.mock.calls.some((c) => c[1]?.holdSession === false)).toBe(true)
    expect(vibrateNative).toHaveBeenCalledTimes(1)
    expect(cancel.mock.calls.some((c) => c[0]?.releaseSession === false)).toBe(true)
  })

  it('countdown iOS → holdSession true sur bips 3-2-1', async () => {
    __setRestTimerSoundTestHooks({
      schedule,
      cancel,
      preview,
      playNow,
      vibrateNative,
      playAudio,
      loadPrefs: loadRestTimerSoundPrefs,
      isNativeIos: () => true,
    })
    const endAt = Date.now() + 10_000
    await scheduleRestTimerSound(endAt)
    await maybePlayCountdownBeep(3)
    await maybePlayCountdownBeep(2)
    await maybePlayCountdownBeep(1)
    expect(playNow).toHaveBeenCalledTimes(3)
    for (const call of playNow.mock.calls) {
      expect(call[1]?.holdSession).toBe(true)
      expect(call[1]?.cancelPending).toBe(false)
      expect(call[1]?.maxDurationSec).toBeLessThanOrEqual(0.2)
    }
  })

  it('son coupé → pas d’audio mais vibration', async () => {
    setRestTimerSoundEnabled(false)
    const endAt = Date.now() + 5_000
    await scheduleRestTimerSound(endAt)
    expect(schedule.mock.calls[0]?.[0]?.soundEnabled).toBe(false)

    const vibrateSpy = vi.spyOn(await import('./haptics'), 'vibrate')
    await onRestTimerSoundComplete()
    expect(playAudio).not.toHaveBeenCalled()
    expect(vibrateSpy).toHaveBeenCalled()
    vibrateSpy.mockRestore()
  })

  it('preview appelle le chime (Écouter)', async () => {
    await previewRestTimerSound()
    // Web: playAudio ; native would call preview mock — stub Capacitor absent → audio.
    expect(playAudio).toHaveBeenCalled()
    expect(playAudio.mock.calls[0]?.[1]).toBeLessThanOrEqual(1)
  })

  it('prefs persistées (choix gardé)', () => {
    setRestTimerSoundEnabled(false)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    saveRestTimerSoundPrefs({
      soundEnabled: false,
      countdownBeeps: false,
      haptics: true,
    })
    expect(loadRestTimerSoundPrefs().soundEnabled).toBe(false)
  })

  it('countdownBeeps on → bips à 3/2/1 puis désactivable', async () => {
    const endAt = Date.now() + 10_000
    await scheduleRestTimerSound(endAt)
    await maybePlayCountdownBeep(3)
    await maybePlayCountdownBeep(2)
    await maybePlayCountdownBeep(1)
    expect(playAudio).toHaveBeenCalledTimes(3)

    setRestTimerCountdownBeeps(false)
    playAudio.mockClear()
    await maybePlayCountdownBeep(3)
    expect(playAudio).not.toHaveBeenCalled()
  })

  it('countdownBeeps off → aucun bip à 3/2/1', async () => {
    setRestTimerCountdownBeeps(false)
    const endAt = Date.now() + 10_000
    await scheduleRestTimerSound(endAt)
    await maybePlayCountdownBeep(3)
    await maybePlayCountdownBeep(2)
    await maybePlayCountdownBeep(1)
    expect(playAudio).not.toHaveBeenCalled()
  })
})
