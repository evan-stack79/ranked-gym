import type { CalorieProfile, DayJournal, MealEntry } from '../types/nutrition'
import { todayKey } from '../utils/calories'

const PROFILE_KEY = 'ranked-gym:nutrition-profile'
const JOURNAL_KEY = 'ranked-gym:nutrition-journal'

export const DEFAULT_PROFILE: CalorieProfile = {
  weightKg: 78,
  heightCm: 178,
  age: 24,
  sex: 'male',
  activity: 'moderate',
  goal: 'maintain',
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
  return { ...DEFAULT_PROFILE, ...readJson<Partial<CalorieProfile>>(PROFILE_KEY, {}) }
}

export function saveCalorieProfile(profile: CalorieProfile): void {
  writeJson(PROFILE_KEY, profile)
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
