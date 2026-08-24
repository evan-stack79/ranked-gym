export { IOM_EER, IOM_PA, KCAL_PER_G, ENERGY_ROUND_TOLERANCE_KCAL } from './constants/iom'
export { ERROR_CODES, engineError } from './errors'
export type { ErrorCode } from './errors'
export {
  runNutritionEngine,
  runNutritionEngineApi,
  runNutritionEngineWithTarget,
  serializeEngineResult,
} from './engine'
export { computeEer, computeTargetKcal } from './eer'
export { computeBcmrKcal, macrosToKcal } from './bcmr'
export { allocateWaterfall } from './waterfall'
export { resolveSportFlags, resolveMacroConstraints } from './sportConstraints'
export { buildRecommendations } from './recommendations'
export { validateInput } from './validation'
export type {
  ActivityLevel,
  MacroFloorsAndTargets,
  MacroGrams,
  NutritionEngineFailure,
  NutritionEngineInput,
  NutritionEngineResult,
  NutritionEngineSuccess,
  NutritionGoal,
  Sex,
} from './types'
