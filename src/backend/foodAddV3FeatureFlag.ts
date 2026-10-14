import { parseBooleanFlag } from './featureFlag'

/**
 * Interrupteur « Ajouter un aliment » v3 (roue ARC, cartes photo, recherche Convex).
 *
 * Désactivé par défaut (variable absente = OFF).
 * Ne pas activer en prod via ce dépôt — le Studio Manager gère les env de build.
 */
export function isFoodAddV3Enabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_FOOD_ADD_V3,
): boolean {
  return parseBooleanFlag(raw)
}
