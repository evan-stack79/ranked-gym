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
  setRestTimerSoundEnabled,
} from './restTimerSound'

const STORAGE_KEY = 'ranked-gym:rest-timer-sound-prefs'

describe('restTimerSound', () => {
  const schedule = vi.fn(
    async (_opts: { endAtMs: number; soundEnabled: boolean; token: string }) => ({
      scheduled: true as boolean,
      permission: true as boolean,
    }),
  )
  const cancel = vi.fn(async () => {})
  const preview = vi.fn(async () => {})
  const playNow = vi.fn(async (_token?: string, _opts?: { cancelPending?: boolean }) => ({
    played: true,
  }))
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

  it('countdownBeeps off par défaut', () => {
    expect(getRestTimerSoundPrefs().countdownBeeps).toBe(false)
    expect(DEFAULT_REST_TIMER_SOUND_PREFS.countdownBeeps).toBe(false)
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

  it('son coupé → pas d’audio mais vibration', async () => {
    setRestTimerSoundEnabled(false)
    const endAt = Date.now() + 5_000
    await scheduleRestTimerSound(endAt)
    expect(schedule.mock.calls[0]?.[0]?.soundEnabled).toBe(false)

    const vibrateSpy = vi.spyOn(
      await import('./haptics'),
      'vibrate',
    )
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

  it('countdownBeeps off → aucun bip à 3/2/1', async () => {
    const endAt = Date.now() + 10_000
    await scheduleRestTimerSound(endAt)
    await maybePlayCountdownBeep(3)
    await maybePlayCountdownBeep(2)
    await maybePlayCountdownBeep(1)
    expect(playAudio).not.toHaveBeenCalled()
  })
})
