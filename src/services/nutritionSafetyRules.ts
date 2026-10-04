/**
 * Source unique de vérité — règles nutrition / populations (DEV-RG-03 lot 1).
 * Aucune dépendance React / localStorage. UI, stockage, hydratation et moteur
 * appellent ce module ; ne pas dupliquer les seuils ailleurs.
 *
 * Note produit : déficit max 600 kcal/j ≈ 0,54 kg/sem (7700 kcal/kg) — plus
 * restrictif que 0,9 kg/sem ; c'est voulu (SEC-NUT-03 / SEC-NUT-05).
 */
import { computeBmr } from '../utils/calories'
import type { CalorieProfile, NutritionGoal, Sex } from '../types/nutrition'
import { isCalorieGoalEnabled } from '../backend/calorieGoalFeatureFlag'
import {
  M_CAL_3,
  M_CAL_3_SOFT,
  M_INFO_1,
  Q1_18_ANS,
  Q1_PLUS_DE_78_ANS,
  Q1_TOUS_AGES,
  Q4_IMC,
  Q6B_GROSSESSE_ALLAITEMENT,
} from '../content/safetyCopy'

export const MINOR_AGE_THRESHOLD = 18
export const ABSOLUTE_CALORIE_FLOOR = 1200
export const SOFT_CALORIE_BAND_EXCLUSIVE_MAX = 1500
export const MAX_DAILY_DEFICIT_KCAL = 600
/** ~7700 kcal pour 1 kg de tissu adipeux. */
export const KCAL_PER_KG = 7700
export const MAX_WEEKLY_PACE_KG = 0.9
export const MAX_WEEKLY_PACE_PCT = 0.01
export const DEFAULT_WEEKLY_PACE_PCT = 0.005
export const BMI_LOSS_MIN_UNDER_70 = 18.5
/** Critère HAS 70 ans et plus — plus protecteur que le seuil générique 18,5. */
export const BMI_LOSS_MIN_AGE_70_PLUS = 22
export const PLAUSIBLE_AGE_MIN = 10
export const PLAUSIBLE_AGE_MAX = 120
export const MANUAL_PREGNANCY_FLOOR_KCAL = 1500

export type LossEligibilityReason =
  | 'eligible'
  | 'incomplete_profile'
  | 'minor'
  | 'age_18_no_loss'
  | 'age_over_75_no_loss'
  | 'pregnancy_or_breastfeeding'
  | 'eating_disorder'
  | 'low_bmi'
  | 'low_target_bmi'
  | 'calorie_goal_disabled'
  | 'prefer_not_to_answer_ok'

export type EstimationEligibilityReason =
  | 'allowed'
  | 'incomplete_profile'
  | 'minor'
  | 'pregnancy_or_breastfeeding'
  | 'eating_disorder'
  | 'calorie_goal_disabled'

export interface HealthDeclarations {
  pregnancy: boolean
  breastfeeding: boolean
  eatingDisorder: boolean
  preferNotToAnswer: boolean
}

export interface SafetyProfileInput {
  age: number | null | undefined
  weightKg: number | null | undefined
  heightCm: number | null | undefined
  sex: Sex | null | undefined
  goalWeightKg?: number | null | undefined
  goal?: NutritionGoal | null | undefined
  weeklyPaceKg?: number | null | undefined
  declarations?: Partial<HealthDeclarations> | null
}

export function readHealthDeclarations(
  input: Pick<CalorieProfile, 'declaredPregnancy' | 'declaredBreastfeeding' | 'declaredEatingDisorder' | 'preferNotAnswerHealth'> | SafetyProfileInput | null | undefined,
): HealthDeclarations {
  if (!input) {
    return { pregnancy: false, breastfeeding: false, eatingDisorder: false, preferNotToAnswer: false }
  }
  if ('declarations' in input && input.declarations) {
    const d = input.declarations
    return {
      pregnancy: Boolean(d.pregnancy),
      breastfeeding: Boolean(d.breastfeeding),
      eatingDisorder: Boolean(d.eatingDisorder),
      preferNotToAnswer: Boolean(d.preferNotToAnswer),
    }
  }
  const p = input as CalorieProfile
  return {
    pregnancy: Boolean(p.declaredPregnancy),
    breastfeeding: Boolean(p.declaredBreastfeeding),
    eatingDisorder: Boolean(p.declaredEatingDisorder),
    preferNotToAnswer: Boolean(p.preferNotAnswerHealth),
  }
}

export function isValidAge(age: unknown): age is number {
  return typeof age === 'number' && Number.isFinite(age) && age > 0 && age <= PLAUSIBLE_AGE_MAX
}

export function isPlausibleOnboardingAge(age: unknown): age is number {
  return typeof age === 'number' && Number.isFinite(age) && age >= PLAUSIBLE_AGE_MIN && age <= PLAUSIBLE_AGE_MAX
}

export function isMinorAge(age: unknown): boolean {
  return isValidAge(age) && age < MINOR_AGE_THRESHOLD
}

/** Compte mineur ou âge inconnu → mode protecteur (pas de classement / cibles). */
export function isMinorOrUnknownAge(age: unknown): boolean {
  if (!isValidAge(age)) return true
  return age < MINOR_AGE_THRESHOLD
}

export function computeBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
    return null
  }
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function lossBmiThreshold(age: number): number {
  return age >= 70 ? BMI_LOSS_MIN_AGE_70_PLUS : BMI_LOSS_MIN_UNDER_70
}

export function isProfileCompleteForNutrition(input: SafetyProfileInput): boolean {
  const ageOk = isValidAge(input.age)
  const weightOk =
    typeof input.weightKg === 'number' &&
    Number.isFinite(input.weightKg) &&
    input.weightKg >= 30 &&
    input.weightKg <= 250
  const heightOk =
    typeof input.heightCm === 'number' &&
    Number.isFinite(input.heightCm) &&
    input.heightCm >= 100 &&
    input.heightCm <= 250
  const sexOk = input.sex === 'male' || input.sex === 'female'
  return ageOk && weightOk && heightOk && sexOk
}

export function decideLossEligibility(
  input: SafetyProfileInput,
  opts?: { calorieGoalEnabled?: boolean },
): { eligible: boolean; reason: LossEligibilityReason } {
  const enabled = opts?.calorieGoalEnabled ?? isCalorieGoalEnabled()
  if (!enabled) {
    return { eligible: false, reason: 'calorie_goal_disabled' }
  }

  const declarations = readHealthDeclarations(input)
  if (declarations.eatingDisorder) {
    return { eligible: false, reason: 'eating_disorder' }
  }
  if (declarations.pregnancy || declarations.breastfeeding) {
    return { eligible: false, reason: 'pregnancy_or_breastfeeding' }
  }

  if (!isProfileCompleteForNutrition(input)) {
    return { eligible: false, reason: 'incomplete_profile' }
  }

  const age = input.age as number
  if (age < MINOR_AGE_THRESHOLD) {
    return { eligible: false, reason: 'minor' }
  }
  if (age === 18) {
    return { eligible: false, reason: 'age_18_no_loss' }
  }
  if (age > 75) {
    return { eligible: false, reason: 'age_over_75_no_loss' }
  }

  const bmi = computeBmi(input.weightKg as number, input.heightCm as number)
  if (bmi == null || bmi < lossBmiThreshold(age)) {
    return { eligible: false, reason: 'low_bmi' }
  }

  const goalWeight = input.goalWeightKg
  if (typeof goalWeight === 'number' && Number.isFinite(goalWeight) && goalWeight > 0) {
    const targetBmi = computeBmi(goalWeight, input.heightCm as number)
    if (targetBmi != null && targetBmi < BMI_LOSS_MIN_UNDER_70) {
      return { eligible: false, reason: 'low_target_bmi' }
    }
  }

  return { eligible: true, reason: 'eligible' }
}

export function decideEstimationEligibility(
  input: SafetyProfileInput,
  opts?: { calorieGoalEnabled?: boolean },
): { allowed: boolean; reason: EstimationEligibilityReason; disclaimer: string | null } {
  const enabled = opts?.calorieGoalEnabled ?? isCalorieGoalEnabled()
  // Estimation d'entretien peut s'afficher même si le drapeau objectif est OFF
  // uniquement comme mention sobre — mais pas de chiffre individuel pour mineurs /
  // grossesse. Avec drapeau OFF, on n'affiche pas de cible ; l'estimation chiffrée
  // d'entretien reste masquée côté UI (M-INFO-1 seul). Ici « allowed » = calcul
  // chiffré autorisé lorsque le drapeau est ON (assistant) ou pour tests injectés.
  const declarations = readHealthDeclarations(input)

  if (declarations.pregnancy || declarations.breastfeeding) {
    return { allowed: false, reason: 'pregnancy_or_breastfeeding', disclaimer: Q6B_GROSSESSE_ALLAITEMENT }
  }
  if (declarations.eatingDisorder) {
    return { allowed: false, reason: 'eating_disorder', disclaimer: M_INFO_1 }
  }
  if (!isProfileCompleteForNutrition(input)) {
    return { allowed: false, reason: 'incomplete_profile', disclaimer: null }
  }
  const age = input.age as number
  if (age < MINOR_AGE_THRESHOLD) {
    return { allowed: false, reason: 'minor', disclaimer: null }
  }
  if (!enabled) {
    return { allowed: false, reason: 'calorie_goal_disabled', disclaimer: M_INFO_1 }
  }

  let disclaimer = Q1_TOUS_AGES
  if (age === 18) disclaimer = Q1_18_ANS
  else if (age >= 79) disclaimer = Q1_PLUS_DE_78_ANS

  return { allowed: true, reason: 'allowed', disclaimer }
}

/** RMR Mifflin-St Jeor (réutilise computeBmr). */
export function estimateRmrKcal(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
): number {
  return computeBmr(weightKg, heightCm, age, sex)
}

export function effectiveCalorieFloor(rmrKcal: number): number {
  return Math.max(ABSOLUTE_CALORIE_FLOOR, Math.round(rmrKcal))
}

export type CalorieTargetDecision =
  | { ok: true; targetCalories: number; deficitKcal: number; softBandWarning: boolean }
  | { ok: false; reason: 'below_floor' | 'deficit_too_high' | 'invalid'; message: string; clampedTarget?: number }

/**
 * Applique plancher max(1200, RMR) et déficit ≤ 600.
 * 600 accepté, 601 ramené / refusé selon `mode`.
 */
export function evaluateCalorieTarget(args: {
  targetCalories: number
  maintenanceKcal: number
  rmrKcal: number
  mode?: 'clamp' | 'reject'
}): CalorieTargetDecision {
  const mode = args.mode ?? 'clamp'
  const floor = effectiveCalorieFloor(args.rmrKcal)
  const maintenance = Math.round(args.maintenanceKcal)
  let target = Math.round(args.targetCalories)

  if (!Number.isFinite(target) || !Number.isFinite(maintenance) || maintenance <= 0) {
    return { ok: false, reason: 'invalid', message: M_CAL_3 }
  }

  const minByDeficit = maintenance - MAX_DAILY_DEFICIT_KCAL
  const minAllowed = Math.max(floor, minByDeficit)

  if (target < ABSOLUTE_CALORIE_FLOOR || target < floor) {
    if (mode === 'reject') {
      return { ok: false, reason: 'below_floor', message: M_CAL_3, clampedTarget: minAllowed }
    }
    target = Math.max(target, minAllowed)
  }

  const deficit = maintenance - target
  if (deficit > MAX_DAILY_DEFICIT_KCAL) {
    if (mode === 'reject') {
      return {
        ok: false,
        reason: 'deficit_too_high',
        message: M_CAL_3,
        clampedTarget: Math.max(floor, maintenance - MAX_DAILY_DEFICIT_KCAL),
      }
    }
    target = Math.max(floor, maintenance - MAX_DAILY_DEFICIT_KCAL)
  }

  if (target < floor) {
    if (mode === 'reject') {
      return { ok: false, reason: 'below_floor', message: M_CAL_3, clampedTarget: floor }
    }
    target = floor
  }

  const finalDeficit = Math.max(0, maintenance - target)
  const softBandWarning = target >= ABSOLUTE_CALORIE_FLOOR && target < SOFT_CALORIE_BAND_EXCLUSIVE_MAX

  return {
    ok: true,
    targetCalories: target,
    deficitKcal: finalDeficit,
    softBandWarning,
  }
}

export function softBandMessage(targetCalories: number): string | null {
  if (targetCalories >= ABSOLUTE_CALORIE_FLOOR && targetCalories < SOFT_CALORIE_BAND_EXCLUSIVE_MAX) {
    return M_CAL_3_SOFT
  }
  return null
}

export function defaultWeeklyPaceKg(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return Math.min(0.5, maxWeeklyPaceKgWithDeficit(70))
  }
  const raw = roundPace(weightKg * DEFAULT_WEEKLY_PACE_PCT)
  // Le défaut ne doit jamais dépasser le plafond (dont déficit 600 kcal/j).
  return Math.min(raw, maxWeeklyPaceKgWithDeficit(weightKg))
}

export function maxWeeklyPaceKg(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return MAX_WEEKLY_PACE_KG
  const fromPct = weightKg * MAX_WEEKLY_PACE_PCT
  return roundPace(Math.min(MAX_WEEKLY_PACE_KG, fromPct))
}

/**
 * Plafond combiné avec déficit 600 kcal/j.
 * La contrainte la plus restrictive l'emporte : on ne doit jamais arrondir
 * au-dessus de l'équivalent 600 kcal/j (ex. 0,545… → 0,54 et non 0,55).
 */
export function maxWeeklyPaceKgWithDeficit(weightKg: number): number {
  const fromBody = maxWeeklyPaceKg(weightKg)
  const fromDeficit = (MAX_DAILY_DEFICIT_KCAL * 7) / KCAL_PER_KG
  return Math.min(fromBody, floorPace(fromDeficit))
}

export function clampWeeklyPaceKg(paceKg: number, weightKg: number): number {
  if (!Number.isFinite(paceKg) || paceKg <= 0) return 0
  const max = maxWeeklyPaceKgWithDeficit(weightKg)
  const clamped = Math.min(Math.max(0.1, paceKg), max)
  // Ne pas remonter au-dessus du plafond via un arrondi.
  return Math.min(roundPace(clamped), max)
}

function roundPace(n: number): number {
  return Math.round(n * 100) / 100
}

/** Arrondi vers le bas à 2 décimales — pour ne jamais dépasser un plafond kcal. */
function floorPace(n: number): number {
  return Math.floor(n * 100 + 1e-9) / 100
}

export function paceKgToDailyDeficit(paceKg: number): number {
  return Math.round((Math.max(0, paceKg) * KCAL_PER_KG) / 7)
}

export function messageForLossRefusal(reason: LossEligibilityReason): string | null {
  switch (reason) {
    case 'low_bmi':
    case 'low_target_bmi':
      return Q4_IMC
    case 'pregnancy_or_breastfeeding':
      return Q6B_GROSSESSE_ALLAITEMENT
    case 'age_18_no_loss':
      return Q1_18_ANS
    case 'age_over_75_no_loss':
      return Q1_TOUS_AGES
    case 'eating_disorder':
      return null
    default:
      return null
  }
}

/**
 * Normalise un profil pour la persistance : plafonne la vitesse, refuse sexe
 * par défaut « male ».
 * Drapeau OFF : les objectifs stockés sont conservés (ignorés à l'affichage uniquement).
 * Drapeau ON + inéligible à la perte : cut → maintain (pas d'objectif de perte actif).
 */
export function applySafetyToProfile(
  profile: CalorieProfile,
  opts?: { calorieGoalEnabled?: boolean },
): CalorieProfile {
  const enabled = opts?.calorieGoalEnabled ?? isCalorieGoalEnabled()
  const declarations = readHealthDeclarations(profile)
  const sex: Sex | null =
    profile.sex === 'female' || profile.sex === 'male' ? profile.sex : null

  let goal: NutritionGoal = profile.goal
  let weeklyPaceKg = profile.weeklyPaceKg

  const weightKg = Number.isFinite(profile.weightKg) ? profile.weightKg : 0
  if (goal !== 'maintain' && weeklyPaceKg > 0) {
    weeklyPaceKg = clampWeeklyPaceKg(weeklyPaceKg, weightKg)
  }

  let goalWeightKg = profile.goalWeightKg

  if (enabled) {
    const loss = decideLossEligibility(
      {
        age: profile.age,
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        sex,
        goalWeightKg: profile.goalWeightKg,
        declarations,
      },
      { calorieGoalEnabled: true },
    )
    if (!loss.eligible && goal === 'cut') {
      goal = 'maintain'
      weeklyPaceKg = 0
    }
  }

  if (goal === 'maintain') {
    weeklyPaceKg = 0
    // BUG-42 : en Maintien (drapeau ON), ne pas conserver un poids objectif de perte.
    if (
      enabled &&
      Number.isFinite(weightKg) &&
      weightKg > 0 &&
      Number.isFinite(goalWeightKg) &&
      goalWeightKg > 0 &&
      goalWeightKg < weightKg
    ) {
      goalWeightKg = weightKg
    }
  }

  return {
    ...profile,
    sex,
    goal,
    weeklyPaceKg,
    goalWeightKg,
    declaredPregnancy: declarations.pregnancy,
    declaredBreastfeeding: declarations.breastfeeding,
    declaredEatingDisorder: declarations.eatingDisorder,
    preferNotAnswerHealth: declarations.preferNotToAnswer,
  }
}

export function shouldShowCalorieGoalUi(opts?: { calorieGoalEnabled?: boolean }): boolean {
  return opts?.calorieGoalEnabled ?? isCalorieGoalEnabled()
}

export function shouldHideWeightAndCaloriesTracking(profile: SafetyProfileInput): boolean {
  if (isMinorAge(profile.age)) return true
  const d = readHealthDeclarations(profile)
  return d.eatingDisorder
}

export function canParticipateInRankings(profile: SafetyProfileInput): boolean {
  if (isMinorOrUnknownAge(profile.age)) return false
  const d = readHealthDeclarations(profile)
  if (d.eatingDisorder) return false
  return true
}

export function estimationDisclaimerForAge(age: number): string {
  if (age === 18) return Q1_18_ANS
  if (age >= 79) return Q1_PLUS_DE_78_ANS
  return Q1_TOUS_AGES
}

/** Garde-fou saisie manuelle grossesse/allaitement : jamais < 1500 présentée comme objectif. */
export function clampManualCaloriesDuringPregnancy(value: number): number {
  if (!Number.isFinite(value)) return MANUAL_PREGNANCY_FLOOR_KCAL
  return Math.max(MANUAL_PREGNANCY_FLOOR_KCAL, Math.round(value))
}
