import { parseBooleanFlag } from './featureFlag'

/**
 * Interrupteur table Ciqual (ANSES) — OFF par défaut.
 * Aucune donnée nutritionnelle branchée tant que le Vérificateur Scientifique
 * n’a pas donné le feu vert. Ne pas activer en prod depuis ce dépôt.
 */
export function isCiqualEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_CIQUAL,
): boolean {
  return parseBooleanFlag(raw)
}
