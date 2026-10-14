/**
 * Purge la partie repas de public.nutrition.journal et public.user_backups.payload.
 * Conserve le reste (eau, profil, train…). Échoue si Supabase est injoignable.
 */
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { stripMealsFromBackupPayload, stripMealsFromJournalJson } from '../utils/stripJournalMeals'
import { safeWarn } from '../utils/safeLog'

export const ERASE_MEALS_PURGE_FAILED_MESSAGE =
  'Impossible d’effacer toutes les copies en ligne. Réessaie.'

export class EraseMealsPurgeError extends Error {
  constructor(message = ERASE_MEALS_PURGE_FAILED_MESSAGE) {
    super(message)
    this.name = 'EraseMealsPurgeError'
  }
}

/**
 * Lit → retire les repas → réécrit. Absence de ligne = OK.
 * Toute erreur réseau / RLS / pause projet → throw EraseMealsPurgeError.
 */
export async function purgeSupabaseMealCopies(userId: string): Promise<{
  nutritionPurged: boolean
  userBackupsPurged: boolean
  skipped: boolean
}> {
  if (!userId) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  if (!isSupabaseConfigured()) {
    return { nutritionPurged: false, userBackupsPurged: false, skipped: true }
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // --- public.nutrition.journal ---
  const nutritionSelect = await supabase
    .from('nutrition')
    .select('journal, profile, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (nutritionSelect.error) {
    safeWarn('[erase-meals] nutrition select failed', nutritionSelect.error.message)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  let nutritionPurged = false
  if (nutritionSelect.data) {
    const nextJournal = stripMealsFromJournalJson(nutritionSelect.data.journal)
    const nutritionUpdate = await supabase
      .from('nutrition')
      .update({
        journal: nextJournal as never,
        updated_at: now,
      })
      .eq('user_id', userId)

    if (nutritionUpdate.error) {
      safeWarn('[erase-meals] nutrition update failed', nutritionUpdate.error.message)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    nutritionPurged = true
  }

  // --- public.user_backups.payload ---
  const backupSelect = await supabase
    .from('user_backups')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (backupSelect.error) {
    safeWarn('[erase-meals] user_backups select failed', backupSelect.error.message)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  let userBackupsPurged = false
  if (backupSelect.data) {
    const nextPayload = stripMealsFromBackupPayload(backupSelect.data.payload)
    const backupUpdate = await supabase
      .from('user_backups')
      .update({
        payload: nextPayload as never,
        updated_at: now,
      })
      .eq('user_id', userId)

    if (backupUpdate.error) {
      safeWarn('[erase-meals] user_backups update failed', backupUpdate.error.message)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    userBackupsPurged = true
  }

  return { nutritionPurged, userBackupsPurged, skipped: false }
}
