import type { CalorieProfile, DayJournal, MealEntry } from '../types/nutrition'
import { inferGoalFromWeights, todayKey } from '../utils/calories'
import { getActiveCloudUserId } from './cloudSession'

const PROFILE_BASE = 'ranked-gym:nutrition-profile'
const JOURNAL_BASE = 'ranked-gym:nutrition-journal'

export type StorageSaveOptions = { skipCloud?: boolean }

function triggerCloudBackup() {
  void import('./cloudBackup').then((m) => m.notifyLocalDataChanged())
}

function scopedKey(base: string): string {
  const uid = getActiveCloudUserId()
  return uid ? `${base}:u:${uid}` : base
}

export const DEFAULT_PROFILE: CalorieProfile = {
  weightKg: 70,
  goalWeightKg: 65,
  heightCm: 170,
  age: 24,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'cut',
  onboardingComplete: false,
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getCalorieProfile(): CalorieProfile {
  const stored = readJson<Partial<CalorieProfile>>(scopedKey(PROFILE_BASE), {})
  const merged: CalorieProfile = {
    ...DEFAULT_PROFILE,
    ...stored,
    goalWeightKg: stored.goalWeightKg ?? stored.weightKg ?? DEFAULT_PROFILE.goalWeightKg,
    morphology: stored.morphology ?? DEFAULT_PROFILE.morphology,
    onboardingComplete: Boolean(stored.onboardingComplete),
  }
  merged.goal = inferGoalFromWeights(merged.weightKg, merged.goalWeightKg)
  return merged
}

export function saveCalorieProfile(
  profile: CalorieProfile,
  opts?: StorageSaveOptions,
): void {
  const next = {
    ...profile,
    goal: inferGoalFromWeights(profile.weightKg, profile.goalWeightKg),
  }
  writeJson(scopedKey(PROFILE_BASE), next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ranked-gym:profile-changed'))
  }
  if (!opts?.skipCloud) triggerCloudBackup()
}

export function isNutritionOnboarded(): boolean {
  return getCalorieProfile().onboardingComplete
}

function getAllJournals(): Record<string, DayJournal> {
  return readJson<Record<string, DayJournal>>(scopedKey(JOURNAL_BASE), {})
}

export function getMealJournal(): Record<string, DayJournal> {
  return getAllJournals()
}

export function saveMealJournal(
  journal: Record<string, DayJournal>,
  opts?: StorageSaveOptions,
): void {
  writeJson(scopedKey(JOURNAL_BASE), journal)
  if (!opts?.skipCloud) triggerCloudBackup()
}

export function getTodayJournal(): DayJournal {
  const key = todayKey()
  const all = getAllJournals()
  return all[key] ?? { dateKey: key, meals: [] }
}

export function saveTodayJournal(journal: DayJournal, opts?: StorageSaveOptions): void {
  const all = getAllJournals()
  all[journal.dateKey] = journal
  writeJson(scopedKey(JOURNAL_BASE), all)
  if (!opts?.skipCloud) triggerCloudBackup()
}

export function addMealToToday(meal: Omit<MealEntry, 'id' | 'createdAt'>): DayJournal {
  const journal = getTodayJournal()
  const entry: MealEntry = {
    ...meal,
    id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  }
  const next = { ...journal, meals: [entry, ...journal.meals] }
  saveTodayJournal(next)
  return next
}

export function removeMealFromToday(mealId: string): DayJournal {
  const journal = getTodayJournal()
  const next = { ...journal, meals: journal.meals.filter((m) => m.id !== mealId) }
  saveTodayJournal(next)
  return next
}

export function updateMealInToday(
  mealId: string,
  patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>,
): DayJournal {
  const journal = getTodayJournal()
  const next = {
    ...journal,
    meals: journal.meals.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)),
  }
  saveTodayJournal(next)
  return next
}
