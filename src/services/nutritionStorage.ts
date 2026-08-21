import type {
  CalorieProfile,
  DayJournal,
  MealEntry,
  NutritionGoal,
  WaterEntry,
  WaterEntryType,
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

const PRESET_LABELS: Record<string, string> = {
  glass: 'Verre',
  shaker: 'Shaker',
  bottle: 'Bouteille',
  manual: 'Ajustement',
  legacy: 'Eau',
}

const PRESET_ML: Record<string, number> = {
  glass: 250,
  shaker: 500,
  bottle: 1500,
}

function newWaterEntryId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sumEntries(entries: WaterEntry[]): number {
  return entries.reduce((acc, e) => acc + Math.max(0, Math.round(e.amountMl)), 0)
}

function countsFromEntries(entries: WaterEntry[]): WaterPresetsCount {
  const counts: WaterPresetsCount = {}
  for (const entry of entries) {
    if (entry.type === 'glass' || entry.type === 'shaker' || entry.type === 'bottle') {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1
    }
  }
  return counts
}

function normalizeEntry(raw: unknown): WaterEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const amountMl = Math.round(Number(o.amountMl ?? o.amount ?? 0))
  if (!Number.isFinite(amountMl) || amountMl <= 0) return null
  const typeRaw = typeof o.type === 'string' ? o.type : 'manual'
  const type = (
    ['glass', 'shaker', 'bottle', 'manual', 'legacy'].includes(typeRaw)
      ? typeRaw
      : 'manual'
  ) as WaterEntryType
  const createdAt = Number(o.createdAt ?? o.time ?? Date.now())
  const label =
    typeof o.label === 'string' && o.label.trim()
      ? o.label.trim()
      : (PRESET_LABELS[type] ?? 'Eau')
  return {
    id: typeof o.id === 'string' && o.id ? o.id : newWaterEntryId(),
    amountMl: Math.min(MAX_DAILY_WATER_ML, amountMl),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    type,
    label,
  }
}

/** Migre waterMl / waterPresetsCount → waterEntries si besoin. */
export function resolveTodayWaterEntries(journal: DayJournal = getTodayJournal()): WaterEntry[] {
  const existing = Array.isArray(journal.waterEntries)
    ? journal.waterEntries.map(normalizeEntry).filter((e): e is WaterEntry => e !== null)
    : []
  if (existing.length > 0) return existing

  const fromPresets: WaterEntry[] = []
  const counts = journal.waterPresetsCount
  if (counts && typeof counts === 'object') {
    const now = Date.now()
    let offset = 0
    for (const [key, value] of Object.entries(counts)) {
      const n = Math.floor(Number(value))
      const ml = PRESET_ML[key]
      if (!ml || !Number.isFinite(n) || n <= 0) continue
      for (let i = 0; i < n; i += 1) {
        fromPresets.push({
          id: `migrate-${journal.dateKey}-${key}-${i}`,
          amountMl: ml,
          createdAt: now - offset * 60_000,
          type: key as WaterEntryType,
          label: PRESET_LABELS[key] ?? key,
        })
        offset += 1
      }
    }
  }
  if (fromPresets.length > 0) return fromPresets

  const legacyMl = Math.round(journal.waterMl ?? 0)
  if (legacyMl > 0) {
    return [
      {
        id: `migrate-${journal.dateKey}-legacy`,
        amountMl: Math.min(MAX_DAILY_WATER_ML, legacyMl),
        createdAt: Date.now(),
        type: 'legacy',
        label: 'Eau',
      },
    ]
  }
  return []
}

function persistWaterJournal(
  entries: WaterEntry[],
  opts?: StorageSaveOptions,
): DayJournal {
  const normalized = entries
    .map(normalizeEntry)
    .filter((e): e is WaterEntry => e !== null)
    .sort((a, b) => b.createdAt - a.createdAt)

  const cleaned: WaterEntry[] = []
  let waterMl = 0
  for (const entry of normalized) {
    if (waterMl + entry.amountMl > MAX_DAILY_WATER_ML) break
    cleaned.push(entry)
    waterMl += entry.amountMl
  }

  const journal = getTodayJournal()
  const next: DayJournal = {
    ...journal,
    waterMl,
    waterEntries: cleaned.length > 0 ? cleaned : undefined,
    waterPresetsCount: countsFromEntries(cleaned),
  }
  saveTodayJournal(next, opts)
  return next
}

export function getTodayWaterMl(): number {
  const journal = getTodayJournal()
  const entries = resolveTodayWaterEntries(journal)
  if (entries.length > 0) return sumEntries(entries)
  return Math.max(0, Math.round(journal.waterMl ?? 0))
}

export function getTodayWaterEntries(): WaterEntry[] {
  const journal = getTodayJournal()
  const entries = resolveTodayWaterEntries(journal)
  const hadStored = Array.isArray(journal.waterEntries) && journal.waterEntries.length > 0
  if (!hadStored && entries.length > 0) {
    return persistWaterJournal(entries).waterEntries ?? entries
  }
  return entries
}

export function getTodayWaterPresetsCount(): WaterPresetsCount {
  return countsFromEntries(getTodayWaterEntries())
}

/** Ajoute une prise d’eau au journal (raccourci ou ajustement manuel). */
export function addWaterEntry(
  input: {
    amountMl: number
    type: WaterEntryType
    label?: string
    createdAt?: number
  },
  opts?: StorageSaveOptions,
): { journal: DayJournal; entry: WaterEntry; waterMl: number } {
  const amountMl = Math.max(0, Math.round(input.amountMl))
  const entries = resolveTodayWaterEntries()
  if (amountMl <= 0) {
    const journal = persistWaterJournal(entries, opts)
    return {
      journal,
      entry: {
        id: '',
        amountMl: 0,
        createdAt: Date.now(),
        type: input.type,
        label: input.label ?? PRESET_LABELS[input.type] ?? 'Eau',
      },
      waterMl: journal.waterMl ?? 0,
    }
  }

  const entry: WaterEntry = {
    id: newWaterEntryId(),
    amountMl: Math.min(MAX_DAILY_WATER_ML, amountMl),
    createdAt: input.createdAt ?? Date.now(),
    type: input.type,
    label: input.label ?? PRESET_LABELS[input.type] ?? 'Eau',
  }
  const journal = persistWaterJournal([entry, ...entries], opts)
  return { journal, entry, waterMl: journal.waterMl ?? 0 }
}

/** Supprime une ligne du journal → recalcule le total + sync cloud. */
export function removeWaterEntry(
  entryId: string,
  opts?: StorageSaveOptions,
): { journal: DayJournal; waterMl: number; removed: WaterEntry | null } {
  const entries = resolveTodayWaterEntries()
  const removed = entries.find((e) => e.id === entryId) ?? null
  const nextEntries = entries.filter((e) => e.id !== entryId)
  const journal = persistWaterJournal(nextEntries, opts)
  return { journal, waterMl: journal.waterMl ?? 0, removed }
}

/**
 * Valide un total cible depuis le drag-to-fill :
 * - si ↑ : ajoute une entrée « Ajustement » du delta
 * - si ↓ : retire du plus récent jusqu’à atteindre la cible
 */
export function setWaterTotalFromGauge(
  targetMl: number,
  opts?: StorageSaveOptions,
): DayJournal {
  const target = Math.max(0, Math.min(MAX_DAILY_WATER_ML, Math.round(targetMl)))
  let entries = resolveTodayWaterEntries()
  let sum = sumEntries(entries)

  if (target > sum) {
    const delta = target - sum
    entries = [
      {
        id: newWaterEntryId(),
        amountMl: delta,
        createdAt: Date.now(),
        type: 'manual',
        label: 'Ajustement',
      },
      ...entries,
    ]
  } else if (target < sum) {
    let need = sum - target
    // entries are newest-first
    const next: WaterEntry[] = []
    for (const entry of entries) {
      if (need <= 0) {
        next.push(entry)
        continue
      }
      if (entry.amountMl <= need) {
        need -= entry.amountMl
        continue
      }
      next.push({ ...entry, amountMl: entry.amountMl - need })
      need = 0
    }
    entries = next
  }

  return persistWaterJournal(entries, opts)
}

/** @deprecated Prefer addWaterEntry / setWaterTotalFromGauge */
export function setTodayWaterMl(waterMl: number, opts?: StorageSaveOptions): DayJournal {
  return setWaterTotalFromGauge(waterMl, opts)
}

export function addTodayWaterMl(deltaMl: number, opts?: StorageSaveOptions): DayJournal {
  if (deltaMl === 0) return getTodayJournal()
  if (deltaMl > 0) {
    return addWaterEntry({ amountMl: deltaMl, type: 'manual', label: 'Ajustement' }, opts)
      .journal
  }
  return setWaterTotalFromGauge(getTodayWaterMl() + deltaMl, opts)
}

/**
 * Ajoute un contenant preset (tap).
 * Les suppressions passent par removeWaterEntry (journal UI).
 */
export function applyWaterPresetDelta(
  presetId: string,
  deltaCount: 1 | -1,
  mlPerUnit: number,
  opts?: StorageSaveOptions,
): { journal: DayJournal; count: number; waterMl: number } {
  if (deltaCount > 0) {
    const result = addWaterEntry(
      {
        amountMl: mlPerUnit,
        type: presetId as WaterEntryType,
        label: PRESET_LABELS[presetId] ?? presetId,
      },
      opts,
    )
    const counts = countsFromEntries(resolveTodayWaterEntries(result.journal))
    return {
      journal: result.journal,
      count: counts[presetId] ?? 0,
      waterMl: result.waterMl,
    }
  }

  // Long-press legacy: retire la plus récente entrée de ce type
  const entries = resolveTodayWaterEntries()
  const idx = entries.findIndex((e) => e.type === presetId)
  if (idx < 0) {
    return {
      journal: getTodayJournal(),
      count: 0,
      waterMl: getTodayWaterMl(),
    }
  }
  const next = entries.filter((_, i) => i !== idx)
  const journal = persistWaterJournal(next, opts)
  const counts = countsFromEntries(next)
  return {
    journal,
    count: counts[presetId] ?? 0,
    waterMl: journal.waterMl ?? 0,
  }
}
