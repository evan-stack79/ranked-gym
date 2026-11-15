/**
 * Hydration week tip engine — SCIENCE_10_ETATS.md (A + B + C).
 * Pure / deterministic. No Convex. Product thresholds from the doc.
 */

import {
  ETAT_TITLES,
  getEtatActions,
  getEtatAide,
  getEtatTexte,
} from './texts.ts'

/** App day runs 04:00 → 03:59 (product choice). Hours use local clock 0–23. */
export const APP_DAY_START_HOUR = 4
export const EVENING_START_HOUR = 19
export const DEFAULT_BEDTIME_HOUR = 23
export const MIN_ENTRIES_FOR_SAISI = 2
export const MIN_SAISI_DAYS_FOR_WEEK = 4
export const FOOD_WATER_FACTOR_LOW = 0.25
export const FOOD_WATER_FACTOR_HIGH = 0.43
export const ADULT_MIN_AGE = 18
export const SENIOR_MIN_AGE = 65

export type HydrationSex = 'male' | 'female' | 'homme' | 'femme' | 'M' | 'F' | 'H'

export type HydrationEntry = {
  /** Local clock hour on the app day (0–23). 0–3 count as late evening. */
  hour: number
  /** Volume in litres. */
  volumeL: number
  /** Drink kind key, e.g. eau, cafe, soda. */
  kind: string
}

export type SportSession = {
  /** Local start hour (0–23). */
  startHour: number
  durationMin: number
}

export type HydrationDay = {
  /** 0 = oldest day of the 7-day window, 6 = newest. */
  dayIndex: number
  entries: HydrationEntry[]
  sports?: SportSession[]
  /** Bedtime hour; default 23. */
  bedtimeHour?: number
}

export type HydrationEtatQ = {
  /** État 1 — « Tu bois moins pour éviter les toilettes… ? » */
  toilettes?: boolean
  /** État 2 — « Tu as rarement soif ? » */
  rarementSoif?: boolean
  /** État 4 — « Compter devient pesant ? » */
  comptagePesant?: boolean
  /** État 4 — user chose « Faire une pause ». */
  pauseComptage?: boolean
  /** État 5 — « Tu bois même sans soif pour finir l'objectif ? » */
  sansSoifObjectif?: boolean
  /** État 8 — « Il faisait chaud ou tu as beaucoup transpiré ? » */
  chaudOuTranspire?: boolean
  /** État 9 — « L'eau plate, ce n'est pas ton truc ? » */
  eauPlatePasTonTruc?: boolean
}

export type HydrationEtatInput = {
  days: HydrationDay[]
  age: number
  sex: HydrationSex
  weightKg?: number
  q?: HydrationEtatQ
  /** Module masqué → état 3. */
  moduleHidden?: boolean
  /**
   * Consecutive days without any entry beyond / including the trailing gap
   * (état 10 → 3 after 14 days).
   */
  daysWithoutEntry?: number
}

export type HydrationEtatVariant = 'minor' | 'adult'

export type HydrationEtatResult = {
  id: number
  title: string
  texte: string
  actions: string[]
  aide?: string
  /** Set for état 7 (mineur vs adulte). */
  variant?: HydrationEtatVariant
  /** État 5 blocks « boire plus » tips (1, 2, 6, 9). */
  blocksDrinkMore: boolean
  /** True when id is 7 and age < 18 — never suggest caffeinated drinks. */
  neverSuggestCaffeinated: boolean
  /** Days with ≥2 entries. */
  saisiDays: number
}

export type DrinkRepereRange = {
  lowL: number
  highL: number
  label: string
}

export type TotalWaterRange = {
  lowL: number
  highL: number
  label: string
}

const WATER_KINDS = new Set([
  'eau',
  'water',
  'eau_plate',
  'eau_gazeuse',
  'eau_petillante',
  'eau_pétillante',
  'infusion',
  'tisane',
  'eau_citron',
  'eau_aromatisee',
  'eau_aromatisée',
  'eau_menthe',
])

const CAFFEINATED_KINDS = new Set([
  'cafe',
  'café',
  'coffee',
  'the',
  'thé',
  'tea',
  'cola',
  'soda_cafeine',
  'soda_caféine',
  'boisson_energetique',
  'boisson_énergisante',
  'energy',
  'energy_drink',
])

const SUGARY_KINDS = new Set([
  'soda',
  'jus',
  'juice',
  'sirop',
  'boisson_energetique',
  'boisson_énergisante',
  'energy',
  'energy_drink',
  'cola',
  'nectar',
])

function normKind(kind: string): string {
  return kind.trim().toLowerCase().replace(/\s+/g, '_')
}

/** True for eau, eau gazeuse, infusion, eau citron (and similar). */
export function countsAsWater(kind: string): boolean {
  return WATER_KINDS.has(normKind(kind))
}

export function isCaffeinated(kind: string): boolean {
  return CAFFEINATED_KINDS.has(normKind(kind))
}

export function isSugaryOrCaffeinated(kind: string): boolean {
  const k = normKind(kind)
  return SUGARY_KINDS.has(k) || CAFFEINATED_KINDS.has(k)
}

function isMale(sex: HydrationSex): boolean {
  const s = String(sex).toLowerCase()
  return s === 'male' || s === 'homme' || s === 'm' || s === 'h'
}

/**
 * EFSA beverage ranges (part boissons).
 * 14+ : men 1.75–2.0, women 1.4–1.6.
 * 65+ : at least 2.0 / 1.6 (ESPEN).
 */
export function drinkRepereRange(age: number, sex: HydrationSex): DrinkRepereRange {
  const male = isMale(sex)
  if (age >= SENIOR_MIN_AGE) {
    const lowL = male ? 2.0 : 1.6
    return {
      lowL,
      highL: lowL,
      label: male
        ? 'au moins 2,0 L de boissons (repère)'
        : 'au moins 1,6 L de boissons (repère)',
    }
  }
  if (age >= 14) {
    return male
      ? { lowL: 1.75, highL: 2.0, label: 'environ 1,75 à 2,0 L de boissons (repère)' }
      : { lowL: 1.4, highL: 1.6, label: 'environ 1,4 à 1,6 L de boissons (repère)' }
  }
  if (age >= 9) {
    return male
      ? { lowL: 1.5, highL: 1.7, label: 'environ 1,5 à 1,7 L de boissons (repère)' }
      : { lowL: 1.3, highL: 1.5, label: 'environ 1,3 à 1,5 L de boissons (repère)' }
  }
  // 4–8 ans
  return { lowL: 1.1, highL: 1.3, label: 'environ 1,1 à 1,3 L de boissons (repère)' }
}

/**
 * Total water estimate: boissons + aliments (aliments ≈ boissons × 0,25–0,43).
 */
export function estimatedTotalWaterRange(drunkL: number): TotalWaterRange {
  const lowL = round1(drunkL * (1 + FOOD_WATER_FACTOR_LOW))
  const highL = round1(drunkL * (1 + FOOD_WATER_FACTOR_HIGH))
  return {
    lowL,
    highL,
    label: `environ ${fmtL(lowL)} à ${fmtL(highL)} L`,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function fmtL(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2
}

type DayStats = {
  dayIndex: number
  entryCount: number
  saisi: boolean
  V: number
  Vtot: number
  Vevening: number
  Vlast2h: number
  eveningShare: number
  sugaryCaffL: number
  caffeinatedDrinkCount: number
  hasSportAfter17: boolean
  hasLongSport: boolean
  bedtimeHour: number
}

function hourOnAppDay(hour: number): number {
  // Keep 0–3 as late evening of the same app day (after midnight).
  return ((hour % 24) + 24) % 24
}

function isEveningHour(hour: number, bedtime: number): boolean {
  const h = hourOnAppDay(hour)
  const bed = bedtime <= EVENING_START_HOUR ? bedtime + 24 : bedtime
  const hAdj = h < APP_DAY_START_HOUR ? h + 24 : h
  return hAdj >= EVENING_START_HOUR && hAdj < bed
}

function isLast2h(hour: number, bedtime: number): boolean {
  const h = hourOnAppDay(hour)
  const bed = bedtime < APP_DAY_START_HOUR ? bedtime + 24 : bedtime
  const hAdj = h < APP_DAY_START_HOUR ? h + 24 : h
  const start = bed - 2
  return hAdj >= start && hAdj < bed
}

function dayStats(day: HydrationDay): DayStats {
  const bedtime = day.bedtimeHour ?? DEFAULT_BEDTIME_HOUR
  let V = 0
  let Vtot = 0
  let Vevening = 0
  let Vlast2h = 0
  let sugaryCaffL = 0
  let caffeinatedDrinkCount = 0

  for (const e of day.entries) {
    const vol = e.volumeL
    Vtot += vol
    if (countsAsWater(e.kind)) V += vol
    if (isSugaryOrCaffeinated(e.kind)) sugaryCaffL += vol
    if (isCaffeinated(e.kind)) caffeinatedDrinkCount += 1
    if (isEveningHour(e.hour, bedtime)) Vevening += vol
    if (isLast2h(e.hour, bedtime)) Vlast2h += vol
  }

  const sports = day.sports ?? []
  const hasSportAfter17 = sports.some((s) => s.startHour >= 17)
  const hasLongSport = sports.some((s) => s.durationMin >= 60)

  return {
    dayIndex: day.dayIndex,
    entryCount: day.entries.length,
    saisi: day.entries.length >= MIN_ENTRIES_FOR_SAISI,
    V,
    Vtot,
    Vevening,
    Vlast2h,
    eveningShare: Vtot > 0 ? Vevening / Vtot : 0,
    sugaryCaffL,
    caffeinatedDrinkCount,
    hasSportAfter17,
    hasLongSport,
    bedtimeHour: bedtime,
  }
}

function emptyResult(
  id: number,
  saisiDays: number,
  variant?: HydrationEtatVariant,
): HydrationEtatResult {
  if (id === 0) {
    return {
      id: 0,
      title: '',
      texte: '',
      actions: [],
      blocksDrinkMore: false,
      neverSuggestCaffeinated: false,
      saisiDays,
    }
  }
  const neverCaf = id === 7 && variant === 'minor'
  return {
    id,
    title: ETAT_TITLES[id] ?? '',
    texte: getEtatTexte(id),
    actions: getEtatActions(id, variant),
    aide: getEtatAide(id, variant),
    variant: id === 7 ? variant : undefined,
    blocksDrinkMore: id === 5,
    neverSuggestCaffeinated: neverCaf,
    saisiDays,
  }
}

function matchEtat5(days: DayStats[], q: HydrationEtatQ): boolean {
  const highDays = days.filter((d) => d.V >= 3.0).length
  return highDays >= 2 || q.sansSoifObjectif === true
}

function matchEtat7(days: DayStats[]): boolean {
  const saisi = days.filter((d) => d.saisi)
  const halfSugary = saisi.filter(
    (d) => d.Vtot > 0 && d.sugaryCaffL / d.Vtot >= 0.5,
  ).length
  if (halfSugary >= 4) return true
  return saisi.some((d) => d.caffeinatedDrinkCount >= 5)
}

function matchEtat2(days: DayStats[], age: number, q: HydrationEtatQ): boolean {
  if (age < SENIOR_MIN_AGE) return false
  if (q.rarementSoif === true) return true
  const low = days.filter((d) => d.saisi && (d.V < 1.0 || d.Vtot < 1.6)).length
  return low >= 4
}

function matchEtat6(days: DayStats[]): boolean {
  const eligible = days.filter((d) => d.saisi && !d.hasSportAfter17)
  const hits = eligible.filter(
    (d) =>
      (d.Vevening >= 1.0 && d.eveningShare >= 0.6) || d.Vlast2h >= 0.5,
  )
  return hits.length >= 3
}

function matchEtat1(days: DayStats[], q: HydrationEtatQ): boolean {
  if (q.toilettes !== true) return false
  const low = days.filter((d) => d.saisi && d.V < 1.0).length
  return low >= 3
}

function matchEtat9(days: DayStats[], q: HydrationEtatQ): boolean {
  if (q.eauPlatePasTonTruc !== true) return false
  const saisi = days.filter((d) => d.saisi).length
  if (saisi >= 4) {
    const low = days.filter((d) => d.saisi && d.V < 1.0).length
    return low >= 4 || q.eauPlatePasTonTruc === true
  }
  // Q at welcome
  return true
}

function matchEtat4(days: DayStats[], q: HydrationEtatQ): boolean {
  if (q.pauseComptage === true) return true
  if (q.comptagePesant !== true) return false
  const saisi = days.filter((d) => d.saisi)
  if (saisi.length < 4) return false
  // médiane d'au moins 12 saisies par jour sur 4 jours
  const top4 = [...saisi].sort((a, b) => b.entryCount - a.entryCount).slice(0, 4)
  return median(top4.map((d) => d.entryCount)) >= 12
}

function matchEtat10(
  days: DayStats[],
  daysWithoutEntry: number,
): boolean {
  if (daysWithoutEntry >= 14) return false
  const ordered = [...days].sort((a, b) => a.dayIndex - b.dayIndex)
  if (ordered.length < 5) return false
  const first3 = ordered.slice(0, 3)
  const med = median(first3.map((d) => d.entryCount))
  if (med < 6) return false
  const trailingEmpty = ordered.slice(3).filter((d) => d.entryCount === 0).length
  return trailingEmpty >= 2
}

function matchEtat3(
  days: DayStats[],
  moduleHidden: boolean | undefined,
  daysWithoutEntry: number,
): boolean {
  if (moduleHidden) return true
  if (daysWithoutEntry >= 14) return true
  const totalEntries = days.reduce((n, d) => n + d.entryCount, 0)
  return totalEntries === 0
}

function matchEtat8(days: DayStats[], q: HydrationEtatQ): boolean {
  if (q.chaudOuTranspire !== true) return false
  const sportDays = days.filter((d) => d.hasLongSport)
  if (sportDays.length === 0) return false
  const nonSport = days.filter((d) => d.saisi && !d.hasLongSport)
  if (nonSport.length === 0) return false
  const medNonSport = median(nonSport.map((d) => d.V))
  return sportDays.some((d) => d.V <= medNonSport)
}

/**
 * Weekly tip state (one card). Priority C:
 * 0. &lt;4 days saisis → no week state (except 3 and 10)
 * 5 → 7-minor → 2 → 6 → 1 → 9 → 7-adult → 4 → 10 → 3
 * État 8 is a day card: returned only when no week tip wins.
 */
export function detectHydrationEtat(input: HydrationEtatInput): HydrationEtatResult {
  const q = input.q ?? {}
  const days = (input.days ?? []).map(dayStats)
  const saisiDays = days.filter((d) => d.saisi).length
  const daysWithoutEntry = input.daysWithoutEntry ?? 0
  const enoughDays = saisiDays >= MIN_SAISI_DAYS_FOR_WEEK

  type Candidate = { id: number; variant?: HydrationEtatVariant }
  const candidates: Candidate[] = []

  const push = (id: number, ok: boolean, variant?: HydrationEtatVariant) => {
    if (ok) candidates.push({ id, variant })
  }

  // États 3 & 10 always eligible (exception to 4-day rule).
  push(10, matchEtat10(days, daysWithoutEntry))
  push(3, matchEtat3(days, input.moduleHidden, daysWithoutEntry))

  if (enoughDays) {
    push(5, matchEtat5(days, q))
    const etat7 = matchEtat7(days)
    if (input.age < ADULT_MIN_AGE) {
      push(7, etat7, 'minor')
    }
    push(2, matchEtat2(days, input.age, q))
    push(6, matchEtat6(days))
    push(1, matchEtat1(days, q))
    push(9, matchEtat9(days, q))
    if (input.age >= ADULT_MIN_AGE) {
      push(7, etat7, 'adult')
    }
    push(4, matchEtat4(days, q))
  }

  // Priority order (C). 7-minor before 7-adult via variant + age already split.
  const PRIORITY: Array<{ id: number; variant?: HydrationEtatVariant }> = [
    { id: 5 },
    { id: 7, variant: 'minor' },
    { id: 2 },
    { id: 6 },
    { id: 1 },
    { id: 9 },
    { id: 7, variant: 'adult' },
    { id: 4 },
    { id: 10 },
    { id: 3 },
  ]

  for (const p of PRIORITY) {
    const hit = candidates.find(
      (c) => c.id === p.id && (p.variant == null || c.variant === p.variant),
    )
    if (hit) {
      return emptyResult(hit.id, saisiDays, hit.variant)
    }
  }

  // Day card (état 8) — may add when no week tip.
  if (enoughDays && matchEtat8(days, q)) {
    return emptyResult(8, saisiDays)
  }

  return emptyResult(0, saisiDays)
}
