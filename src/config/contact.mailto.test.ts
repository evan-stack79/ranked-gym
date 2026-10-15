import { describe, expect, it } from 'vitest'
import {
  SUPPORT_MAIL_SUBJECT,
  buildSupportMailtoHref,
} from './contact'

const FORBIDDEN_HEALTH = [
  /trouble/i,
  /\bTCA\b/i,
  /alimentaire/i,
  /âge/i,
  /age/i,
  /diabète/i,
  /diabete/i,
  /grossesse/i,
  /allaitement/i,
]

describe('mailto support — sujet/corps sans mots santé', () => {
  it('sujet fixe neutre et href sans mots santé', () => {
    expect(SUPPORT_MAIL_SUBJECT).toBe('Ranked Gym : demande de correction')
    const href = buildSupportMailtoHref('support@example.com')
    expect(href).toBeTruthy()
    const decoded = decodeURIComponent(href!)
    for (const re of FORBIDDEN_HEALTH) {
      expect(decoded, `interdit ${re} dans ${decoded}`).not.toMatch(re)
    }
    // Corps vide : pas de body=
    expect(decoded).not.toMatch(/body=/i)
    expect(decoded).toContain('subject=Ranked Gym : demande de correction')
  })
})
