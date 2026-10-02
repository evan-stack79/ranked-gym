import { parseBooleanFlag } from './featureFlag'

/**
 * Interrupteur de lancement SEC-NUT-02 — objectif calorique / perte de poids.
 *
 * Désactivé par défaut (variable absente = OFF = production actuelle).
 * Ne pas activer ici, ni dans `.env*`, ni dans la config de build Cloudflare.
 *
 * Mise en service uniquement après GO écrit d'Evan référençant la validation
 * du diététicien (DEV-RG-03).
 */
export function isCalorieGoalEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_CALORIE_GOAL,
): boolean {
  return parseBooleanFlag(raw)
}
