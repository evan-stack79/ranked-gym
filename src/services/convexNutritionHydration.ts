import type { DayJournal, MealEntry, WaterEntry } from '../types/nutrition'
import { safeWarn } from '../utils/safeLog'
import {
  fetchConvexJournalSnapshot,
  type OpenFoodFactsProductCloud,
} from './convexNutritionService'
import { enqueueConvexNutritionOp, flushConvexNutritionQueue } from './convexNutritionQueue'
import { getMealJournal, saveMealJournal } from './nutritionStorage'

function asMealEntry(input: {
  mealId: string
  mealType: string
  name: string
  calories: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  grams?: number
  pieces?: number
  portionMode?: 'solo' | 'with_sides'
  createdAt: number
}): MealEntry {
  return {
    id: input.mealId,
    mealType: input.mealType as MealEntry['mealType'],
    name: input.name,
    calories: Math.max(0, Math.round(input.calories ?? 0)),
    proteinG: input.proteinG ?? undefined,
    carbsG: input.carbsG ?? undefined,
    fatG: input.fatG ?? undefined,
    grams: input.grams,
    pieces: input.pieces,
    portionMode: input.portionMode,
    createdAt: input.createdAt,
  }
}

function asWaterEntry(input: {
  entryId: string
  amountMl: number
  type: string
  label: string
  createdAt: number
}): WaterEntry {
  return {
    id: input.entryId,
    amountMl: Math.max(0, Math.round(input.amountMl)),
    type: input.type as WaterEntry['type'],
    label: input.label,
    createdAt: input.createdAt,
  }
}

function ensureDay(map: Record<string, DayJournal>, dateKey: string): DayJournal {
  const existing = map[dateKey]
  if (existing) return existing
  const created: DayJournal = { dateKey, meals: [] }
  map[dateKey] = created
  return created
}

function sumWater(entries: WaterEntry[] | undefined): number {
  if (!entries || entries.length === 0) return 0
  return entries.reduce((acc, entry) => acc + Math.max(0, Math.round(entry.amountMl)), 0)
}

export async function hydrateConvexNutritionJournal(): Promise<{
  applied: boolean
  datesTouched: number
  mealCount: number
  waterEntryCount: number
}> {
  const snapshot = await fetchConvexJournalSnapshot({ includeDeleted: true })
  const hasRemoteRows =
    snapshot.meals.length > 0 || snapshot.waterEntries.length > 0 || snapshot.dayStates.length > 0
  if (!hasRemoteRows) {
    const local = getMealJournal()
    for (const [dateKey, day] of Object.entries(local)) {
      for (const meal of day.meals) {
        enqueueConvexNutritionOp({
          kind: 'meal-upsert',
          dateKey,
          meal,
          updatedAt: Date.now(),
        })
      }
      for (const entry of day.waterEntries ?? []) {
        enqueueConvexNutritionOp({
          kind: 'water-upsert',
          dateKey,
          entry,
          updatedAt: Date.now(),
        })
      }
      if (
        typeof day.waterBottleLevelMl === 'number' ||
        typeof day.waterBottleCalibrationTotalMl === 'number'
      ) {
        enqueueConvexNutritionOp({
          kind: 'day-state-upsert',
          dateKey,
          dayState: {
            waterBottleLevelMl: day.waterBottleLevelMl,
            waterBottleCalibrationTotalMl: day.waterBottleCalibrationTotalMl,
          },
          updatedAt: Date.now(),
        })
      }
    }
    await flushConvexNutritionQueue().catch((error) => {
      safeWarn('[nutrition-hydrate] flush queue after empty snapshot failed', error)
    })
    return { applied: false, datesTouched: 0, mealCount: 0, waterEntryCount: 0 }
  }

  const current = getMealJournal()
  const next: Record<string, DayJournal> = { ...current }
  const touchedDateKeys = new Set<string>()

  for (const row of snapshot.meals) touchedDateKeys.add(row.dateKey)
  for (const row of snapshot.waterEntries) touchedDateKeys.add(row.dateKey)
  for (const row of snapshot.dayStates) touchedDateKeys.add(row.dateKey)

  for (const dateKey of touchedDateKeys) {
    const day = ensureDay(next, dateKey)
    const mealsById = new Map(day.meals.map((meal) => [meal.id, meal] as const))
    const watersById = new Map((day.waterEntries ?? []).map((entry) => [entry.id, entry] as const))

    for (const row of snapshot.meals.filter((meal) => meal.dateKey === dateKey)) {
      if (row.deletedAt) {
        mealsById.delete(row.mealId)
        continue
      }
      mealsById.set(row.mealId, asMealEntry(row))
    }

    for (const row of snapshot.waterEntries.filter((entry) => entry.dateKey === dateKey)) {
      if (row.deletedAt) {
        watersById.delete(row.entryId)
        continue
      }
      watersById.set(row.entryId, asWaterEntry(row))
    }

    const meals = Array.from(mealsById.values()).sort((a, b) => b.createdAt - a.createdAt)
    const waterEntries = Array.from(watersById.values()).sort((a, b) => b.createdAt - a.createdAt)
    const latestDayState = snapshot.dayStates
      .filter((state) => state.dateKey === dateKey)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]

    next[dateKey] = {
      ...day,
      dateKey,
      meals,
      waterEntries: waterEntries.length > 0 ? waterEntries : undefined,
      waterMl: sumWater(waterEntries),
      waterBottleLevelMl:
        latestDayState?.waterBottleLevelMl == null ? undefined : latestDayState.waterBottleLevelMl,
      waterBottleCalibrationTotalMl:
        latestDayState?.waterBottleCalibrationTotalMl == null
          ? undefined
          : latestDayState.waterBottleCalibrationTotalMl,
    }
  }

  saveMealJournal(next, { skipCloud: true })
  await flushConvexNutritionQueue().catch((error) => {
    safeWarn('[nutrition-hydrate] flush queue failed', error)
  })

  const mealCount = Object.values(next).reduce((acc, day) => acc + day.meals.length, 0)
  const waterEntryCount = Object.values(next).reduce(
    (acc, day) => acc + (day.waterEntries?.length ?? 0),
    0,
  )
  return {
    applied: true,
    datesTouched: touchedDateKeys.size,
    mealCount,
    waterEntryCount,
  }
}

export function mapCloudProductToNutritionDraft(product: OpenFoodFactsProductCloud) {
  return {
    name: product.nom,
    calories: product.calories,
    proteinG: product.proteines,
    carbsG: product.glucides,
    fatG: product.lipides,
  }
}
