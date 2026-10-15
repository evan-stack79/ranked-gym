/**
 * Interprétation fail-closed des réponses Supabase pour la purge repas.
 * « 0 found » n’est un succès que si count === 0 est confirmé explicitement.
 */

export type SupabaseCopyLookupResult =
  | { kind: 'absent' }
  | { kind: 'found'; row: Record<string, unknown> }
  | { kind: 'failure'; reason: string }

export type SupabaseSelectLike = {
  data: unknown
  error: { message?: string } | null
  /** Doit être présent (number) — sinon réponse malformée / non confirmée. */
  count: number | null | undefined
}

/**
 * Succès « absent » uniquement si error == null, count === 0, data == null.
 * Toute autre forme (count manquant, data incohérent, erreur) → failure.
 */
export function interpretSupabaseCopyLookup(result: SupabaseSelectLike): SupabaseCopyLookupResult {
  if (result.error) {
    return { kind: 'failure', reason: result.error.message || 'SUPABASE_ERROR' }
  }
  if (typeof result.count !== 'number' || !Number.isFinite(result.count) || result.count < 0) {
    return { kind: 'failure', reason: 'SUPABASE_COUNT_UNCONFIRMED' }
  }
  if (result.count === 0) {
    if (result.data != null) {
      return { kind: 'failure', reason: 'SUPABASE_ABSENT_MALFORMED' }
    }
    return { kind: 'absent' }
  }
  if (result.data == null || typeof result.data !== 'object' || Array.isArray(result.data)) {
    return { kind: 'failure', reason: 'SUPABASE_ROW_MALFORMED' }
  }
  return { kind: 'found', row: result.data as Record<string, unknown> }
}
