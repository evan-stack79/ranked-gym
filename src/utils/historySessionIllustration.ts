import type { ExerciseEntry, WorkoutNote } from '../types/training'
import { resolvePickerIllustrationSrc } from './exercisePickerIllustrations'
import { namedSessionExercises } from './sessionDisplayTitle'

/** Compact history-row thumb — secondary, no tile. */
export const HISTORY_THUMB_PX = 44

export type HistoryIllustrationState = 'canonical' | 'multi' | 'fallback'

export type HistoryIllustration = {
  src: string | null
  state: HistoryIllustrationState
  canonicalId: string | null
}

type HistoryIllustrationInput =
  | Pick<WorkoutNote, 'exercises'>
  | ExerciseEntry[]
  | null
  | undefined

/**
 * Illustration de ligne historique.
 * - 1 exo + id canonique exact du manifeste → asset local validé
 * - plusieurs exos → visuel neutre musculation (pas d’image)
 * - custom / inconnu / id absent → fallback graphite
 * Jamais de fuzzy sur le nom. Jamais d’URL externe.
 */
export function resolveHistoryIllustration(
  input: HistoryIllustrationInput,
): HistoryIllustration {
  const exercises = Array.isArray(input) ? input : input?.exercises
  const named = namedSessionExercises(exercises)

  if (named.length > 1) {
    return { src: null, state: 'multi', canonicalId: null }
  }

  if (named.length === 1) {
    const canonicalId = named[0].canonicalExerciseId?.trim() || null
    if (!canonicalId) {
      return { src: null, state: 'fallback', canonicalId: null }
    }
    const src = resolvePickerIllustrationSrc(canonicalId)
    if (src) return { src, state: 'canonical', canonicalId }
    return { src: null, state: 'fallback', canonicalId }
  }

  return { src: null, state: 'fallback', canonicalId: null }
}
