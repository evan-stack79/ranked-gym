import { describe, expect, it } from 'vitest'
import * as copy from './betaFeedbackCopy'

describe('betaFeedbackCopy lexicon', () => {
  it('n’utilise jamais le sigle RPE (SEC-TON-02)', () => {
    const joined = Object.values(copy).join('\n')
    expect(joined).not.toMatch(/\bRPE\b/)
  })

  it('expose les libellés principaux de la spec', () => {
    expect(copy.BETA_FEEDBACK_SETTINGS_LABEL).toBe('Donner mon avis')
    expect(copy.BETA_FEEDBACK_SUBMIT).toBe('Envoyer mon avis')
    expect(copy.BETA_FEEDBACK_SESSION_LINK).toBe('Une remarque ? Dis-le-nous')
    expect(copy.BETA_FEEDBACK_NEED_TO_TALK).toBe("Besoin d'en parler ?")
  })
})
