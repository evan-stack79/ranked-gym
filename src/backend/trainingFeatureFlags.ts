import { parseBooleanFlag } from './featureFlag'

/**
 * Flags UX Training — désactivables indépendamment.
 * Unset : ON en DEV / test (`import.meta.env.DEV` ou `MODE === 'test'`),
 * OFF en production pour rester respectueux du runtime existant.
 * Valeur explicite (`true` / `false`) toujours honorée.
 */
export function resolveTrainingUxFlag(raw: string | undefined): boolean {
  if (typeof raw === 'string' && raw.trim() !== '') {
    return parseBooleanFlag(raw)
  }
  try {
    return import.meta.env.DEV === true || import.meta.env.MODE === 'test'
  } catch {
    return false
  }
}

export function isTrainingRecommendationsEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_TRAINING_RECOMMENDATIONS,
): boolean {
  return resolveTrainingUxFlag(raw)
}

export function isAutoSetValidationEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_AUTO_SET_VALIDATION,
): boolean {
  return resolveTrainingUxFlag(raw)
}

export function isSportsOnboardingEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_SPORTS_ONBOARDING,
): boolean {
  return resolveTrainingUxFlag(raw)
}
