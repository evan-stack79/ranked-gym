import { describe, expect, it } from 'vitest'
import { besoin, etat, fmtClock, fmtDur } from './engine.ts'
import { ETATS, NORMAL, PROVISOIRE } from './fixtures.ts'
import { nightsFromSleepEntries } from './adapter.ts'

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
