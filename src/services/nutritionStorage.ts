import type {
  CalorieProfile,
  DayJournal,
  MealEntry,
  NutritionGoal,
  WaterPresetsCount,
} from '../types/nutrition'
import { todayKey } from '../utils/calories'
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

/** Empty shell for first-time onboarding — never auto-pushed as “real” data. */
export const BLANK_PROFILE: CalorieProfile = {
  weightKg: 0,
  goalWeightKg: 0,
  heightCm: 0,
  age: 0,
  sex: 'male',
  activity: 'moderate',
  morphology: 'mesomorph',
  goal: 'maintain',
  weeklyPaceKg: 0.5,
  onboardingComplete: false,
}

/** @deprecated Use BLANK_PROFILE — kept for imports that still reference the name. */
export const DEFAULT_PROFILE = BLANK_PROFILE

const VALID_GOALS: NutritionGoal[] = ['cut', 'maintain', 'bulk']

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

function asFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function normalizeGoal(value: unknown, fallback: NutritionGoal): NutritionGoal {
  return typeof value === 'string' && VALID_GOALS.includes(value as NutritionGoal)
    ? (value as NutritionGoal)
    : fallback
}

/** Persist exactly what the user entered — no mock overwrite. */
export function normalizeCalorieProfile(input: CalorieProfile): CalorieProfile {
  const goal = normalizeGoal(input.goal, 'maintain')
  const weeklyPaceKg =
    goal === 'maintain'
      ? 0
      : Math.max(0.1, Math.min(1.5, asFiniteNumber(input.weeklyPaceKg, 0.5)))

  return {
    weightKg: asFiniteNumber(input.weightKg, 0),
    goalWeightKg: asFiniteNumber(input.goalWeightKg, 0),
    heightCm: asFiniteNumber(input.heightCm, 0),
    age: Math.round(asFiniteNumber(input.age, 0)),
    sex: input.sex === 'female' ? 'female' : 'male',
    activity: input.activity || 'moderate',
    morphology: input.morphology || 'mesomorph',
    goal,
    weeklyPaceKg,
    onboardingComplete: Boolean(input.onboardingComplete),
  }
}

export function getCalorieProfile(): CalorieProfile {
  const stored = readJson<Partial<CalorieProfile> | null>(scopedKey(PROFILE_BASE), null)
  if (!stored || typeof stored !== 'object') {
    return { ...BLANK_PROFILE }
  }

  const hasAnyUserData =
    Boolean(stored.onboardingComplete) ||
    asFiniteNumber(stored.weightKg, 0) > 0 ||
    asFiniteNumber(stored.goalWeightKg, 0) > 0 ||
    asFiniteNumber(stored.heightCm, 0) > 0 ||
    asFiniteNumber(stored.age, 0) > 0

  if (!hasAnyUserData) {
    return { ...BLANK_PROFILE }
  }

  return normalizeCalorieProfile({
    weightKg: asFiniteNumber(stored.weightKg, 0),
    goalWeightKg: asFiniteNumber(stored.goalWeightKg, asFiniteNumber(stored.weightKg, 0)),
    heightCm: asFiniteNumber(stored.heightCm, 0),
    age: asFiniteNumber(stored.age, 0),
    sex: stored.sex === 'female' ? 'female' : 'male',
    activity: stored.activity || 'moderate',
    morphology: stored.morphology || 'mesomorph',
    goal: normalizeGoal(stored.goal, 'maintain'),
    weeklyPaceKg: asFiniteNumber(stored.weeklyPaceKg, 0.5),
    onboardingComplete: Boolean(stored.onboardingComplete),
  })
}

export function saveCalorieProfile(
  profile: CalorieProfile,
  opts?: StorageSaveOptions,
): void {
  const next = normalizeCalorieProfile(profile)
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

/** Default bottle capacity used by SmartWaterGauge (ml). */
export function suggestedWaterGoalMl(_weightKg?: number): number {
  return 1500
}

/** Plafond journalier (plusieurs bouteilles / presets). */
export const MAX_DAILY_WATER_ML = 15000

export function getTodayWaterMl(): number {
  return Math.max(0, Math.round(getTodayJournal().waterMl ?? 0))
}

export function setTodayWaterMl(waterMl: number, opts?: StorageSaveOptions): DayJournal {
  const journal = getTodayJournal()
  const next: DayJournal = {
    ...journal,
    waterMl: Math.max(0, Math.min(MAX_DAILY_WATER_ML, Math.round(waterMl))),
  }
  saveTodayJournal(next, opts)
  return next
}

export function addTodayWaterMl(deltaMl: number, opts?: StorageSaveOptions): DayJournal {
  return setTodayWaterMl(getTodayWaterMl() + deltaMl, opts)
}

function normalizePresetsCount(raw: unknown): WaterPresetsCount {
  if (!raw || typeof raw !== 'object') return {}
  const out: WaterPresetsCount = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n)
  }
  return out
}

export function getTodayWaterPresetsCount(): WaterPresetsCount {
  return normalizePresetsCount(getTodayJournal().waterPresetsCount)
}

export function setTodayWaterPresetsCount(
  counts: WaterPresetsCount,
  opts?: StorageSaveOptions,
): DayJournal {
  const journal = getTodayJournal()
  const cleaned = normalizePresetsCount(counts)
  const next: DayJournal = {
    ...journal,
    waterPresetsCount: Object.keys(cleaned).length > 0 ? cleaned : undefined,
  }
  saveTodayJournal(next, opts)
  return next
}

/**
 * Ajoute ou retire un contenant preset (tap / long-press).
 * Met à jour le total d’eau + le badge multiplicateur, puis sync cloud.
 */
export function applyWaterPresetDelta(
  presetId: string,
  deltaCount: 1 | -1,
  mlPerUnit: number,
  opts?: StorageSaveOptions,
): { journal: DayJournal; count: number; waterMl: number } {
  const journal = getTodayJournal()
  const counts = normalizePresetsCount(journal.waterPresetsCount)
  const current = counts[presetId] ?? 0
  const nextCount = Math.max(0, current + deltaCount)
  if (deltaCount < 0 && current <= 0) {
    return {
      journal,
      count: 0,
      waterMl: Math.max(0, Math.round(journal.waterMl ?? 0)),
    }
  }

  if (nextCount <= 0) delete counts[presetId]
  else counts[presetId] = nextCount

  const waterMl = Math.max(
    0,
    Math.min(
      MAX_DAILY_WATER_ML,
      Math.round((journal.waterMl ?? 0) + deltaCount * mlPerUnit),
    ),
  )

  const next: DayJournal = {
    ...journal,
    waterMl,
    waterPresetsCount: Object.keys(counts).length > 0 ? counts : undefined,
  }
  saveTodayJournal(next, opts)
  return { journal: next, count: nextCount, waterMl }
}
