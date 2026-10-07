import { describe, expect, it } from 'vitest'
import * as copy from './betaFeedbackCopy'

describe('betaFeedbackCopy lexicon + Vérificateur §7.1', () => {
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

  it('applique les 3 textes corrigés (hint, consent, urgents)', () => {
    expect(copy.BETA_FEEDBACK_TEXTE_HINT).toBe(
      "Pas besoin de parler de ta santé ici. Si ça ne va pas, tu peux trouver de l'aide dans « Besoin d'en parler ? ».",
    )
    expect(copy.BETA_FEEDBACK_CONSENT_MORE_BODY).toContain("Seule l'équipe de Ranked Gym")
    expect(copy.BETA_FEEDBACK_CONSENT_MORE_BODY).not.toContain('Studio Manager')
    expect(copy.BETA_FEEDBACK_CONFIRM_URGENT_TCA).toContain("tu n'es pas seul(e)")
    expect(copy.BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE).toContain('3114')
    expect(copy.BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE).toMatch(/15 \(ou le 112\)/)
    expect(copy.BETA_FEEDBACK_NO_REALTIME).toContain('ne pouvons pas répondre en urgence')
  })

  it('n’inclut jamais 0 810 037 037', () => {
    const joined = Object.values(copy).join('\n')
    expect(joined).not.toMatch(/0\s*810/)
  })

  it('AV-16 — libellés UI déplacés hors du JSX', () => {
    expect(copy.BETA_FEEDBACK_BACK).toBe('Retour')
    expect(copy.BETA_FEEDBACK_TYPE_GROUP_LABEL).toBe("Type d'avis")
    expect(copy.BETA_FEEDBACK_TEXTE_SR_LABEL).toBe('Ton avis')
    expect(copy.BETA_FEEDBACK_DRAFT_KEPT).toContain('Brouillon')
    expect(copy.BETA_FEEDBACK_EMPTY).toContain('Écris quelques mots')
    expect(copy.BETA_FEEDBACK_TOO_LONG).toContain('2 000')
  })
})
