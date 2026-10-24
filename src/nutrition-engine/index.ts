export {
  IOM_EER,
  IOM_PA,
  KCAL_PER_G,
  ENERGY_ROUND_TOLERANCE_KCAL,
  API_INTEGER_ENERGY_TOLERANCE_KCAL,
} from './constants/iom.ts'
export {
  CARB_REVIEW_THRESHOLD_G_PER_KG,
  LIP_TARGET_PCT,
  LIP_MAX_PCT,
  PROTEIN_MAX_G_PER_KG,
  ALLOCATION_FLAGS,
} from './constants/policy.ts'
export type { AllocationFlag } from './constants/policy.ts'
export { ERROR_CODES, engineError } from './errors.ts'
export type { ErrorCode } from './errors.ts'
export {
  runNutritionEngine,
  runNutritionEngineApi,
  runNutritionEngineWithTarget,
  serializeEngineResult,
  formatApiPayload,
  reconcileApiIntegerMacros,
} from './engine.ts'
export { computeEer, computeTargetKcal } from './eer.ts'
export { computeBcmrKcal, macrosToKcal } from './bcmr.ts'
export { allocateWaterfall, assertAllocationInvariants } from './waterfall.ts'
export { applyCarbReviewRedistribution } from './redistribute.ts'
export {
  resolveSportFlags,
  resolveMacroConstraints,
  resolveProteinMinGPerKg,
  resolveProteinTargetGPerKg,
  hasAnySport,
} from './sportConstraints.ts'
export { buildRecommendations } from './recommendations.ts'
export { validateInput, validateForbiddenActivityFields } from './validation.ts'
export {
  diaryRollup,
  weeklyMeanKcal,
  displayedKcal,
  nutritionTargetKcal,
  nutritionDayCache,
  nutritionDayInputsHash,
} from './diaryRollup.ts'
export type { DiaryMealInput, DiaryRollup, DiaryWaterInput, NutritionDayCache } from './diaryRollup.ts'
export {
  MEALS_COMPLETE_XP,
  PROTEIN_GOAL_XP,
  NUTRITION_XP_DAY_CAP,
  evaluateNutritionXp,
  xpForKind,
} from './nutritionXp.ts'
export type { NutritionAwardKind, NutritionXpEvaluation } from './nutritionXp.ts'
export {
  PROTEIN_GOAL_HALF_LIFE_FACTOR,
  applyProteinGoalToDay,
  halfLifeFactorForProteinGoal,
} from './proteinGoalFreshness.ts'
export { readHomeNutritionDay } from './homeRead.ts'
export type { HomeNutritionRead } from './homeRead.ts'
export type {
  ActivityLevel,
  EffortIntensity,
  MacroFloorsAndTargets,
  MacroGrams,
  NutritionEngineFailure,
  NutritionEngineInput,
  NutritionEngineResult,
  NutritionEngineSuccess,
  NutritionGoal,
  Sex,
} from './types.ts'
