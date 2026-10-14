import { api as generatedApi } from '../../convex/_generated/api'
import { getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import type { DayJournal, MealEntry, WaterEntry } from '../types/nutrition'

const api = generatedApi as any

export type CloudFoodRecord = {
  foodKey: string
  barcode?: string
  name: string
  brand?: string
  caloriesPer100g: number | null
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  imageUrl?: string
  source: 'open_food_facts' | 'manual' | 'ai_photo' | 'supabase_import'
  lastFetchedAt: number
  lastSelectedAt: number
  selectedCount: number
  isFavorite: boolean
  lastUsedMealType?: string
  updatedAt: number
}

export type OpenFoodFactsProductCloud = {
  barcode: string
  nom: string
  brands: string
  calories: number | null
  proteines: number | null
  glucides: number | null
  lipides: number | null
  imageUrl?: string
  imageStorageId?: string
  servingSize?: string | null
  categoriesTags?: string[]
  provenance: 'open_food_facts'
  fetchedAt: number
}

type JournalSnapshot = {
  meals: Array<{
    mealId: string
    /** Absent sur tombstone hard-delete (id + deletedAt seulement). */
    dateKey?: string
    mealType?: string
    name?: string
    calories?: number | null
    proteinG?: number | null
    carbsG?: number | null
    fatG?: number | null
    grams?: number
    pieces?: number
    portionMode?: 'solo' | 'with_sides'
    createdAt?: number
    updatedAt: number
    deletedAt?: number
  }>
  waterEntries: Array<{
    entryId: string
    dateKey: string
    amountMl: number
    type: string
    label: string
    createdAt: number
    updatedAt: number
    deletedAt?: number
  }>
  dayStates: Array<{
    dateKey: string
    waterBottleLevelMl?: number | null
    waterBottleCalibrationTotalMl?: number | null
    updatedAt: number
  }>
}

function randomMutationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function requireToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new Error('AUTH_SESSION_MISSING')
  return token
}

export async function pushConvexMeal(meal: MealEntry, dateKey: string, updatedAt = Date.now()) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.upsertMeal, {
    sessionToken,
    mealId: meal.id,
    dateKey,
    mealType: meal.mealType,
    name: meal.name,
    calories: meal.calories ?? null,
    proteinG: meal.proteinG ?? null,
    carbsG: meal.carbsG ?? null,
    fatG: meal.fatG ?? null,
    grams: meal.grams,
    pieces: meal.pieces,
    portionMode: meal.portionMode,
    createdAt: meal.createdAt,
    updatedAt,
  }) as Promise<{ applied: boolean; stale: boolean; updatedAt: number }>
}

export async function deleteConvexMeal(mealId: string, dateKey: string, deletedAt = Date.now()) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.deleteMeal, {
    sessionToken,
    mealId,
    dateKey,
    deletedAt,
  }) as Promise<{ applied: boolean; stale: boolean; updatedAt: number }>
}

export async function countActiveMealsViaConvex(): Promise<number> {
  const sessionToken = await requireToken()
  const result = (await getConvex().query(api.nutrition.countActiveMeals, {
    sessionToken,
  })) as { count: number }
  return result.count
}

/** Ids repas actifs Convex — pour dédup avec Supabase (B9-03). */
export async function listActiveMealIdsViaConvex(): Promise<string[]> {
  const sessionToken = await requireToken()
  const result = (await getConvex().query(api.nutrition.listActiveMealIds, {
    sessionToken,
  })) as { mealIds: string[] }
  return Array.isArray(result?.mealIds) ? result.mealIds : []
}

export async function deleteAllMyMealsViaConvex(deletedAt = Date.now()): Promise<{
  deletedCount: number
  updatedAt: number
}> {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.deleteAllMyMeals, {
    sessionToken,
    deletedAt,
  }) as Promise<{ deletedCount: number; updatedAt: number }>
}

/** Compte repas Supabase via Convex (lien + service-role), même si Convex a 0. */
export async function countSupabaseMealsViaConvex(): Promise<number> {
  const sessionToken = await requireToken()
  const result = (await getConvex().action(api.purgeSupabaseMeals.countSupabaseMealCopies, {
    sessionToken,
  })) as { count: number }
  return result.count
}

/** Meal ids Supabase (lien) — pour dédup B9-03. */
export async function listSupabaseMealIdsViaConvex(): Promise<string[]> {
  const sessionToken = await requireToken()
  const result = (await getConvex().action(api.purgeSupabaseMeals.countSupabaseMealCopies, {
    sessionToken,
  })) as { mealIds?: string[] }
  return Array.isArray(result?.mealIds) ? result.mealIds : []
}

/** Purge Supabase via Convex — session only, userId résolu serveur. */
export async function purgeSupabaseMealCopiesViaConvex(): Promise<{
  deletedCount: number
  nutritionStatus: 'purged' | 'absent'
  userBackupsStatus: 'purged' | 'absent'
  resolvedUserId: string
}> {
  const sessionToken = await requireToken()
  return getConvex().action(api.purgeSupabaseMeals.purgeSupabaseMealCopies, {
    sessionToken,
  }) as Promise<{
    deletedCount: number
    nutritionStatus: 'purged' | 'absent'
    userBackupsStatus: 'purged' | 'absent'
    resolvedUserId: string
  }>
}

/** Compte Supabase-only via access token (pas de lien). */
export async function countSupabaseMealsByAccessTokenViaConvex(
  supabaseAccessToken: string,
): Promise<{ count: number; mealIds: string[]; resolvedUserId: string }> {
  return getConvex().action(api.purgeSupabaseMeals.countSupabaseMealCopiesByAccessToken, {
    supabaseAccessToken,
  }) as Promise<{ count: number; mealIds: string[]; resolvedUserId: string }>
}

/** Purge Supabase-only via access token vérifié serveur — jamais un autre compte. */
export async function purgeSupabaseMealCopiesByAccessTokenViaConvex(
  supabaseAccessToken: string,
): Promise<{
  deletedCount: number
  nutritionStatus: 'purged' | 'absent'
  userBackupsStatus: 'purged' | 'absent'
  resolvedUserId: string
}> {
  return getConvex().action(api.purgeSupabaseMeals.purgeSupabaseMealCopiesByAccessToken, {
    supabaseAccessToken,
  }) as Promise<{
    deletedCount: number
    nutritionStatus: 'purged' | 'absent'
    userBackupsStatus: 'purged' | 'absent'
    resolvedUserId: string
  }>
}

export async function pushConvexWaterEntry(
  entry: WaterEntry,
  dateKey: string,
  updatedAt = Date.now(),
) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.upsertWaterEntry, {
    sessionToken,
    entryId: entry.id,
    dateKey,
    amountMl: Math.round(entry.amountMl),
    type: entry.type,
    label: entry.label,
    createdAt: entry.createdAt,
    updatedAt,
  }) as Promise<{ applied: boolean; stale: boolean; updatedAt: number }>
}

export async function deleteConvexWaterEntry(
  entryId: string,
  dateKey: string,
  deletedAt = Date.now(),
) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.deleteWaterEntry, {
    sessionToken,
    entryId,
    dateKey,
    deletedAt,
  }) as Promise<{ applied: boolean; stale: boolean; updatedAt: number }>
}

export async function pushConvexDayState(
  dateKey: string,
  state: Pick<DayJournal, 'waterBottleLevelMl' | 'waterBottleCalibrationTotalMl'>,
  updatedAt = Date.now(),
) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.upsertDayState, {
    sessionToken,
    dateKey,
    waterBottleLevelMl:
      typeof state.waterBottleLevelMl === 'number' ? state.waterBottleLevelMl : null,
    waterBottleCalibrationTotalMl:
      typeof state.waterBottleCalibrationTotalMl === 'number'
        ? state.waterBottleCalibrationTotalMl
        : null,
    updatedAt,
  }) as Promise<{ applied: boolean; stale: boolean; updatedAt: number }>
}

export async function fetchConvexJournalSnapshot(options?: {
  startDateKey?: string
  endDateKey?: string
  includeDeleted?: boolean
}): Promise<JournalSnapshot> {
  const sessionToken = await requireToken()
  return getConvex().query(api.nutrition.listJournalEntries, {
    sessionToken,
    startDateKey: options?.startDateKey,
    endDateKey: options?.endDateKey,
    includeDeleted: options?.includeDeleted,
  }) as Promise<JournalSnapshot>
}

export async function fetchOpenFoodFactsViaConvex(
  barcode: string,
): Promise<OpenFoodFactsProductCloud> {
  const sessionToken = await requireToken()
  return getConvex().action(api.nutrition.fetchOpenFoodFactsByBarcode, {
    sessionToken,
    barcode,
  }) as Promise<OpenFoodFactsProductCloud>
}

export async function searchOpenFoodFactsViaConvex(
  term: string,
  limit?: number,
  options?: { categoryTag?: string | null },
): Promise<OpenFoodFactsProductCloud[]> {
  const sessionToken = await requireToken()
  return getConvex().action(api.nutrition.searchOpenFoodFacts, {
    sessionToken,
    term,
    categoryTag: options?.categoryTag ?? null,
    limit,
  }) as Promise<OpenFoodFactsProductCloud[]>
}

/** Recherche v3 — action Convex dédiée (quota journalier + images hébergées). */
export async function searchFoodsV3ViaConvex(input: {
  term: string
  categoryTag?: string | null
  limit?: number
}): Promise<{
  hits: OpenFoodFactsProductCloud[]
  searchCount: number
  dailyLimit: number
}> {
  const sessionToken = await requireToken()
  return getConvex().action(api.foodAdd.searchFoods, {
    sessionToken,
    term: input.term,
    categoryTag: input.categoryTag ?? null,
    limit: input.limit,
  }) as Promise<{
    hits: OpenFoodFactsProductCloud[]
    searchCount: number
    dailyLimit: number
  }>
}

export async function addFoodSnapshotViaConvex(input: {
  mealId: string
  dateKey: string
  mealType: string
  name: string
  portionLabel: string
  offCode?: string
  imageUrl?: string
  imageStorageId?: string
  calories: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  grams?: number
  createdAt?: number
  updatedAt?: number
}): Promise<{ applied: boolean; stale: boolean; updatedAt: number }> {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.foodAdd.addFoodSnapshot, {
    sessionToken,
    ...input,
  }) as Promise<{ applied: boolean; stale: boolean; updatedAt: number }>
}

export async function upsertConvexFoodSelection(input: {
  barcode?: string
  name: string
  brand?: string
  caloriesPer100g: number | null
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  imageUrl?: string
  source: 'open_food_facts' | 'manual' | 'ai_photo' | 'supabase_import'
  fetchedAt?: number
  mealType?: string
  selectionEventId?: string
}): Promise<{ applied: boolean; foodKey: string; selectedCount: number }> {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.upsertFoodSelection, {
    sessionToken,
    barcode: input.barcode,
    name: input.name,
    brand: input.brand,
    caloriesPer100g: input.caloriesPer100g,
    proteinPer100g: input.proteinPer100g,
    carbsPer100g: input.carbsPer100g,
    fatPer100g: input.fatPer100g,
    imageUrl: input.imageUrl,
    source: input.source,
    fetchedAt: input.fetchedAt,
    mealType: input.mealType,
    selectionEventId: input.selectionEventId ?? randomMutationId('food-select'),
  }) as Promise<{ applied: boolean; foodKey: string; selectedCount: number }>
}

export async function setConvexFoodFavorite(foodKey: string, isFavorite: boolean) {
  const sessionToken = await requireToken()
  return getConvex().mutation(api.nutrition.setFoodFavorite, {
    sessionToken,
    foodKey,
    isFavorite,
  }) as Promise<{ applied: boolean }>
}

export async function listConvexFoodCatalog(options?: {
  limit?: number
  favoritesOnly?: boolean
}): Promise<CloudFoodRecord[]> {
  const sessionToken = await requireToken()
  return getConvex().query(api.nutrition.listFoodCatalog, {
    sessionToken,
    limit: options?.limit,
    favoritesOnly: options?.favoritesOnly,
  }) as Promise<CloudFoodRecord[]>
}
