export { IOM_EER, IOM_PA, KCAL_PER_G, ENERGY_ROUND_TOLERANCE_KCAL } from './constants/iom'
export { ERROR_CODES, engineError } from './errors'
export type { ErrorCode } from './errors'
export {
  runNutritionEngine,
  runNutritionEngineApi,
  runNutritionEngineWithTarget,
  serializeEngineResult,
  formatApiPayload,
} from './engine'
export { computeEer, computeTargetKcal } from './eer'
export { computeBcmrKcal, macrosToKcal } from './bcmr'
export { allocateWaterfall, assertAllocationInvariants } from './waterfall'
export { resolveSportFlags, resolveMacroConstraints, resolveProteinMinGPerKg, resolveProteinTargetGPerKg, hasAnySport } from './sportConstraints'
export { buildRecommendations } from './recommendations'
export { validateInput, validateForbiddenActivityFields } from './validation'
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
} from './types'
