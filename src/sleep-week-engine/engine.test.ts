import { describe, expect, it } from 'vitest'
import { besoin, etat, fmtClock, fmtDur } from './engine.ts'
import { ETATS, NORMAL, PROVISOIRE } from './fixtures.ts'
import { nightsFromSleepEntries } from './adapter.ts'
import { AIDE, LIGNE_PRO, etatTexts } from './texts.ts'

describe('etat fixtures (priorité C)', () => {
  it('NORMAL → état 11', () => {
    expect(etat(NORMAL.nights, NORMAL.age, NORMAL.q).id).toBe(11)
  })

  it('PROVISOIRE → état 0 (< 5 nuits)', () => {
    expect(etat(PROVISOIRE.nights, PROVISOIRE.age, PROVISOIRE.q).id).toBe(0)
  })

  it('0 nuit → état 0 (pas d’état 3 ni conseil)', () => {
    const r = etat([], 24, {})
    expect(r.s.n).toBe(0)
    expect(r.id).toBe(0)
  })

  it('4 nuits courtes « en forme » → état 0 (pas d’état 3 avant 5 nuits)', () => {
    // Durée < 6 h + R ≥ 4 matcherait l’état 3 si on ignorait le seuil de 5 nuits.
    const nights = [
      { day: 'lun', bed: '01:00', wake: '06:00', R: 5 },
      { day: 'mar', bed: '01:00', wake: '06:00', R: 5 },
      { day: 'mer', bed: '01:00', wake: '06:00', R: 4 },
      { day: 'jeu', bed: '01:00', wake: '06:00', R: 5 },
    ]
    const r = etat(nights, 24, {})
    expect(r.s.n).toBe(4)
    expect(r.id).toBe(0)
  })

  it('≥5 nuits : comportement état 3 inchangé (fixture)', () => {
    expect(etat(ETATS[3]!.nights, ETATS[3]!.age, ETATS[3]!.q).id).toBe(3)
  })

  for (const key of Object.keys(ETATS)) {
    it(`ETATS[${key}] → id ${key}`, () => {
      const fixture = ETATS[+key]!
      expect(etat(fixture.nights, fixture.age, fixture.q).id).toBe(+key)
    })
  }
})

describe('fmtDur / fmtClock', () => {
  it('fmtDur basics', () => {
    expect(fmtDur(45)).toBe('45\u00a0min')
    expect(fmtDur(60)).toBe('1\u00a0h')
    expect(fmtDur(95)).toBe('1\u00a0h\u00a035')
    expect(fmtDur(455)).toBe('7\u00a0h\u00a035')
  })

  it('fmtClock basics', () => {
    expect(fmtClock(0)).toBe('0\u00a0h\u00a000')
    expect(fmtClock(90)).toBe('1\u00a0h\u00a030')
    expect(fmtClock(1425)).toBe('23\u00a0h\u00a045')
  })
})

describe('besoin (âges)', () => {
  it('≤18 → 8–10 h', () => {
    expect(besoin(10)).toEqual([480, 600])
    expect(besoin(18)).toEqual([480, 600])
  })

  it('19–64 → 7–9 h', () => {
    expect(besoin(19)).toEqual([420, 540])
    expect(besoin(64)).toEqual([420, 540])
  })

  it('65+ → 7–8 h', () => {
    expect(besoin(65)).toEqual([420, 480])
  })
})

describe('nightsFromSleepEntries', () => {
  it('mappe dateKey lever → day soir (lun…dim) dans la semaine', () => {
    // Semaine de nuits : lun 10/11 → dim 16/11/2025 (lundi = 2025-11-10)
    // Lever = lendemain → dateKey mar 11 pour nuit lun, etc.
    const nights = nightsFromSleepEntries(
      [
        { dateKey: '2025-11-11', bedtime: '23:30', waketime: '07:15', feelingLevel: 3 }, // lun
        { dateKey: '2025-11-12', bedtime: '23:40', waketime: '07:05', feelingLevel: 4 }, // mar
        { dateKey: '2025-11-15', bedtime: '00:20', waketime: '08:20', feelingLevel: 4 }, // ven
        { dateKey: '2025-11-16', bedtime: '00:35', waketime: '08:30', feelingLevel: 3 }, // sam
      ],
      '2025-11-10',
    )
    expect(nights.map((n) => n.day)).toEqual(['lun', 'mar', 'ven', 'sam'])
    expect(nights[0]).toMatchObject({ bed: '23:30', wake: '07:15', R: 3 })
  })
})

describe('textes Vérif. (titres courts + corrections)', () => {
  const sample = etat(NORMAL.nights, NORMAL.age, NORMAL.q)

  it('titres courts choix B', () => {
    expect(etatTexts(1, sample)?.nom).toBe('Nuits courtes, fatigue')
    expect(etatTexts(2, sample)?.nom).toBe('Longues nuits, mais fatigue')
    expect(etatTexts(4, sample)?.nom).toBe('Presque assez')
    expect(etatTexts(5, sample)?.nom).toBe('Longues nuits, toujours fatigue')
    expect(etatTexts(6, sample)?.nom).toBe('Semaine ≠ week-end')
    expect(etatTexts(8, sample)?.nom).toBe('Heures en zigzag')
    expect(etatTexts(11, sample)?.nom).toBe('Un peu court pour ton âge')
  })

  it('phrases corrigées mot pour mot', () => {
    expect(etatTexts(1, sample)?.actions[2]).toBe(
      'Ni café, ni thé fort, ni cola, ni boisson énergisante 6 h avant le lit.',
    )
    expect(etatTexts(3, sample)?.texte).toBe(
      'En forme, top ! Ton corps a quand même besoin de plus de nuit. On teste 15 min de plus ce soir ?',
    )
    expect(etatTexts(9, sample)?.actions[0]).toBe(
      'Pas sommeil ? Lève-toi, fais un truc calme dans une lumière douce, reviens quand le sommeil arrive.',
    )
    expect(etatTexts(10, sample)?.texte).toBe(
      "Ta sieste t'aide, mais elle vole du sommeil à ta nuit. Garde-la courte et tôt.",
    )
    expect(etatTexts(12, sample)?.texte).toBe(
      'Bravo, rythme régulier et une durée qui colle à ton âge !',
    )
    expect(AIDE[3]).toBe(
      "Moins de 6 h, c'est sous ton repère, même quand tu te sens en forme. On avance de 15 min à la fois.",
    )
    expect(AIDE[5]).toBe(
      "Une longue nuit ne repose pas toujours plus. Même réveil et lumière du matin aident. L'app ne te dira jamais de dormir encore plus.",
    )
    expect(AIDE[9]).toBe(
      'Pas sommeil ? Un moment calme hors du lit aide. Pas de minuteur, pas de règle stricte.',
    )
    expect(LIGNE_PRO).toBe('Si la fatigue dure malgré tout, un pro de santé peut aider.')
    expect(LIGNE_PRO).not.toMatch(/médecin/)
  })
})
