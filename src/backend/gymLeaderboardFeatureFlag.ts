import { parseBooleanFlag } from './featureFlag'

/**
 * « Classement de ma salle ».
 * Unset / empty ⇒ OFF in production builds (safe merge).
 * Explicit true in DEV / test / screenshot fixture.
 */
export function isGymLeaderboardEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_GYM_LEADERBOARD,
): boolean {
  if (typeof raw === 'string' && raw.trim() !== '') {
    return parseBooleanFlag(raw)
  }
  try {
    return import.meta.env.DEV === true || import.meta.env.MODE === 'test'
  } catch {
    return false
  }
}
