/**
 * Compte serveur des repas dans public.nutrition.journal (mode legacy).
 * Identité via auth.getUser() — jamais un userId téléphone.
 */
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { countMealsInJournalJson, StripJournalParseError } from '../utils/stripJournalMeals'
import { interpretSupabaseCopyLookup } from './supabaseMealCopyLookup'
import { safeWarn } from '../utils/safeLog'

export async function countActiveMealsViaSupabase(): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_COUNT_UNAVAILABLE')
  }
  const supabase = getSupabase()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user?.id) {
    throw new Error('SUPABASE_COUNT_UNAVAILABLE')
  }
  const userId = authData.user.id

  const select = await supabase
    .from('nutrition')
    .select('journal, user_id', { count: 'exact' })
    .eq('user_id', userId)
    .maybeSingle()

  const lookup = interpretSupabaseCopyLookup({
    data: select.data,
    error: select.error,
    count: select.count,
  })

  if (lookup.kind === 'failure') {
    safeWarn('[erase-meals] supabase count failed', lookup.reason)
    throw new Error('SUPABASE_COUNT_UNAVAILABLE')
  }
  if (lookup.kind === 'absent') return 0
  if (lookup.row.user_id != null && lookup.row.user_id !== userId) {
    throw new Error('SUPABASE_COUNT_UNAVAILABLE')
  }
  try {
    return countMealsInJournalJson(lookup.row.journal)
  } catch (error) {
    if (error instanceof StripJournalParseError) {
      throw new Error('SUPABASE_COUNT_UNAVAILABLE')
    }
    throw error
  }
}
