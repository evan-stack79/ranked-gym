export { IOM_EER, IOM_PA, KCAL_PER_G, ENERGY_ROUND_TOLERANCE_KCAL } from './constants/iom.ts'
export { ERROR_CODES, engineError } from './errors.ts'
export type { ErrorCode } from './errors.ts'
export {
  runNutritionEngine,
  runNutritionEngineApi,
  runNutritionEngineWithTarget,
  serializeEngineResult,
  formatApiPayload,
} from './engine.ts'
export { computeEer, computeTargetKcal } from './eer.ts'
export { computeBcmrKcal, macrosToKcal } from './bcmr.ts'
export { allocateWaterfall, assertAllocationInvariants } from './waterfall.ts'
export { resolveSportFlags, resolveMacroConstraints, resolveProteinMinGPerKg, resolveProteinTargetGPerKg, hasAnySport } from './sportConstraints.ts'
export { buildRecommendations } from './recommendations.ts'
export { validateInput, validateForbiddenActivityFields } from './validation.ts'
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
