import type { CalorieProfile, DayJournal, MealEntry } from '../types/nutrition'
import { inferGoalFromWeights, todayKey } from '../utils/calories'

const PROFILE_KEY = 'ranked-gym:nutrition-profile'
const JOURNAL_KEY = 'ranked-gym:nutrition-journal'

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
  const stored = readJson<Partial<CalorieProfile>>(PROFILE_KEY, {})
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

export function saveCalorieProfile(profile: CalorieProfile): void {
  const next = {
    ...profile,
    goal: inferGoalFromWeights(profile.weightKg, profile.goalWeightKg),
  }
  writeJson(PROFILE_KEY, next)
}

export function isNutritionOnboarded(): boolean {
  return getCalorieProfile().onboardingComplete
}

function getAllJournals(): Record<string, DayJournal> {
  return readJson<Record<string, DayJournal>>(JOURNAL_KEY, {})
}

export function getTodayJournal(): DayJournal {
  const key = todayKey()
  const all = getAllJournals()
  return all[key] ?? { dateKey: key, meals: [] }
}

export function saveTodayJournal(journal: DayJournal): void {
  const all = getAllJournals()
  all[journal.dateKey] = journal
  writeJson(JOURNAL_KEY, all)
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
