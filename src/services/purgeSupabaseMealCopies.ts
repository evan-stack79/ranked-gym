/**
 * Purge la partie repas de public.nutrition.journal et public.user_backups.payload.
 * Identité : résolue via supabase.auth.getUser() — jamais un userId fourni par le téléphone.
 * Conserve eau / profil / train. Fail-closed si réponse vide, malformée ou injoignable.
 */
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  StripJournalParseError,
  countMealsInJournalJson,
  stripMealsFromBackupPayload,
  stripMealsFromJournalJson,
} from '../utils/stripJournalMeals'
import { interpretSupabaseCopyLookup } from './supabaseMealCopyLookup'
import { safeWarn } from '../utils/safeLog'

export const ERASE_MEALS_PURGE_FAILED_MESSAGE =
  'Impossible d’effacer toutes les copies en ligne. Réessaie.'

export class EraseMealsPurgeError extends Error {
  constructor(message = ERASE_MEALS_PURGE_FAILED_MESSAGE) {
    super(message)
    this.name = 'EraseMealsPurgeError'
  }
}

export type PurgeSupabaseMealCopiesResult = {
  /** Nombre de repas retirés des copies Supabase (serveur), jamais le count téléphone. */
  deletedCount: number
  nutritionStatus: 'purged' | 'absent'
  userBackupsStatus: 'purged' | 'absent'
  /** userId résolu côté auth Supabase (pas un argument client). */
  resolvedUserId: string
}

async function resolveAuthenticatedUserId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id || typeof data.user.id !== 'string') {
    safeWarn('[erase-meals] auth.getUser failed', error?.message)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  return data.user.id
}

/**
 * Purge Supabase pour l’utilisateur authentifié (JWT), sans accepter d’id client.
 */
export async function purgeSupabaseMealCopies(): Promise<PurgeSupabaseMealCopiesResult> {
  const userId = await resolveAuthenticatedUserId()
  const supabase = getSupabase()
  const now = new Date().toISOString()
  let deletedCount = 0

  // --- public.nutrition.journal ---
  const nutritionSelect = await supabase
    .from('nutrition')
    .select('journal, profile, updated_at, user_id', { count: 'exact' })
    .eq('user_id', userId)
    .maybeSingle()

  const nutritionLookup = interpretSupabaseCopyLookup({
    data: nutritionSelect.data,
    error: nutritionSelect.error,
    count: nutritionSelect.count,
  })

  let nutritionStatus: 'purged' | 'absent'
  if (nutritionLookup.kind === 'failure') {
    safeWarn('[erase-meals] nutrition lookup failed', nutritionLookup.reason)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  if (nutritionLookup.kind === 'absent') {
    nutritionStatus = 'absent'
  } else {
    const rowUserId = nutritionLookup.row.user_id
    if (rowUserId != null && rowUserId !== userId) {
      safeWarn('[erase-meals] nutrition user_id mismatch')
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    let nextJournal: Record<string, unknown>
    try {
      deletedCount += countMealsInJournalJson(nutritionLookup.row.journal)
      nextJournal = stripMealsFromJournalJson(nutritionLookup.row.journal)
    } catch (error) {
      if (error instanceof StripJournalParseError) {
        throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
      }
      throw error
    }
    const nutritionUpdate = await supabase
      .from('nutrition')
      .update({
        journal: nextJournal as never,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select('user_id')

    if (
      nutritionUpdate.error ||
      !Array.isArray(nutritionUpdate.data) ||
      nutritionUpdate.data.length < 1
    ) {
      safeWarn('[erase-meals] nutrition update failed', nutritionUpdate.error?.message)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    nutritionStatus = 'purged'
  }

  // --- public.user_backups.payload ---
  const backupSelect = await supabase
    .from('user_backups')
    .select('payload, updated_at, user_id', { count: 'exact' })
    .eq('user_id', userId)
    .maybeSingle()

  const backupLookup = interpretSupabaseCopyLookup({
    data: backupSelect.data,
    error: backupSelect.error,
    count: backupSelect.count,
  })

  let userBackupsStatus: 'purged' | 'absent'
  if (backupLookup.kind === 'failure') {
    safeWarn('[erase-meals] user_backups lookup failed', backupLookup.reason)
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }
  if (backupLookup.kind === 'absent') {
    userBackupsStatus = 'absent'
  } else {
    const rowUserId = backupLookup.row.user_id
    if (rowUserId != null && rowUserId !== userId) {
      safeWarn('[erase-meals] user_backups user_id mismatch')
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    let nextPayload: unknown
    try {
      const stripped = stripMealsFromBackupPayload(backupLookup.row.payload)
      deletedCount += stripped.mealsRemoved
      nextPayload = stripped.payload
    } catch (error) {
      if (error instanceof StripJournalParseError) {
        throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
      }
      throw error
    }
    const backupUpdate = await supabase
      .from('user_backups')
      .update({
        payload: nextPayload as never,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select('user_id')

    if (
      backupUpdate.error ||
      !Array.isArray(backupUpdate.data) ||
      backupUpdate.data.length < 1
    ) {
      safeWarn('[erase-meals] user_backups update failed', backupUpdate.error?.message)
      throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
    }
    userBackupsStatus = 'purged'
  }

  if (typeof deletedCount !== 'number' || !Number.isFinite(deletedCount)) {
    throw new EraseMealsPurgeError(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  }

  return {
    deletedCount,
    nutritionStatus,
    userBackupsStatus,
    resolvedUserId: userId,
  }
}
