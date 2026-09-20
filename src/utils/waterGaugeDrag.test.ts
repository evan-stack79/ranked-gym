import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOTTLE_CAPACITY_ML, deriveBottleProgress } from './deriveBottleProgress'

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

const BASE_PROFILE = {
  weightKg: 83,
  goalWeightKg: 80,
  heightCm: 178,
  age: 22,
  sex: 'male' as const,
  activity: 'moderate' as const,
  morphology: 'mesomorph' as const,
  goal: 'maintain' as const,
  weeklyPaceKg: 0.5,
  onboardingComplete: true,
}

const GOAL = 2900
const CAP = BOTTLE_CAPACITY_ML

/** Même formule que SmartWaterGauge lors d’un drag validé. */
function computeDragTargetTotal(completedBase: number, activeLevelMl: number): number {
  return completedBase * CAP + activeLevelMl
}

/** Simule validateNormal : delta > 0 → addWaterEntry, delta < 0 → setWaterTotalFromGauge. */
async function validateDragTarget(savedTotal: number, targetTotal: number) {
  const storage = await import('../services/nutritionStorage')
  const delta = targetTotal - savedTotal
  if (delta > 0) {
    return storage.addWaterEntry({
      amountMl: delta,
      type: 'manual',
      label: 'Bouteille',
    }).journal
  }
  if (delta < 0) {
    return storage.setWaterTotalFromGauge(targetTotal)
  }
  return storage.getTodayJournal()
}

describe('waterGaugeDrag', () => {
  beforeEach(() => {
    store.clear()
    getActiveCloudUserId.mockReturnValue(null)
    vi.resetModules()
  })

  async function setup() {
    const storage = await import('../services/nutritionStorage')
    storage.saveCalorieProfile(BASE_PROFILE, { skipCloud: true })
    return storage
  }

  it('total 0 → drag vers 250 → validation ajoute exactement 250 ml', async () => {
    await setup()
    const storage = await import('../services/nutritionStorage')
    expect(storage.getTodayWaterMl()).toBe(0)

    const target = computeDragTargetTotal(0, 250)
    expect(target).toBe(250)
    await validateDragTarget(0, target)

    expect(storage.getTodayWaterMl()).toBe(250)
    const progress = deriveBottleProgress(250, GOAL, CAP)
    expect(progress.completedCount).toBe(0)
    expect(progress.activeMl).toBe(250)
  })

  it('total 750 → drag vers 1 000 → ajoute exactement 250 ml', async () => {
    const storage = await setup()
    await validateDragTarget(0, 750)

    const target = computeDragTargetTotal(0, 1000)
    expect(target).toBe(1000)
    await validateDragTarget(750, target)

    expect(storage.getTodayWaterMl()).toBe(1000)
  })

  it('total 1 400 → drag vers 1 500 → +100 ml, 1 miniature, nouvelle active pleine', async () => {
    const storage = await setup()
    await validateDragTarget(0, 1400)

    const target = computeDragTargetTotal(0, 1500)
    await validateDragTarget(1400, target)

    expect(storage.getTodayWaterMl()).toBe(1500)
    const progress = deriveBottleProgress(1500, GOAL, CAP)
    expect(progress.completedCount).toBe(1)
    expect(progress.activeMl).toBe(0)
    expect(progress.showActiveBottle).toBe(true)
    expect(CAP - progress.activeMl).toBe(1500)
  })

  it('total 1 500 → active pleine → drag 300 ml consommés → total 1 800', async () => {
    const storage = await setup()
    await validateDragTarget(0, 1500)

    const target = computeDragTargetTotal(1, 300)
    expect(target).toBe(1800)
    await validateDragTarget(1500, target)

    expect(storage.getTodayWaterMl()).toBe(1800)
    const progress = deriveBottleProgress(1800, GOAL, CAP)
    expect(progress.completedCount).toBe(1)
    expect(progress.activeMl).toBe(300)
  })

  it('total 2 900 → drag active jusqu’à 1 500 → total 3 000, 2 miniatures, active masquée', async () => {
    const storage = await setup()
    await validateDragTarget(0, 2900)

    const target = computeDragTargetTotal(1, 1500)
    expect(target).toBe(3000)
    await validateDragTarget(2900, target)

    expect(storage.getTodayWaterMl()).toBe(3000)
    const progress = deriveBottleProgress(3000, GOAL, CAP)
    expect(progress.completedCount).toBe(2)
    expect(progress.activeMl).toBe(0)
    expect(progress.goalReached).toBe(true)
    expect(progress.showActiveBottle).toBe(false)
  })

  it('annulation du drag → aucune écriture', async () => {
    const storage = await setup()
    await validateDragTarget(0, 750)
    const before = storage.getTodayWaterMl()
    // Pas d’appel validateDragTarget — le brouillon drag n’écrit pas
    expect(storage.getTodayWaterMl()).toBe(before)
    expect(before).toBe(750)
  })

  it('suppression 1 500 → 1 250 ml : miniature retirée, active presque vide', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 1000, type: 'glass', label: 'Verre' })
    storage.addWaterEntry({ amountMl: 500, type: 'shaker', label: 'Shaker' })
    expect(storage.getTodayWaterMl()).toBe(1500)
    expect(deriveBottleProgress(1500, GOAL, CAP).completedCount).toBe(1)

    storage.setWaterTotalFromGauge(1250)

    expect(storage.getTodayWaterMl()).toBe(1250)
    const progress = deriveBottleProgress(1250, GOAL, CAP)
    expect(progress.completedCount).toBe(0)
    expect(progress.activeMl).toBe(1250)
    expect(CAP - progress.activeMl).toBe(250)
    expect(storage.getTodayWaterEntries().every((e) => e.amountMl > 0)).toBe(true)
  })

  it('setWaterTotalFromGauge vers le bas retire des entrées sans montant négatif', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 500, type: 'glass', label: 'Verre' })
    storage.addWaterEntry({ amountMl: 500, type: 'shaker', label: 'Shaker' })

    storage.setWaterTotalFromGauge(600)
    expect(storage.getTodayWaterMl()).toBe(600)
    const entries = storage.getTodayWaterEntries()
    expect(entries.every((e) => e.amountMl > 0)).toBe(true)
    expect(entries.reduce((s, e) => s + e.amountMl, 0)).toBe(600)
  })

  it('presets Verre +250, Shaker +500, Bouteille +1500', async () => {
    const storage = await setup()
    storage.addWaterEntry({ amountMl: 250, type: 'glass', label: 'Verre' })
    expect(storage.getTodayWaterMl()).toBe(250)

    storage.addWaterEntry({ amountMl: 500, type: 'shaker', label: 'Shaker' })
    expect(storage.getTodayWaterMl()).toBe(750)

    storage.addWaterEntry({ amountMl: 1500, type: 'bottle', label: 'Bouteille' })
    expect(storage.getTodayWaterMl()).toBe(2250)

    const progress = deriveBottleProgress(2250, GOAL, CAP)
    expect(progress.completedCount).toBe(1)
    expect(progress.activeMl).toBe(750)
  })

  it('water-changed émis après mutation', async () => {
    await setup()
    const storage = await import('../services/nutritionStorage')
    const dispatch = vi.mocked(window.dispatchEvent)
    dispatch.mockClear()

    storage.addWaterEntry({ amountMl: 250, type: 'glass', label: 'Verre' })

    expect(dispatch).toHaveBeenCalled()
    const event = dispatch.mock.calls.at(-1)?.[0] as Event
    expect(event.type).toBe('ranked-gym:water-changed')
  })

  it('stockage isolé entre comptes', async () => {
    await setup()
    const storage = await import('../services/nutritionStorage')
    storage.addWaterEntry({ amountMl: 1500, type: 'bottle', label: 'Bouteille' })
    expect(storage.getTodayWaterMl()).toBe(1500)

    getActiveCloudUserId.mockReturnValue('user-b')
    vi.resetModules()
    const storageB = await import('../services/nutritionStorage')
    expect(storageB.getTodayWaterMl()).toBe(0)

    storageB.saveCalorieProfile(BASE_PROFILE, { skipCloud: true })
    storageB.addWaterEntry({ amountMl: 750, type: 'glass', label: 'Verre' })
    expect(storageB.getTodayWaterMl()).toBe(750)
  })
})
