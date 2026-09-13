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
  weightKg: 75,
  goalWeightKg: 72,
  heightCm: 178,
  age: 22,
  sex: 'male' as const,
  activity: 'moderate' as const,
  morphology: 'mesomorph' as const,
  goal: 'maintain' as const,
  weeklyPaceKg: 0.5,
  onboardingComplete: true,
}

describe('homeNutritionQuickActions', () => {
  beforeEach(() => {
    store.clear()
    getActiveCloudUserId.mockReturnValue(null)
    vi.resetModules()
  })

  it('navigation repas : callback sans modification du journal', async () => {
    const { getTodayJournal } = await import('../services/nutritionStorage')
    const before = getTodayJournal()
    const onOpenNutrition = vi.fn()
    onOpenNutrition()
    expect(onOpenNutrition).toHaveBeenCalledOnce()
    expect(getTodayJournal()).toEqual(before)
  })

  it('+250 ml utilise addWaterEntry (type glass, 250 ml)', async () => {
    const storage = await import('../services/nutritionStorage')
    const addSpy = vi.spyOn(storage, 'addWaterEntry')
    const { tryAddHomeQuickWater } = await import('./homeNutritionQuickActions')

    tryAddHomeQuickWater()

    expect(addSpy).toHaveBeenCalledWith({
      amountMl: 250,
      type: 'glass',
      label: 'Verre',
    })
  })

  it('augmente exactement de 250 ml après succès', async () => {
    const { saveCalorieProfile } = await import('../services/nutritionStorage')
    saveCalorieProfile(BASE_PROFILE, { skipCloud: true })

    const { tryAddHomeQuickWater } = await import('./homeNutritionQuickActions')
    const { getTodayWaterMl } = await import('../services/nutritionStorage')

    expect(getTodayWaterMl()).toBe(0)
    const result = tryAddHomeQuickWater()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.addedMl).toBe(250)
      expect(result.waterMl).toBe(250)
    }
    expect(getTodayWaterMl()).toBe(250)
  })

  it('échec d’écriture → valeur inchangée + message d’erreur', async () => {
    const storage = await import('../services/nutritionStorage')
    storage.saveCalorieProfile(BASE_PROFILE, { skipCloud: true })
    vi.spyOn(storage, 'addWaterEntry').mockImplementation(() => {
      throw new Error('quota')
    })

    const { tryAddHomeQuickWater } = await import('./homeNutritionQuickActions')
    const result = tryAddHomeQuickWater()

    expect(result).toEqual({ ok: false, message: "Impossible d'ajouter l'eau" })
    expect(storage.getTodayWaterMl()).toBe(0)
  })

  it('objectif atteint → bouton rapide masqué', async () => {
    const { shouldShowHomeQuickWaterButton } = await import('./homeNutritionQuickActions')
    expect(shouldShowHomeQuickWaterButton(2100, 2100)).toBe(false)
    expect(shouldShowHomeQuickWaterButton(2200, 2100)).toBe(false)
    expect(shouldShowHomeQuickWaterButton(2099, 2100)).toBe(true)
  })

  it('bouton désactivé pendant l’écriture', async () => {
    const { canSubmitHomeQuickWater } = await import('./homeNutritionQuickActions')
    expect(canSubmitHomeQuickWater(false)).toBe(true)
    expect(canSubmitHomeQuickWater(true)).toBe(false)
  })

  it('ne modifie pas le target calorique ni les macros', async () => {
    const { saveCalorieProfile } = await import('../services/nutritionStorage')
    saveCalorieProfile(BASE_PROFILE, { skipCloud: true })

    const { tryAddHomeQuickWater, readNutritionTargetCalories } = await import(
      './homeNutritionQuickActions'
    )
    const { getNutritionTarget } = await import('../services/nutritionActivity')

    const before = getNutritionTarget()
    tryAddHomeQuickWater()
    const after = getNutritionTarget()

    expect(readNutritionTargetCalories()).toBe(before.targetCalories)
    expect(after.targetCalories).toBe(before.targetCalories)
    expect(after.proteinG).toBe(before.proteinG)
    expect(after.carbsG).toBe(before.carbsG)
    expect(after.fatG).toBe(before.fatG)
  })

  it('stockage isolé entre utilisateur connecté et anonyme', async () => {
    const { saveCalorieProfile, getTodayWaterMl } = await import('../services/nutritionStorage')
    saveCalorieProfile(BASE_PROFILE, { skipCloud: true })

    const { tryAddHomeQuickWater } = await import('./homeNutritionQuickActions')
    tryAddHomeQuickWater()
    expect(getTodayWaterMl()).toBe(250)

    getActiveCloudUserId.mockReturnValue('user-a')
    vi.resetModules()
    const storageUser = await import('../services/nutritionStorage')
    expect(storageUser.getTodayWaterMl()).toBe(0)

    storageUser.saveCalorieProfile(BASE_PROFILE, { skipCloud: true })
    const actionsUser = await import('./homeNutritionQuickActions')
    actionsUser.tryAddHomeQuickWater()
    expect(storageUser.getTodayWaterMl()).toBe(250)

    getActiveCloudUserId.mockReturnValue(null)
    vi.resetModules()
    const storageAnon = await import('../services/nutritionStorage')
    expect(storageAnon.getTodayWaterMl()).toBe(250)
  })
})
