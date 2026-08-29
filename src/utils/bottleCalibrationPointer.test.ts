import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clampRemainingMl,
  nudgeRemainingMl,
  remainingMlFromKey,
  remainingMlFromPointerY,
} from './bottleCalibrationPointer'
import { WATER_BOTTLE_CAPACITY_ML } from '../services/nutritionStorage'

const CAP = WATER_BOTTLE_CAPACITY_ML
const RECT = { top: 100, bottom: 400, height: 300 }

describe('bottleCalibrationPointer — calcul et protections', () => {
  it('mappe haut, milieu et bas sur le volume restant', () => {
    expect(remainingMlFromPointerY(100, RECT, CAP)).toBe(1500)
    expect(remainingMlFromPointerY(250, RECT, CAP)).toBe(750)
    expect(remainingMlFromPointerY(400, RECT, CAP)).toBe(0)
  })

  it('borne les positions hors bouteille et arrondit par pas configurable', () => {
    expect(remainingMlFromPointerY(40, RECT, CAP)).toBe(1500)
    expect(remainingMlFromPointerY(460, RECT, CAP)).toBe(0)
    expect(remainingMlFromPointerY(199, RECT, CAP) % 10).toBe(0)
    expect(clampRemainingMl(126, CAP, 25)).toBe(125)
  })

  it('valide les capacités NaN, Infinity, négatives ou nulles', () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0]) {
      expect(clampRemainingMl(2000, invalid)).toBe(CAP)
      expect(remainingMlFromPointerY(100, RECT, invalid)).toBe(CAP)
    }
    expect(clampRemainingMl(Number.NaN)).toBe(0)
    expect(clampRemainingMl(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('gère toutes les touches du slider et ses bornes', () => {
    expect(remainingMlFromKey(750, 'ArrowUp')).toBe(800)
    expect(remainingMlFromKey(750, 'ArrowRight')).toBe(800)
    expect(remainingMlFromKey(750, 'ArrowDown')).toBe(700)
    expect(remainingMlFromKey(750, 'ArrowLeft')).toBe(700)
    expect(remainingMlFromKey(750, 'Home')).toBe(0)
    expect(remainingMlFromKey(750, 'End')).toBe(CAP)
    expect(remainingMlFromKey(750, 'Enter')).toBeNull()
    expect(nudgeRemainingMl(20, -50)).toBe(0)
    expect(nudgeRemainingMl(1480, 50)).toBe(CAP)
  })

  it('ne modifie pas le rectangle reçu', () => {
    const rect = { ...RECT }
    expect(remainingMlFromPointerY(250, rect, CAP)).toBe(750)
    expect(rect).toEqual(RECT)
  })

  it('reste sûr avec des dimensions et coordonnées invalides', () => {
    expect(remainingMlFromPointerY(100, { top: 100, bottom: 100, height: 0 })).toBe(0)
    expect(remainingMlFromPointerY(100, { top: 100, height: Number.NaN })).toBe(0)
    expect(remainingMlFromPointerY(Number.NaN, RECT)).toBe(0)
  })
})

describe('bottleCalibrationPointer — aucune mutation du journal pendant le drag', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.resetModules()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    })
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.doMock('../services/cloudBackup', () => ({ notifyLocalDataChanged: vi.fn() }))
    vi.doMock('../services/cloudSession', () => ({ getActiveCloudUserId: () => null }))
    vi.doMock('../services/trainingStorage', () => ({
      getTrainingState: vi.fn(() => ({ schedule: [], completed: [], workoutNotes: [] })),
    }))
  })

  it('preview sans écriture ; Enregistrer calibre ; retour automatique préserve les entrées', async () => {
    const storage = await import('../services/nutritionStorage')
    storage.addWaterEntry({ amountMl: 400, type: 'glass', label: 'Verre' }, { skipCloud: true })
    const beforeMl = storage.getTodayWaterMl()
    const beforeEntries = storage.getTodayWaterEntries()
    const beforeJournal = { ...storage.getTodayJournal() }

    const preview = remainingMlFromPointerY(RECT.top + 40, RECT, CAP)
    expect(storage.getTodayWaterMl()).toBe(beforeMl)
    expect(storage.getTodayWaterEntries()).toEqual(beforeEntries)
    expect(storage.getTodayJournal().waterBottleLevelMl).toBe(beforeJournal.waterBottleLevelMl)
    expect(storage.getTodayJournal().waterBottleCalibrationTotalMl).toBe(
      beforeJournal.waterBottleCalibrationTotalMl,
    )

    storage.setTodayWaterBottleCalibration(preview, { skipCloud: true })
    expect(storage.getTodayWaterMl()).toBe(beforeMl)
    expect(storage.getTodayWaterEntries()).toEqual(beforeEntries)
    expect(storage.isTodayWaterBottleCalibrated()).toBe(true)

    storage.clearTodayWaterBottleCalibration({ skipCloud: true })
    expect(storage.isTodayWaterBottleCalibrated()).toBe(false)
    expect(storage.getTodayJournal().waterBottleCalibrationTotalMl).toBeUndefined()
    expect(storage.getTodayJournal().waterBottleLevelMl).toBeUndefined()
    expect(storage.getTodayWaterMl()).toBe(beforeMl)
    expect(storage.getTodayWaterEntries()).toEqual(beforeEntries)
  })
})
