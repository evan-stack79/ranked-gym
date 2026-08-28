import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSleepHomeSnapshot } from '../services/sleepEngineAdapter'
import { saveSleepNight } from '../services/sleepStorage'
import {
  compactHomeQuantityStatusLabel,
  getSleepHomeCompactView,
} from './sleepHomeCompact'

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
})

vi.mock('../services/cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('../services/cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

describe('sleepHomeCompact', () => {
  beforeEach(() => {
    store.clear()
  })

  it('aucune nuit → bouton Enregistrer', () => {
    const snap = getSleepHomeSnapshot()
    const view = getSleepHomeCompactView(snap)
    expect(view.action).toBe('log')
    expect(view.actionLabel).toBe('Enregistrer')
    expect(view.secondaryLine).toBe('Comment était ta nuit ?')
  })

  it('TST connu → dormies dans le résumé', () => {
    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 7.7, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    const view = getSleepHomeCompactView(snap)
    expect(view.action).toBe('details')
    expect(view.actionLabel).toBe('Voir')
    expect(view.secondaryLine).toContain('dormies')
    expect(view.secondaryLine).toContain('7 h 42')
    expect(view.secondaryLine).not.toContain('au lit')
  })

  it('TIB connu sans TST → au lit et jamais dormies', () => {
    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: null, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    const view = getSleepHomeCompactView(snap)
    expect(view.secondaryLine).toContain('au lit')
    expect(view.secondaryLine).toContain('Sommeil non estimé')
    expect(view.secondaryLine).not.toMatch(/dormies/i)
  })

  it('déficit réel → libellé neutre Nuit courte', () => {
    saveSleepNight(
      { bedtime: '00:30', waketime: '06:45', tstHours: 6.25, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.statusKey).toBe('deficit')
    const view = getSleepHomeCompactView(snap)
    expect(view.secondaryLine).toContain('6 h 15 dormies')
    expect(view.secondaryLine).toContain('Nuit courte')
    expect(compactHomeQuantityStatusLabel('deficit')).toBe('Nuit courte')
  })

  it('bouton Voir quand des données existent', () => {
    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 8, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const view = getSleepHomeCompactView(getSleepHomeSnapshot())
    expect(view.action).toBe('details')
    expect(view.actionLabel).toBe('Voir')
  })

  it('bouton Enregistrer sans nuit', () => {
    const view = getSleepHomeCompactView(getSleepHomeSnapshot())
    expect(view.action).toBe('log')
    expect(view.actionLabel).toBe('Enregistrer')
  })

  it('informations détaillées toujours dans le snapshot pour la sheet', () => {
    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 8, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.tonightHint).toBeTruthy()
    expect(snap.insufficientHistory).toBe(true)
    expect(snap.recommendations.length).toBeGreaterThan(0)
    expect(snap.engine?.ok).toBe(true)
  })

  it('ne modifie pas les résultats du moteur', () => {
    saveSleepNight(
      { bedtime: '23:00', waketime: '07:00', tstHours: 6, dateKey: '2026-08-25' },
      { skipCloud: true },
    )
    const snap = getSleepHomeSnapshot()
    expect(snap.statusKey).toBe('deficit')
    expect(snap.tstHours).toBe(6)
    expect(snap.engine?.metrics.quantity.tstHours).toBe(6)
    expect(snap.engine?.status).toBe('deficit')
  })
})
