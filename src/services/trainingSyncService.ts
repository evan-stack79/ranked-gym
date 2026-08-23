import { flushCloudPushAsync } from './cloudBackup'
import { saveWorkoutNote, getTrainingState } from './trainingStorage'
import type { TrainingState, WorkoutNote } from '../types/training'
import { safeError } from '../utils/safeLog'

export type WorkoutSaveInput = Omit<WorkoutNote, 'id' | 'createdAt' | 'dateKey'> & { id?: string }

export type WorkoutSaveResult = {
  ok: boolean
  state: TrainingState
  error?: string
}

/**
 * Sauvegarde locale + upsert Supabase (`workouts.state` JSONB).
 * Attend la fin du push cloud (RLS owner-only sur `workouts`).
 */
export async function saveAndSyncWorkoutSession(
  note: WorkoutSaveInput,
  options?: { skipCloud?: boolean },
): Promise<WorkoutSaveResult> {
  let state: TrainingState
  try {
    state = saveWorkoutNote(note)
  } catch (error) {
    safeError('[trainingSync] local save failed', error)
    return { ok: false, state: getTrainingState(), error: 'Erreur de sauvegarde locale' }
  }

  if (options?.skipCloud) {
    return { ok: true, state }
  }

  try {
    const result = await flushCloudPushAsync()
    if (!result.ok) {
      safeError('[trainingSync] cloud upsert failed', result.error)
      return {
        ok: false,
        state,
        error: result.error?.includes('RLS')
          ? 'Erreur de synchro — droits Supabase (workouts). Vérifie la migration RLS.'
          : 'Erreur de synchro',
      }
    }
    return { ok: true, state }
  } catch (error) {
    safeError('[trainingSync] cloud exception', error)
    return { ok: false, state, error: 'Erreur de synchro' }
  }
}
