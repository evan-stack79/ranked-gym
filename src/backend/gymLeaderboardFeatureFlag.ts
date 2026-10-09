import { parseBooleanFlag } from './featureFlag'

/**
 * « Classement de ma salle » sur Train.
 * Unset / vide ⇒ OFF (reste éteint jusqu’au GO). Explicit true pour activer.
 * Si le code PR #101 n’est pas sur main, la carte reste un placeholder vide derrière le flag.
 */
export function isGymLeaderboardEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_GYM_LEADERBOARD,
): boolean {
  return parseBooleanFlag(raw)
}
