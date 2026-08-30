import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BOTTLE_CAPACITY_ML,
  clampBottleRemainingMl,
  deriveBottleProgress,
  resolveBottleVisual,
} from './deriveBottleProgress'

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

vi.stubGlobal('window', {
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

vi.mock('../services/cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

const getActiveCloudUserId = vi.fn(() => null as string | null)

vi.mock('../services/cloudSession', () => ({
  getActiveCloudUserId: () => getActiveCloudUserId(),
}))

vi.mock('../services/trainingStorage', () => ({
  getTrainingState: vi.fn(() => ({
    schedule: [],
    completed: [],
    workoutNotes: [],
  })),
}))

const GOAL = 2900
const CAP = BOTTLE_CAPACITY_ML

describe('waterBottleCalibration — stockage', () => {
  beforeEach(() => {
    store.clear()
    getActiveCloudUserId.mockReturnValue(null)
    vi.resetModules()
  })

  async function setup() {
    const storage = await import('../services/nutritionStorage')
    return storage
  }

  it('1 — calibrer à 1 000 ml restants ne change pas le total consommé', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 500, type: 'glass', label: 'Verre' }, { skipCloud: true })
    expect(storage.getTodayWaterMl()).toBe(500)

    storage.setTodayWaterBottleCalibration(1000, { skipCloud: true })
    expect(storage.getTodayWaterMl()).toBe(500)
    expect(storage.getTodayJournal().waterBottleCalibrationTotalMl).toBe(500)
    expect(storage.getTodayJournal().waterBottleLevelMl).toBe(500)
  })

  it('2 — calibrage ne crée aucune waterEntry', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 500, type: 'glass', label: 'Verre' }, { skipCloud: true })
    const before = storage.getTodayWaterEntries().length

    storage.setTodayWaterBottleCalibration(1000, { skipCloud: true })

    expect(storage.getTodayWaterEntries().length).toBe(before)
    expect(storage.getTodayWaterEntries().every((e) => e.type !== 'manual' || e.label !== 'Calibrage')).toBe(
      true,
    )
  })

  it('3 — après +250 ml, le niveau calibré diminue de 250 ml (restants)', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 500, type: 'glass', label: 'Verre' }, { skipCloud: true })
    storage.setTodayWaterBottleCalibration(1000, { skipCloud: true })

    const journal = storage.getTodayJournal()
    const before = resolveBottleVisual(500, GOAL, {
      bottleLevelMl: journal.waterBottleLevelMl,
      calibrationTotalMl: journal.waterBottleCalibrationTotalMl,
    })
    expect(CAP - before.activeMl).toBe(1000)

    storage.addWaterEntry({ amountMl: 250, type: 'glass', label: 'Verre' }, { skipCloud: true })
    const after = resolveBottleVisual(storage.getTodayWaterMl(), GOAL, {
      bottleLevelMl: storage.getTodayJournal().waterBottleLevelMl,
      calibrationTotalMl: storage.getTodayJournal().waterBottleCalibrationTotalMl,
    })
    expect(storage.getTodayWaterMl()).toBe(750)
    expect(CAP - after.activeMl).toBe(750)
  })

  it('4 — miniatures restent floor(consumedMl / 1500)', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 500, type: 'glass', label: 'Verre' }, { skipCloud: true })
    storage.setTodayWaterBottleCalibration(1000, { skipCloud: true })
    storage.addWaterEntry({ amountMl: 1000, type: 'bottle', label: 'Bouteille' }, { skipCloud: true })

    const consumed = storage.getTodayWaterMl()
    expect(consumed).toBe(1500)
    const visual = resolveBottleVisual(consumed, GOAL, {
      bottleLevelMl: storage.getTodayJournal().waterBottleLevelMl,
      calibrationTotalMl: storage.getTodayJournal().waterBottleCalibrationTotalMl,
    })
    expect(visual.completedCount).toBe(Math.floor(consumed / CAP))
    expect(visual.completedCount).toBe(1)
  })

  it('5 — correction journal vers le bas ne crée pas de valeur négative', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 750, type: 'shaker', label: 'Shaker' }, { skipCloud: true })
    storage.setTodayWaterBottleCalibration(1000, { skipCloud: true })

    storage.setWaterTotalFromGauge(500, { skipCloud: true })
    const visual = resolveBottleVisual(500, GOAL, {
      bottleLevelMl: storage.getTodayJournal().waterBottleLevelMl,
      calibrationTotalMl: storage.getTodayJournal().waterBottleCalibrationTotalMl,
    })
    expect(visual.activeMl).toBeGreaterThanOrEqual(0)
    expect(CAP - visual.activeMl).toBeLessThanOrEqual(CAP)
    // Correction vers le bas → le liquide restant remonte (750 → 500 enregistré : +250 ml restants)
    expect(CAP - visual.activeMl).toBe(1250)
  })

  it('6 — Revenir au suivi automatique restaure deriveBottleProgress', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 500, type: 'glass', label: 'Verre' }, { skipCloud: true })
    storage.setTodayWaterBottleCalibration(1000, { skipCloud: true })
    storage.clearTodayWaterBottleCalibration({ skipCloud: true })

    const consumed = storage.getTodayWaterMl()
    const auto = deriveBottleProgress(consumed, GOAL, CAP)
    const visual = resolveBottleVisual(consumed, GOAL, {
      bottleLevelMl: storage.getTodayJournal().waterBottleLevelMl,
      calibrationTotalMl: storage.getTodayJournal().waterBottleCalibrationTotalMl,
    })
    expect(visual.activeMl).toBe(auto.activeMl)
    expect(storage.isTodayWaterBottleCalibrated()).toBe(false)
  })

  it('7 — ancien waterBottleLevelMl seul reste lisible (legacy)', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 200, type: 'glass', label: 'Verre' }, { skipCloud: true })
    storage.setTodayWaterBottleLevel(400, { skipCloud: true })

    const visual = resolveBottleVisual(200, GOAL, {
      bottleLevelMl: storage.getTodayJournal().waterBottleLevelMl,
      calibrationTotalMl: storage.getTodayJournal().waterBottleCalibrationTotalMl,
    })
    expect(visual.activeMl).toBe(400)
  })

  it('8 — calibrage isolé entre utilisateur anonyme et compte connecté', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 300, type: 'glass', label: 'Verre' }, { skipCloud: true })
    storage.setTodayWaterBottleCalibration(1200, { skipCloud: true })
    expect(storage.isTodayWaterBottleCalibrated()).toBe(true)

    getActiveCloudUserId.mockReturnValue('user-abc')
    vi.resetModules()
    const storageUser = await import('../services/nutritionStorage')
    expect(storageUser.isTodayWaterBottleCalibrated()).toBe(false)

    storageUser.addWaterEntry({ amountMl: 100, type: 'glass', label: 'Verre' }, { skipCloud: true })
    storageUser.setTodayWaterBottleCalibration(800, { skipCloud: true })
    expect(storageUser.isTodayWaterBottleCalibrated()).toBe(true)
    expect(storageUser.getTodayWaterMl()).toBe(100)

    getActiveCloudUserId.mockReturnValue(null)
    vi.resetModules()
    const storageAnon = await import('../services/nutritionStorage')
    expect(storageAnon.isTodayWaterBottleCalibrated()).toBe(true)
    expect(storageAnon.getTodayWaterMl()).toBe(300)
  })

  it('9 — changement de jour : aucun calibrage de la veille réutilisé', async () => {
    const storage = await setup()
    const { todayKey } = await import('./calories')

    storage.addWaterEntry({ amountMl: 400, type: 'glass', label: 'Verre' }, { skipCloud: true })
    storage.setTodayWaterBottleCalibration(1100, { skipCloud: true })

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yKey = todayKey(yesterday)
    const journals = storage.getMealJournal()
    journals[yKey] = {
      dateKey: yKey,
      meals: [],
      waterMl: 600,
      waterBottleLevelMl: 300,
      waterBottleCalibrationTotalMl: 600,
    }
    storage.saveMealJournal(journals, { skipCloud: true })

    expect(storage.isTodayWaterBottleCalibrated()).toBe(true)
    const todayJournal = storage.getTodayJournal()
    expect(todayJournal.dateKey).not.toBe(yKey)
    expect(todayJournal.waterBottleCalibrationTotalMl).toBe(400)
  })
})

describe('waterBottleCalibration — normalisation', () => {
  it('10 — NaN, Infinity, négatif ou > 1 500 ml normalisés', () => {
    expect(clampBottleRemainingMl(NaN)).toBe(0)
    expect(clampBottleRemainingMl(Infinity)).toBe(0)
    expect(clampBottleRemainingMl(-100)).toBe(0)
    expect(clampBottleRemainingMl(2000)).toBe(CAP)
    expect(clampBottleRemainingMl(1003)).toBe(1000)

    const visual = resolveBottleVisual(500, GOAL, {
      bottleLevelMl: NaN,
      calibrationTotalMl: 500,
    })
    expect(visual.activeMl).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(visual.activeMl)).toBe(true)
  })
})

describe('waterBottleCalibration — Nutrition Engine inchangé', () => {
  it('11 — aucun changement des macros / calories', async () => {
    const { runNutritionEngine, serializeEngineResult } = await import('../nutrition-engine')
    const input = {
      sex: 'male' as const,
      age: 18,
      weight_kg: 61.7,
      height_m: 1.7,
      activity: 4 as const,
      goal: 'bulk' as const,
      deficit_kcal: 0,
      surplus_kcal: 550,
      sport_principal: 'musculation' as const,
      sport_secondaire: null,
      duration_h: 0,
      intensity: null,
      effort_weight_loss_kg: 0,
      effort_fluid_loss_l: 0,
    }
    const result = runNutritionEngine(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const s = serializeEngineResult(result)
    expect(s.target_kcal).toBe(3851)
    expect(s.proteines_g).toBe(135.7)
  })
})

describe('resolveBottleVisual — scénario utilisateur', () => {
  it('exemple : 500 ml enregistrés, calibré 1 000 restants, +250 → 750 restants', () => {
    expect(CAP - resolveBottleVisual(500, GOAL, {
      bottleLevelMl: 500,
      calibrationTotalMl: 500,
    }).activeMl).toBe(1000)

    const after = resolveBottleVisual(750, GOAL, {
      bottleLevelMl: 500,
      calibrationTotalMl: 500,
    })
    expect(CAP - after.activeMl).toBe(750)
    expect(after.completedCount).toBe(0)
  })

  it('bouteille calibrée terminée → cycle visuel repart plein, miniature factuelle', () => {
    const visual = resolveBottleVisual(2000, GOAL, {
      bottleLevelMl: 500,
      calibrationTotalMl: 500,
    })
    expect(visual.completedCount).toBe(1)
    expect(visual.activeMl).toBe(500)
    expect(CAP - visual.activeMl).toBe(1000)
  })
})
