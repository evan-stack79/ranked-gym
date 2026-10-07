import { describe, expect, it } from 'vitest'
import {
  AVIS_MOTS_DETRESSE_NIVEAU_1,
  AVIS_MOTS_DETRESSE_NIVEAU_2,
  detectDistressLevel,
  matchesDistressPhrase,
  normalizeForMatch,
} from '../../convex/avisDistress'

describe('normalizeForMatch (apostrophes / accents / tirets)', () => {
  it('normalise l’apostrophe typographique ’ vers \'', () => {
    expect(normalizeForMatch("j’ai envie de mourir")).toBe("j'ai envie de mourir")
    expect(normalizeForMatch('j‘en peux plus')).toContain("j'en peux plus")
  })

  it('retire les accents et réduit les espaces', () => {
    expect(normalizeForMatch('  Détresse   profonde  ')).toBe('detresse profonde')
  })

  it('AV-14 / AV-26 — tirets/dashes → espaces (sans escape inutile de -)', async () => {
    expect(normalizeForMatch('envie-de-mourir')).toBe('envie de mourir')
    expect(normalizeForMatch('envie–de–mourir')).toBe('envie de mourir')
    expect(detectDistressLevel('envie-de-mourir')).toBe(2)
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'convex/avisDistress.ts'), 'utf8')
    expect(src).toMatch(/\[\\u2010-\\u2015\\u2212-\]/)
    expect(src).not.toMatch(/\\u2212\\-/)
  })
})

describe('Q5 — numéros 3114 / 15 / (112), jamais 0 810', () => {
  it('les textes niveau 2 citent 3114, 15 et 112 entre parenthèses', async () => {
    const copy = await import('../content/betaFeedbackCopy')
    expect(copy.BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE).toContain('3114')
    expect(copy.BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE).toContain('15')
    expect(copy.BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE).toMatch(/15 \(ou le 112\)/)
    expect(copy.BETA_FEEDBACK_TEL_3114).toBe('tel:3114')
    expect(copy.BETA_FEEDBACK_TEL_15).toBe('tel:15')
  })

  it('n’affiche jamais l’ancien numéro 0 810 037 037', async () => {
    const feedback = await import('../content/betaFeedbackCopy')
    const safety = await import('../content/safetyCopy')
    const joined = [
      ...Object.values(feedback),
      safety.Q8_ECRAN_ORIENTATION,
      ...Object.values(safety.TCA_PHONE_DISPLAY),
      ...Object.values(safety.TCA_PHONE_TEL),
    ].join('\n')
    expect(joined).not.toMatch(/0\s*810\s*037\s*037/)
    expect(joined).not.toContain('0810037037')
    expect(joined).not.toContain('0 810 037 037')
  })

  it('écran Besoin d’en parler ? cite 15 (ou le 112)', async () => {
    const safety = await import('../content/safetyCopy')
    expect(safety.Q8_ECRAN_ORIENTATION).toMatch(/le 15 \(ou le 112\)/)
    expect(safety.Q8_ECRAN_ORIENTATION).not.toContain('0 810 037 037')
  })
})

describe('detectDistressLevel — niveaux + limites de mots', () => {
  it('niveau 2 pour idées suicidaires (y compris apostrophe iPhone)', () => {
    expect(detectDistressLevel("j’ai envie de mourir")).toBe(2)
    expect(detectDistressLevel('Je veux me suicider')).toBe(2)
  })

  it('niveau 1 pour TCA / mal-être', () => {
    expect(detectDistressLevel('Je me fais vomir après les repas')).toBe(1)
    expect(detectDistressLevel('J’en peux plus en ce moment')).toBe(1)
  })

  it('niveau 2 l’emporte si les deux niveaux sont détectés', () => {
    expect(
      detectDistressLevel('Anorexie et envie de me suicider en même temps'),
    ).toBe(2)
  })

  it('ne déclenche pas sur « en finir avec ce bug »', () => {
    expect(detectDistressLevel('Je veux en finir avec ce bug du chrono')).toBe(0)
    expect(matchesDistressPhrase(normalizeForMatch('en finir avec ce bug'), 'en finir')).toBe(
      false,
    )
  })

  it('déclenche « en finir » seul ou avec la vie / tout / ma vie / moi / mes jours', () => {
    expect(detectDistressLevel('Je veux en finir.')).toBe(2)
    expect(detectDistressLevel('envie d’en finir avec la vie')).toBe(2)
    expect(detectDistressLevel('en finir avec tout')).toBe(2)
    expect(detectDistressLevel('je veux en finir avec ma vie')).toBe(2)
    expect(detectDistressLevel('je veux en finir avec moi')).toBe(2)
    expect(detectDistressLevel('je veux en finir avec mes jours')).toBe(2)
    expect(AVIS_MOTS_DETRESSE_NIVEAU_2).toContain('en finir avec mes jours')
  })

  it('AV-14 — normalise l’apostrophe U+02BC', () => {
    expect(normalizeForMatch('jʼai envie de mourir')).toBe("j'ai envie de mourir")
    expect(detectDistressLevel('jʼai envie de mourir')).toBe(2)
  })

  it('ne déclenche pas sur « je mange plus de légumes »', () => {
    expect(detectDistressLevel('Je mange plus de légumes qu’avant')).toBe(0)
  })

  it('garde « j’en peux plus » en niveau 1 (y compris « de ce bug »)', () => {
    expect(detectDistressLevel("j'en peux plus")).toBe(1)
    expect(detectDistressLevel("j'en peux plus de ce bug")).toBe(1)
    expect(AVIS_MOTS_DETRESSE_NIVEAU_1).toContain("j'en peux plus")
  })

  it('listes non vides (section 7.4)', () => {
    expect(AVIS_MOTS_DETRESSE_NIVEAU_2.length).toBeGreaterThan(40)
    expect(AVIS_MOTS_DETRESSE_NIVEAU_1.length).toBeGreaterThan(40)
    expect(AVIS_MOTS_DETRESSE_NIVEAU_1).not.toContain('purge')
  })
})

describe('Vérificateur §7.4 — kms / je me coupe / overdose / purge', () => {
  it('kms : standalone L2 ; chiffre / lettres / déterminant → 0', () => {
    expect(detectDistressLevel('kms')).toBe(2)
    expect(detectDistressLevel('10 kms de course')).toBe(0)
    expect(detectDistressLevel('dix kms')).toBe(0)
    expect(detectDistressLevel('les kms parcourus')).toBe(0)
    expect(detectDistressLevel('mes kms de la semaine')).toBe(0)
    expect(detectDistressLevel('vingt kms')).toBe(0)
    expect(detectDistressLevel('demi kms')).toBe(0)
  })

  it('je me coupe : positif sauf ongles / cheveux / barbe / frange (AV-22 virgule)', () => {
    expect(detectDistressLevel('je me coupe quand ça va mal')).toBe(2)
    expect(detectDistressLevel('je me coupe les ongles')).toBe(0)
    expect(detectDistressLevel('je me coupe, les ongles')).toBe(0)
    expect(detectDistressLevel('je me coupe les cheveux')).toBe(0)
    expect(detectDistressLevel('je me coupe la barbe')).toBe(0)
    expect(detectDistressLevel('je me coupe la frange')).toBe(0)
  })

  it('overdose : formes ciblées seulement', () => {
    expect(detectDistressLevel('faire une overdose')).toBe(2)
    expect(detectDistressLevel('overdose de medicaments')).toBe(2)
    expect(detectDistressLevel('overdose de squats')).toBe(0)
  })

  it('purge seul retiré ; me purger / vomir gardés', () => {
    expect(detectDistressLevel('purge du cache')).toBe(0)
    expect(detectDistressLevel('je dois me purger')).toBe(1)
    expect(detectDistressLevel('je me fais vomir')).toBe(1)
  })
})
