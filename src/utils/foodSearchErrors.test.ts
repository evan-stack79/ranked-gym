import { afterEach, describe, expect, it, vi } from 'vitest'
import { foodSearchErrorMessage, mapFoodSearchError } from './foodSearchErrors'

describe('mapFoodSearchError', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ne remonte jamais « Load failed » brut', () => {
    const mapped = mapFoodSearchError(new TypeError('Load failed'))
    expect(mapped.message.toLowerCase()).not.toContain('load failed')
    expect(mapped.retryable).toBe(true)
    expect(foodSearchErrorMessage(new TypeError('Load failed'))).toMatch(/connexion|hors ligne/i)
  })

  it('détecte offline via navigator', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(mapFoodSearchError(new Error('anything')).kind).toBe('offline')
  })

  it('mappe 503 / indisponible → service_down', () => {
    const mapped = mapFoodSearchError(new Error('Recherche Open Food Facts indisponible. Réessaie.'))
    expect(mapped.kind).toBe('service_down')
    expect(mapped.message).not.toMatch(/load failed/i)
  })

  it('mappe parse JSON', () => {
    expect(mapFoodSearchError(new SyntaxError('Unexpected token < in JSON')).kind).toBe('parse')
  })
})
