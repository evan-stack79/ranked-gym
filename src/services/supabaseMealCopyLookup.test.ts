import { describe, expect, it } from 'vitest'
import { interpretSupabaseCopyLookup } from './supabaseMealCopyLookup'

describe('interpretSupabaseCopyLookup', () => {
  it('succès absent seulement si count === 0 confirmé et data null', () => {
    expect(
      interpretSupabaseCopyLookup({ data: null, error: null, count: 0 }),
    ).toEqual({ kind: 'absent' })
  })

  it('« 0 found » sans count confirmé → failure (pas de succès silencieux)', () => {
    expect(
      interpretSupabaseCopyLookup({ data: null, error: null, count: undefined }),
    ).toMatchObject({ kind: 'failure' })
    expect(
      interpretSupabaseCopyLookup({ data: null, error: null, count: null }),
    ).toMatchObject({ kind: 'failure' })
  })

  it('erreur réseau / réponse malformée → failure', () => {
    expect(
      interpretSupabaseCopyLookup({
        data: null,
        error: { message: 'timeout' },
        count: 0,
      }),
    ).toMatchObject({ kind: 'failure' })
    expect(
      interpretSupabaseCopyLookup({
        data: null,
        error: null,
        count: 2,
      }),
    ).toMatchObject({ kind: 'failure' })
  })

  it('ligne trouvée → found', () => {
    expect(
      interpretSupabaseCopyLookup({
        data: { journal: {}, user_id: 'u1' },
        error: null,
        count: 1,
      }),
    ).toEqual({ kind: 'found', row: { journal: {}, user_id: 'u1' } })
  })
})
