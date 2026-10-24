/**
 * Rollup journalier. Un jour sans repas compté n’est pas 0 kcal.
 * Repas compté = pas de deletedAt et calories finies.
 * proteinG (et les autres macros) : somme des valeurs finies.
 * La macro vaut null seulement si aucun repas compté n’a de valeur finie.
 */

export interface DiaryMealInput {
  mealType?: string | null
  calories?: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  fiberG?: number | null
  deletedAt?: number | null
}

export interface DiaryWaterInput {
  amountMl?: number | null
  deletedAt?: number | null
}

export interface DiaryRollup {
  /** Au moins un repas avec des kcal finies. L’eau seule ne compte pas. */
  logged: boolean
  kcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number | null
  waterMl: number | null
  countedMeals: number
  hasBreakfast: boolean
  hasLunch: boolean
  hasDinner: boolean
}

export interface NutritionDayCache {
  logged: boolean
  kcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number | null
  waterMl: number | null
  targetKcal: number | null
  proteinTargetG: number | null
  inputsHash: string
}

const MAIN_MEALS = ['breakfast', 'lunch', 'dinner'] as const

function finiteOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function sumFinite(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null)
  if (present.length === 0) return null
  return present.reduce((sum, value) => sum + value, 0)
}

function mealSlot(mealType: string | null | undefined): string {
  return (mealType ?? '').trim().toLowerCase()
}

export function diaryRollup(input: {
  meals: DiaryMealInput[]
  waterEntries?: DiaryWaterInput[]
  waterMl?: number | null
}): DiaryRollup {
  const counted = input.meals.filter(
    (meal) => meal.deletedAt == null && finiteOrNull(meal.calories) != null,
  )
  const slots = new Set(counted.map((meal) => mealSlot(meal.mealType)))
  const waterFromEntries = input.waterEntries
    ? sumFinite(
        input.waterEntries
          .filter((entry) => entry.deletedAt == null)
          .map((entry) => {
            const amount = finiteOrNull(entry.amountMl)
            if (amount == null || amount < 0) return null
            return amount
          }),
      )
    : null
  const directWater = finiteOrNull(input.waterMl)
  const waterMl = input.waterEntries ? waterFromEntries : directWater != null && directWater >= 0 ? directWater : null
  const kcal = sumFinite(counted.map((meal) => finiteOrNull(meal.calories)))
  return {
    logged: kcal != null,
    kcal,
    proteinG: sumFinite(counted.map((meal) => finiteOrNull(meal.proteinG))),
    carbsG: sumFinite(counted.map((meal) => finiteOrNull(meal.carbsG))),
    fatG: sumFinite(counted.map((meal) => finiteOrNull(meal.fatG))),
    fiberG: sumFinite(counted.map((meal) => finiteOrNull(meal.fiberG))),
    waterMl,
    countedMeals: counted.length,
    hasBreakfast: slots.has('breakfast'),
    hasLunch: slots.has('lunch'),
    hasDinner: slots.has('dinner'),
  }
}

/** Moyenne des jours dont les kcal sont finies. Null s’il y en a moins de 3. */
export function weeklyMeanKcal(days: Array<number | null>): number | null {
  const logged = days.filter((kcal): kcal is number => kcal != null && Number.isFinite(kcal))
  if (logged.length < 3) return null
  return logged.reduce((sum, kcal) => sum + kcal, 0) / logged.length
}

export function displayedKcal(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value)
}

/**
 * La cible calorique est fixe. Le strain de séance ne l’augmente pas.
 */
export function nutritionTargetKcal(targetKcal: number, _workoutStrain: number | null): number {
  return targetKcal
}

export function nutritionDayInputsHash(
  cache: Omit<NutritionDayCache, 'inputsHash'>,
): string {
  return JSON.stringify([
    cache.logged,
    cache.kcal,
    cache.proteinG,
    cache.carbsG,
    cache.fatG,
    cache.fiberG,
    cache.waterMl,
    cache.targetKcal,
    cache.proteinTargetG,
  ])
}

export function nutritionDayCache(input: {
  rollup: DiaryRollup
  targetKcal: number | null
  proteinTargetG: number | null
}): NutritionDayCache {
  const body = {
    logged: input.rollup.logged,
    kcal: input.rollup.kcal,
    proteinG: input.rollup.proteinG,
    carbsG: input.rollup.carbsG,
    fatG: input.rollup.fatG,
    fiberG: input.rollup.fiberG,
    waterMl: input.rollup.waterMl,
    targetKcal: finiteOrNull(input.targetKcal),
    proteinTargetG: finiteOrNull(input.proteinTargetG),
  }
  return { ...body, inputsHash: nutritionDayInputsHash(body) }
}

export function mainMealSlots(): readonly string[] {
  return MAIN_MEALS
}
