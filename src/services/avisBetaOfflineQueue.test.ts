/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => 'user-q'),
}))

vi.mock('./convexAvisBetaService', () => ({
  submitAvisBeta: vi.fn(),
}))

import { getActiveCloudUserId } from './cloudSession'
import { submitAvisBeta } from './convexAvisBetaService'
import { AVIS_BETA_QUEUE_PREFIX } from './clearAvisBetaLocalData'
import {
  enqueueAvisOffline,
  flushAvisBetaQueue,
} from './avisBetaOfflineQueue'

describe('avisBetaOfflineQueue (AV-07)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getActiveCloudUserId).mockReturnValue('user-q')
    vi.mocked(submitAvisBeta).mockReset()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('conserve l’avis en file si limite journalière (pas de perte silencieuse)', async () => {
    enqueueAvisOffline({
      type: 'bug',
      texte: 'Message hors ligne assez long.',
      page: 'Réglages',
      version: 'test',
      cleAntiDoublon: 'q-1',
      consentementAccepte: true,
    })
    const key = `${AVIS_BETA_QUEUE_PREFIX}user-q`
    expect(JSON.parse(localStorage.getItem(key) ?? '[]')).toHaveLength(1)

    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: false,
      error: 'AVIS_BETA_DAILY_LIMIT',
    })

    await flushAvisBetaQueue()
    expect(JSON.parse(localStorage.getItem(key) ?? '[]')).toHaveLength(1)
  })

  it('retire l’avis après envoi réussi', async () => {
    enqueueAvisOffline({
      type: 'idee',
      texte: 'Idée hors ligne assez longue.',
      page: 'Réglages',
      version: 'test',
      cleAntiDoublon: 'q-2',
      consentementAccepte: true,
    })
    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: true,
      avisId: 'avis_ok',
      statut: 'nouveau',
      signalUrgent: false,
      distressLevel: 0,
      motsMasques: false,
      duplicate: false,
      needsReformulation: false,
    })
    await flushAvisBetaQueue()
    expect(JSON.parse(localStorage.getItem(`${AVIS_BETA_QUEUE_PREFIX}user-q`) ?? '[]')).toHaveLength(
      0,
    )
  })

  it('AV-17 — ne force pas forcerEnvoiAvecInsultes si non choisi', async () => {
    enqueueAvisOffline({
      type: 'bug',
      texte: 'Cette merde de chrono plante encore.',
      page: 'Réglages',
      version: 'test',
      cleAntiDoublon: 'q-insult',
      consentementAccepte: true,
    })
    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: false,
      error: 'AVIS_BETA_VALIDATION',
      reason: 'insults',
      needsReformulation: true,
    })
    await flushAvisBetaQueue()
    expect(vi.mocked(submitAvisBeta).mock.calls[0]?.[0].forcerEnvoiAvecInsultes).toBeUndefined()
    expect(JSON.parse(localStorage.getItem(`${AVIS_BETA_QUEUE_PREFIX}user-q`) ?? '[]')).toHaveLength(
      1,
    )
  })
})
