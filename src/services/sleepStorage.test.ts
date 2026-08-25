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

  it('rejette TST > TIB (23:00→07:00 = 8 h, TST 9 h interdit)', async () => {
    const { saveSleepNight, getSleepLog } = await import('./sleepStorage')
    expect(
      saveSleepNight(
        { bedtime: '23:00', waketime: '07:00', tstHours: 9, dateKey: '2026-08-25' },
        { skipCloud: true },
      ),
    ).toBeNull()
    expect(getSleepLog()).toEqual([])
  })

  it('accepte TST = TIB (8 h pour 23:00→07:00)', async () => {
    const { saveSleepNight, getLatestSleepNight } = await import('./sleepStorage')
    const saved = saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 8, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    expect(saved).not.toBeNull()
    expect(getLatestSleepNight()?.tstHours).toBe(8)
  })

  it('accepte TST < TIB', async () => {
    const { saveSleepNight, getLatestSleepNight } = await import('./sleepStorage')
    const saved = saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 7.2, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    expect(saved?.tstHours).toBe(7.2)
    expect(getLatestSleepNight()?.tstHours).toBe(7.2)
  })

  it('accepte TST inconnu (null) sans inventer depuis le TIB', async () => {
    const { saveSleepNight, getLatestSleepNight } = await import('./sleepStorage')
    const saved = saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: null, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    expect(saved).not.toBeNull()
    expect(saved?.tstHours).toBeNull()
    expect(getLatestSleepNight()?.tstHours).toBeNull()
    expect(getLatestSleepNight()?.bedtime).toBe('23:00')
    expect(getLatestSleepNight()?.waketime).toBe('07:00')
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

  it('TST inconnu → TIB affiché, pas de faux heures dormies ni statut quantité', async () => {
    const { saveSleepNight } = await import('./sleepStorage')
    const { getSleepHomeSnapshot, formatTstHoursLabel } = await import('./sleepEngineAdapter')

    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: null, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.hasData).toBe(true)
    expect(snap.tstKnown).toBe(false)
    expect(snap.tstHours).toBeNull()
    expect(snap.tstLabel).toBeNull()
    expect(snap.statusKey).toBeNull()
    expect(snap.statusLabel).toBeNull()
    expect(snap.engine).toBeNull()
    expect(snap.tibHours).toBe(8)
    expect(snap.tibLabel).toBe(formatTstHoursLabel(8))
    expect(snap.recommendations.some((r) => /inconnu/i.test(r))).toBe(true)
  })

  it('workdayTstHours ignore les nuits sans TST (pas de 0 inventé)', async () => {
    const { saveSleepNight } = await import('./sleepStorage')
    const { getSleepHomeSnapshot } = await import('./sleepEngineAdapter')

    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: null, dateKey: '2026-08-23' },
      { skipCloud: true },
    )
    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 8, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.tstKnown).toBe(true)
    expect(snap.statusKey).toBe('optimal')
    expect(snap.engine?.ok).toBe(true)
    // Catch-up ne doit pas traiter null comme 0 h dormies
    expect(snap.engine?.metrics.catchUp.workdayAverageTstHours).not.toBe(0)
  })
})
