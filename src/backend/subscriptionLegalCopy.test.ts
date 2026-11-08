import { describe, expect, it } from 'vitest'
import {
  PRO_DONATION_FORBIDDEN_PHRASES,
  PRO_L05_CHECKBOX_TEXT,
  PRO_L05B_MONTHLY,
  PRO_L05B_YEARLY,
  PRO_YEARLY_PRICE_LINE,
  proD02EngagementText,
} from '../../shared/subscriptions/legalCopy'
import { PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY } from '../../shared/subscriptions/constants'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Textes Juriste mot pour mot', () => {
  it('PRO-L05 / L05b exacts', () => {
    expect(PRO_L05_CHECKBOX_TEXT).toBe(
      "Je demande l'accès immédiat à Ranked Pro et je reconnais perdre mon droit de rétractation de 14 jours dès que cet accès commence.",
    )
    expect(PRO_L05B_MONTHLY).toContain('9,99 €/mois')
    expect(PRO_L05B_YEARLY).toContain('89,99 €/an')
    expect(PRO_YEARLY_PRICE_LINE).toBe('89,99 € / an, soit environ 7,50 € / mois')
  })

  it('PRO-D02 exact avec date + interdits absents de la page engagement', () => {
    const text = proD02EngagementText(PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY)
    expect(text).toBe(
      `Ranked Gym s'engage à reverser 6 % de son chiffre d'affaires (hors taxes et commissions des stores) à une association. L'association sera annoncée avant le ${PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY} et les montants versés seront publiés ici chaque trimestre.`,
    )
    const page = readFileSync(
      resolve(__dirname, '../components/pro/EngagementSixPercentPage.tsx'),
      'utf8',
    )
    const paywall = readFileSync(resolve(__dirname, '../components/pro/ProScreen.tsx'), 'utf8')
    for (const phrase of PRO_DONATION_FORBIDDEN_PHRASES) {
      if (phrase === 'don') {
        // Avoid false positive on French words containing "don" — check word-ish usage
        expect(page.toLowerCase()).not.toMatch(/\bdon\b/)
        expect(paywall.toLowerCase()).not.toMatch(/\bdon\b/)
        continue
      }
      expect(page.toLowerCase()).not.toContain(phrase.toLowerCase())
      expect(paywall.toLowerCase()).not.toContain(phrase.toLowerCase())
    }
    // Paywall must not talk about 6 % while no asso (CA-PRO27)
    expect(paywall).not.toMatch(/6\s*%/)
  })
})
