/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  AVIS_BETA_DRAFT_KEY,
  AVIS_BETA_QUEUE_PREFIX,
  clearAvisBetaLocalData,
} from './clearAvisBetaLocalData'

describe('clearAvisBetaLocalData (AV-08)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('efface le brouillon et toutes les files hors ligne', () => {
    localStorage.setItem(AVIS_BETA_DRAFT_KEY, JSON.stringify({ texte: 'secret' }))
    localStorage.setItem(`${AVIS_BETA_QUEUE_PREFIX}user-a`, '[]')
    localStorage.setItem(`${AVIS_BETA_QUEUE_PREFIX}user-b`, '[]')
    localStorage.setItem('ranked-gym:other', 'keep')

    clearAvisBetaLocalData({ userId: 'user-a' })

    expect(localStorage.getItem(AVIS_BETA_DRAFT_KEY)).toBeNull()
    expect(localStorage.getItem(`${AVIS_BETA_QUEUE_PREFIX}user-a`)).toBeNull()
    expect(localStorage.getItem(`${AVIS_BETA_QUEUE_PREFIX}user-b`)).toBeNull()
    expect(localStorage.getItem('ranked-gym:other')).toBe('keep')
  })

  it('fonctionne aussi sans userId', () => {
    localStorage.setItem(AVIS_BETA_DRAFT_KEY, '{}')
    localStorage.setItem(`${AVIS_BETA_QUEUE_PREFIX}anon`, '[]')
    clearAvisBetaLocalData()
    expect(localStorage.getItem(AVIS_BETA_DRAFT_KEY)).toBeNull()
    expect(localStorage.getItem(`${AVIS_BETA_QUEUE_PREFIX}anon`)).toBeNull()
  })
})
