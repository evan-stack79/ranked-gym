import { describe, expect, it } from 'vitest'
import {
  AVIS_MOTS_DETRESSE_NIVEAU_1,
  AVIS_MOTS_DETRESSE_NIVEAU_2,
  detectDistressLevel,
  matchesDistressPhrase,
  normalizeForMatch,
} from '../../convex/avisDistress'

describe('normalizeForMatch (apostrophes / accents)', () => {
  it('normalise l’apostrophe typographique ’ vers \'', () => {
    expect(normalizeForMatch("j’ai envie de mourir")).toBe("j'ai envie de mourir")
    expect(normalizeForMatch('j‘en peux plus')).toContain("j'en peux plus")
  })

  it('retire les accents et réduit les espaces', () => {
    expect(normalizeForMatch('  Détresse   profonde  ')).toBe('detresse profonde')
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
  })
})

describe('detectDistressLevel — niveaux + limites de mots', () => {
  it('niveau 2 pour idées suicidaires (y compris apostrophe iPhone)', () => {
    expect(detectDistressLevel("j’ai envie de mourir")).toBe(2)
    expect(detectDistressLevel('Je veux me suicider')).toBe(2)
    expect(detectDistressLevel('appeler le suicide hotline test')).toBe(2)
  })

  it('niveau 1 pour TCA / mal-être', () => {
    expect(detectDistressLevel('Je me fais vomir après les repas')).toBe(1)
    expect(detectDistressLevel('J’en peux plus en ce moment')).toBe(1)
    expect(detectDistressLevel('anorexie et classement')).toBe(1)
  })

  it('niveau 2 l’emporte si les deux niveaux sont détectés', () => {
    expect(
      detectDistressLevel('Anorexie et envie de me suicider en même temps'),
    ).toBe(2)
  })

  it('ne déclenche pas sur « en finir avec ce bug » (faux positif)', () => {
    expect(detectDistressLevel('Je veux en finir avec ce bug du chrono')).toBe(0)
    expect(matchesDistressPhrase(normalizeForMatch('en finir avec ce bug'), 'en finir')).toBe(
      false,
    )
  })

  it('déclenche « en finir » seul ou avec la vie / tout', () => {
    expect(detectDistressLevel('Je veux en finir.')).toBe(2)
    expect(detectDistressLevel('envie d’en finir avec la vie')).toBe(2)
    expect(detectDistressLevel('en finir avec tout')).toBe(2)
  })

  it('« en finir avec ma vie / moi » validés niveau 2', () => {
    expect(detectDistressLevel('je veux en finir avec ma vie')).toBe(2)
    expect(detectDistressLevel('je veux en finir avec moi')).toBe(2)
    expect(AVIS_MOTS_DETRESSE_NIVEAU_2).toContain('en finir avec ma vie')
    expect(AVIS_MOTS_DETRESSE_NIVEAU_2).toContain('en finir avec moi')
    expect(detectDistressLevel('Je veux en finir avec ce bug du chrono')).toBe(0)
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
    expect(AVIS_MOTS_DETRESSE_NIVEAU_1).toContain('me purger')
  })
})

describe('Vérificateur — kms / je me coupe / overdose / purge', () => {
  it('kms : mot entier positif, pas après un nombre', () => {
    expect(detectDistressLevel('les kms parcourus me dépassent')).toBe(2)
    expect(detectDistressLevel('kms')).toBe(2)
    expect(detectDistressLevel('10 kms de course')).toBe(0)
    expect(detectDistressLevel('5 km de footing')).toBe(0)
    expect(matchesDistressPhrase(normalizeForMatch('10 kms'), 'kms')).toBe(false)
  })

  it('je me coupe : positif sauf ongles / cheveux / barbe / frange', () => {
    expect(detectDistressLevel('je me coupe quand ça va mal')).toBe(2)
    expect(detectDistressLevel('je me coupe.')).toBe(2)
    expect(detectDistressLevel('je me coupe les ongles')).toBe(0)
    expect(detectDistressLevel('je me coupe les cheveux')).toBe(0)
    expect(detectDistressLevel('je me coupe la barbe')).toBe(0)
    expect(detectDistressLevel('je me coupe la frange')).toBe(0)
  })

  it('overdose : formes ciblées seulement', () => {
    expect(detectDistressLevel('je veux faire une overdose')).toBe(2)
    expect(detectDistressLevel('il a pris une overdose')).toBe(2)
    expect(detectDistressLevel('prendre une overdose ce soir')).toBe(2)
    expect(detectDistressLevel('overdose de medicaments')).toBe(2)
    expect(detectDistressLevel('overdose de cachets')).toBe(2)
    expect(detectDistressLevel('overdose de squats')).toBe(0)
    expect(detectDistressLevel('overdose de pompes')).toBe(0)
    expect(detectDistressLevel('overdose de sucre')).toBe(0)
  })

  it('purge seul retiré ; me purger / vomir gardés', () => {
    expect(detectDistressLevel('purge du cache')).toBe(0)
    expect(detectDistressLevel('la purge des données')).toBe(0)
    expect(detectDistressLevel('je dois me purger')).toBe(1)
    expect(detectDistressLevel('je me fais vomir')).toBe(1)
    expect(detectDistressLevel('me faire vomir après manger')).toBe(1)
  })

  it('5 faux positifs QA ciblés ne déclenchent plus le niveau erroné', () => {
    expect(detectDistressLevel('10 kms de course')).toBe(0)
    expect(detectDistressLevel('je me coupe les ongles')).toBe(0)
    expect(detectDistressLevel('overdose de squats')).toBe(0)
    expect(detectDistressLevel('purge du cache')).toBe(0)
    expect(detectDistressLevel('la purge des données')).toBe(0)
    // Intentionnel : reste niveau 1
    expect(detectDistressLevel("j'en peux plus de ce bug")).toBe(1)
  })
})
