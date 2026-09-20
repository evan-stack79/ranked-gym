import { describe, expect, it } from 'vitest'
import { classifyHydrateFailure } from './bootStatus'

describe('classifyHydrateFailure', () => {
  it('reste récupérable si le cache local ou le profil existe', () => {
    expect(classifyHydrateFailure({ hasProfile: true, hasLocalCache: false })).toBe('recoverable')
    expect(classifyHydrateFailure({ hasProfile: false, hasLocalCache: true })).toBe('recoverable')
  })

  it('est bloquant seulement sans aucune donnée', () => {
    expect(classifyHydrateFailure({ hasProfile: false, hasLocalCache: false })).toBe('blocking')
  })
})
