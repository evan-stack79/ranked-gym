import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v)
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => store.clear(),
})

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

describe('sleepStorage', () => {
  beforeEach(() => {
    store.clear()
  })

  it('retourne null sans données', async () => {
    const { getLatestSleepNight, getSleepLog } = await import('./sleepStorage')
    expect(getSleepLog()).toEqual([])
    expect(getLatestSleepNight()).toBeNull()
  })

  it('enregistre et lit une nuit valide', async () => {
    const { saveSleepNight, getLatestSleepNight } = await import('./sleepStorage')
    const saved = saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 7.5, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    expect(saved).not.toBeNull()
    expect(getLatestSleepNight()?.tstHours).toBe(7.5)
    expect(getLatestSleepNight()?.bedtime).toBe('23:00')
  })

  it('rejette TST invalide sans inventer', async () => {
    const { saveSleepNight, getSleepLog } = await import('./sleepStorage')
    expect(
      saveSleepNight({ bedtime: '23:00', waketime: '07:00', tstHours: -1 }, { skipCloud: true }),
    ).toBeNull()
    expect(getSleepLog()).toEqual([])
  })

  it('remplace la nuit du même dateKey', async () => {
    const { saveSleepNight, getSleepLog } = await import('./sleepStorage')
    saveSleepNight(
      { bedtime: '22:00', waketime: '06:00', tstHours: 7, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    saveSleepNight(
      { bedtime: '23:30', waketime: '07:30', tstHours: 7.5, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    expect(getSleepLog()).toHaveLength(1)
    expect(getSleepLog()[0]?.bedtime).toBe('23:30')
  })
})

describe('sleepEngineAdapter', () => {
  beforeEach(() => {
    store.clear()
  })

  it('sans nuit → hasData false (pas de faux mauvais sommeil)', async () => {
    const { getSleepHomeSnapshot } = await import('./sleepEngineAdapter')
    const snap = getSleepHomeSnapshot()
    expect(snap.hasData).toBe(false)
    expect(snap.statusKey).toBeNull()
    expect(snap.tstLabel).toBeNull()
  })

  it('TST 8 h → optimal + labels Accueil', async () => {
    const { saveSleepNight } = await import('./sleepStorage')
    const { getSleepHomeSnapshot, formatTstHoursLabel, quantityStatusLabel } =
      await import('./sleepEngineAdapter')

    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 8, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.hasData).toBe(true)
    expect(snap.statusKey).toBe('optimal')
    expect(snap.statusLabel).toBe(quantityStatusLabel('optimal'))
    expect(snap.tstLabel).toBe(formatTstHoursLabel(8))
    expect(snap.tonightBedtimeHm).toBeTruthy()
    expect(snap.engine?.ok).toBe(true)
  })

  it('TST 6 h → deficit', async () => {
    const { saveSleepNight } = await import('./sleepStorage')
    const { getSleepHomeSnapshot } = await import('./sleepEngineAdapter')
    saveSleepNight(
      { bedtime: '00:30', waketime: '06:30', tstHours: 6, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.statusKey).toBe('deficit')
    expect(snap.statusLabel).toBe('Sommeil insuffisant')
  })

  it('historique insuffisant signalé sans inventer une mauvaise régularité', async () => {
    const { saveSleepNight } = await import('./sleepStorage')
    const { getSleepHomeSnapshot } = await import('./sleepEngineAdapter')
    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 8, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.insufficientHistory).toBe(true)
  })

  it('moyenne circulaire bedtime autour de minuit', async () => {
    const { circularMeanBedtimeHm } = await import('./sleepEngineAdapter')
    const mean = circularMeanBedtimeHm(['23:30', '00:30'])
    expect(mean).toBe('00:00')
  })
})
