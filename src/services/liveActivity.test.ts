/** @vitest-environment jsdom */
/**
 * Pont LiveActivity — fausses clés / mocks, pas de réseau.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.fn(async () => ({ activityId: 'a1', reused: false }))
const update = vi.fn(async () => ({ updated: true }))
const end = vi.fn(async () => {})
const isAvailable = vi.fn(async () => ({ available: true }))
const alert = vi.fn(async () => ({ alerted: true }))
const isNativePlatform = vi.fn(() => true)
const getPlatform = vi.fn(() => 'ios')

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
    getPlatform: () => getPlatform(),
  },
  registerPlugin: () => ({ start, update, end, isAvailable, alert }),
}))

describe('liveActivity bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    start.mockClear()
    update.mockClear()
    end.mockClear()
    isAvailable.mockClear()
    alert.mockClear()
    isAvailable.mockResolvedValue({ available: true })
    isNativePlatform.mockReturnValue(true)
    getPlatform.mockReturnValue('ios')
  })

  it('start/update/end par kind rest', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startRestLiveActivity({
      remainingSec: 90.4,
      totalSec: 90,
      subtitle: 'Squat · Série 2',
    })
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        remainingSec: 90,
        totalSec: 90,
        subtitle: 'Squat · Série 2',
      }),
    )
    await mod.updateRestLiveActivity({ remainingSec: 44.2, paused: true })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rest', remainingSec: 44, paused: true }),
    )
    await mod.endRestLiveActivity(true)
    expect(end).toHaveBeenCalledWith({ immediate: true })
  })

  it('start/update/end par kind session', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startSessionLiveActivity({
      exerciseName: 'Squat',
      setIndex: 2,
      setTotal: 4,
      weightKg: 100,
      reps: 5,
      startedAtMs: 1_700_000_000_000,
    })
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'session',
        exerciseName: 'Squat',
        setIndex: 2,
        setTotal: 4,
        weightKg: 100,
        reps: 5,
      }),
    )
    await mod.updateSessionLiveActivity({ setIndex: 3, weightKg: 102.5, reps: 4 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'session', setIndex: 3, weightKg: 102.5, reps: 4 }),
    )
    await mod.endSessionLiveActivity(true)
    expect(end).toHaveBeenCalledWith({ immediate: true })
  })

  it('une seule activité séance+repos (reuse, pas de 2e start sans reuse)', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startSessionLiveActivity({
      exerciseName: 'Bench',
      setIndex: 1,
      setTotal: 3,
      weightKg: 60,
      reps: 8,
      startedAtMs: 1,
    })
    start.mockClear()
    await mod.startRestLiveActivity({ remainingSec: 90, totalSec: 90, subtitle: 'Bench' })
    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rest',
        reuseIfPresent: true,
        activityToken: 'ranked-gym.session',
      }),
    )
    // Fin repos → retour séance (reuse), pas end.
    end.mockClear()
    start.mockClear()
    await mod.endRestLiveActivity(true)
    expect(end).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'session', reuseIfPresent: true }),
    )
  })

  it('moins de 18 ans sans classement (rank alert bloqué)', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startSessionLiveActivity({
      exerciseName: 'Squat',
      setIndex: 1,
      setTotal: 1,
      weightKg: 40,
      reps: 5,
      startedAtMs: 1,
    })
    alert.mockClear()
    const shown = await mod.showRankLiveAlert({
      alertTitle: 'Nouveau rang',
      alertBody: 'Tu montes',
      age: 17,
    })
    expect(shown).toBe(false)
    expect(alert).not.toHaveBeenCalled()

    const unknown = await mod.showRankLiveAlert({
      alertTitle: 'Nouveau rang',
      alertBody: 'Tu montes',
      age: null,
    })
    expect(unknown).toBe(false)
    expect(alert).not.toHaveBeenCalled()
  })

  it('âge 0 → alerte rang bloquée', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startSessionLiveActivity({
      exerciseName: 'Squat',
      setIndex: 1,
      setTotal: 1,
      weightKg: 40,
      reps: 5,
      startedAtMs: 1,
    })
    alert.mockClear()
    const shown = await mod.showRankLiveAlert({
      alertTitle: 'Nouveau rang',
      alertBody: 'Tu montes',
      age: 0,
    })
    expect(shown).toBe(false)
    expect(alert).not.toHaveBeenCalled()
  })

  it('âge -1 → alerte rang bloquée', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startSessionLiveActivity({
      exerciseName: 'Squat',
      setIndex: 1,
      setTotal: 1,
      weightKg: 40,
      reps: 5,
      startedAtMs: 1,
    })
    alert.mockClear()
    const shown = await mod.showRankLiveAlert({
      alertTitle: 'Nouveau rang',
      alertBody: 'Tu montes',
      age: -1,
    })
    expect(shown).toBe(false)
    expect(alert).not.toHaveBeenCalled()
  })

  it('adulte : alerte rang autorisée 5 s puis retour session', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startSessionLiveActivity({
      exerciseName: 'Squat',
      setIndex: 1,
      setTotal: 1,
      weightKg: 100,
      reps: 5,
      startedAtMs: 1,
    })
    const shown = await mod.showRankLiveAlert({
      alertTitle: 'Nouveau rang',
      alertBody: 'Rang Bronze',
      age: 22,
    })
    expect(shown).toBe(true)
    expect(alert).toHaveBeenCalledWith({
      kind: 'rank',
      alertTitle: 'Nouveau rang',
      alertBody: 'Rang Bronze',
    })
    update.mockClear()
    await vi.advanceTimersByTimeAsync(5000)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ kind: 'session' }))
  })

  it('objectif pas = valeur utilisateur (jamais inventé si goal ≤ 0)', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startOrUpdateStepsLiveActivity({ steps: 1200, stepsGoal: 0 })
    expect(start).not.toHaveBeenCalled()

    await mod.startOrUpdateStepsLiveActivity({ steps: 1200, stepsGoal: 8000 })
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'steps',
        steps: 1200,
        stepsGoal: 8000,
        subtitle: 'Objectif choisi',
      }),
    )
  })

  it('no-ops on web', async () => {
    isNativePlatform.mockReturnValue(false)
    getPlatform.mockReturnValue('web')
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startRestLiveActivity({ remainingSec: 30, totalSec: 30 })
    expect(start).not.toHaveBeenCalled()
  })

  it('record alert sur activité séance', async () => {
    const mod = await import('./liveActivity')
    mod.__resetLiveActivityBridgeForTests()
    await mod.startSessionLiveActivity({
      exerciseName: 'Deadlift',
      setIndex: 1,
      setTotal: 1,
      weightKg: 140,
      reps: 1,
      startedAtMs: 1,
    })
    await mod.showRecordLiveAlert({
      alertTitle: 'Record',
      alertBody: 'Nouveau max 140 kg',
    })
    expect(alert).toHaveBeenCalledWith({
      kind: 'record',
      alertTitle: 'Record',
      alertBody: 'Nouveau max 140 kg',
    })
  })
})
