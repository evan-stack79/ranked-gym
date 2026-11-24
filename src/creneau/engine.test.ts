import { describe, expect, it } from 'vitest'
import {
  CRENEAU_PHRASES,
  CRENEAU_MINOR_HOME_BEFORE_HM,
} from './constants'
import {
  activationPhrase,
  addMinutes,
  addMinutesAbs,
  crossesMidnight,
  evaluateSlotSafety,
  formatDelayMessage,
  formatDeparturePassedWithNew,
  formatHm,
  isCreneauMinor,
  isStaffedForSession,
  parseHm,
  proposeCreneau,
  summarizeCrowd,
} from './engine'
import { TERGNIER_COORDS } from './sunset'

function safetyBase(
  over: Partial<Parameters<typeof evaluateSlotSafety>[0]>,
): Parameters<typeof evaluateSlotSafety>[0] {
  const dep = over.departureHm ?? '17:00'
  const depAbs = over.departureAbs ?? parseHm(dep)!
  const retAbs = over.returnHomeAbs ?? depAbs + 120
  return {
    age: 28,
    activity: 'salle',
    departureHm: dep,
    departureAbs: depAbs,
    returnHomeAbs: retAbs,
    sessionStartAbs: depAbs + 25,
    sessionEndAbs: depAbs + 85,
    lockerAfterAbs: depAbs + 95,
    afterSunset: false,
    heatVigilance: false,
    staffed: true,
    throughPark: false,
    eveningWalkEnabled: false,
    stafflessGymEnabled: false,
    ...over,
  }
}

describe('creneau safety engine', () => {
  it('treats unknown age as minor (protecteur)', () => {
    expect(isCreneauMinor(null)).toBe(true)
    expect(isCreneauMinor(16)).toBe(true)
    expect(isCreneauMinor(18)).toBe(false)
  })

  it('minors: home before 20:00, day-only walk, never staffless', () => {
    const late = evaluateSlotSafety(
      safetyBase({
        age: 16,
        departureHm: '18:00',
        departureAbs: parseHm('18:00')!,
        returnHomeAbs: parseHm('20:30')!,
        afterSunset: true,
      }),
    )
    expect(late.allowed).toBe(false)
    expect(late.reasons).toContain('mineur_retour_apres_20h')
    expect(late.lines).toContain(CRENEAU_PHRASES.minorEveningHelp)

    const nightWalk = evaluateSlotSafety(
      safetyBase({
        age: 16,
        activity: 'marche',
        departureHm: '17:00',
        departureAbs: parseHm('17:00')!,
        returnHomeAbs: parseHm('18:00')!,
        afterSunset: true,
        eveningWalkEnabled: true,
        stafflessGymEnabled: true,
      }),
    )
    expect(nightWalk.allowed).toBe(false)
    expect(nightWalk.reasons).toContain('mineur_marche_nuit')

    const staffless = evaluateSlotSafety(
      safetyBase({
        age: 16,
        staffed: false,
        stafflessGymEnabled: true,
      }),
    )
    expect(staffless.allowed).toBe(false)
    expect(staffless.reasons).toContain('mineur_salle_sans_personnel')

    const ok = evaluateSlotSafety(
      safetyBase({
        age: 16,
        departureHm: '16:30',
        departureAbs: parseHm('16:30')!,
        returnHomeAbs: parseHm('19:00')!,
      }),
    )
    expect(ok.allowed).toBe(true)
    expect(CRENEAU_MINOR_HOME_BEFORE_HM).toBe('20:00')
  })

  it('B1: minor slot crossing midnight is refused (absolute minutes)', () => {
    const dep = parseHm('23:30')!
    const ret = dep + 90 // 00:60 next day = 1440+30 abs... wait 23:30+90 = 1410+90 = 1500
    expect(crossesMidnight(dep, ret)).toBe(true)
    const v = evaluateSlotSafety(
      safetyBase({
        age: 16,
        departureHm: '23:30',
        departureAbs: dep,
        returnHomeAbs: ret,
        sessionStartAbs: dep + 20,
        sessionEndAbs: dep + 50,
        lockerAfterAbs: dep + 60,
      }),
    )
    expect(v.allowed).toBe(false)
    expect(v.reasons.length).toBeGreaterThan(0)
  })

  it('B1: addMinutesAbs keeps day across midnight (no silent wrap for safety)', () => {
    expect(addMinutesAbs('23:50', 20)).toBe(23 * 60 + 50 + 20)
    expect(formatHm(addMinutesAbs('23:50', 20)!)).toBe('00:10')
    expect(addMinutes('23:50', 20)).toBe('00:10')
  })

  it('B1: after midnight without overnight staff → unstaffed', () => {
    const start = 23 * 60 + 50
    const lockerAfter = start + 80 // past midnight
    expect(
      isStaffedForSession({
        sessionStartAbs: start,
        lockerAfterAbs: lockerAfter,
        staffFromHm: '07:00',
        staffUntilHm: '22:00',
      }),
    ).toBe(false)
  })

  it('adults: never park evening; no walk after 22:00; evening walk opt-in', () => {
    const park = evaluateSlotSafety(
      safetyBase({
        activity: 'marche',
        departureHm: '19:00',
        departureAbs: parseHm('19:00')!,
        returnHomeAbs: parseHm('20:00')!,
        afterSunset: true,
        throughPark: true,
        eveningWalkEnabled: true,
      }),
    )
    expect(park.allowed).toBe(false)
    expect(park.reasons).toContain('parc_soir')

    const late = evaluateSlotSafety(
      safetyBase({
        activity: 'marche',
        departureHm: '21:30',
        departureAbs: parseHm('21:30')!,
        returnHomeAbs: parseHm('22:15')!,
        afterSunset: true,
        eveningWalkEnabled: true,
      }),
    )
    expect(late.allowed).toBe(false)
    expect(late.reasons).toContain('marche_apres_22h')

    const noOptIn = evaluateSlotSafety(
      safetyBase({
        activity: 'marche',
        departureHm: '19:00',
        departureAbs: parseHm('19:00')!,
        returnHomeAbs: parseHm('20:00')!,
        afterSunset: true,
        eveningWalkEnabled: false,
      }),
    )
    expect(noOptIn.allowed).toBe(false)
    expect(noOptIn.reasons).toContain('marche_soir_non_activee')
  })

  it('heat vigilance blocks walk and shows imposed phrases', () => {
    const v = evaluateSlotSafety(
      safetyBase({
        activity: 'marche',
        departureHm: '10:00',
        departureAbs: parseHm('10:00')!,
        returnHomeAbs: parseHm('11:00')!,
        heatVigilance: true,
      }),
    )
    expect(v.allowed).toBe(false)
    expect(v.lines).toContain(CRENEAU_PHRASES.heatVigilance)
    expect(v.lines).toContain(CRENEAU_PHRASES.takeBottle)
  })

  it('activation phrases are exact (choix A)', () => {
    expect(activationPhrase('evening_walk')).toBe(CRENEAU_PHRASES.eveningWalkActivate)
    expect(activationPhrase('staffless')).toBe(CRENEAU_PHRASES.stafflessActivate)
  })

  it('delay + passed phrases (mot pour mot)', () => {
    expect(formatDelayMessage('18:40', '20:10')).toBe(
      'Pas de souci. Avec ce retard, on décale à 18:40, retour vers 20:10.',
    )
    expect(formatDeparturePassedWithNew('17:15')).toBe(
      '17:15 est passé. Nouvelle heure :',
    )
    expect(CRENEAU_PHRASES.minorHeroLine).toBe(
      "Retour avant 20 h. Un adulte de confiance peut t'aider.",
    )
  })

  it('proposeCreneau prefers staffed favorite and plan B backup', () => {
    const { primary, planB } = proposeCreneau({
      age: 28,
      nowHm: '17:00',
      afterSunset: true,
      heatVigilance: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: false,
      preferQuiet: true,
      softSession: false,
      delayMin: 0,
      favorite: {
        id: 'g1',
        name: 'Salle de la gare',
        staffFromHm: '07:00',
        staffUntilHm: '22:00',
        closesHm: '23:00',
        travelMin: 15,
        latitude: TERGNIER_COORDS.latitude,
        longitude: TERGNIER_COORDS.longitude,
        cityKnown: true,
      },
      backup: {
        id: 'g2',
        name: 'Salle République',
        staffFromHm: '08:00',
        staffUntilHm: '21:00',
        closesHm: '22:00',
        travelMin: 25,
        latitude: TERGNIER_COORDS.latitude,
        longitude: TERGNIER_COORDS.longitude,
        cityKnown: true,
      },
      nowDate: new Date(2026, 10, 24),
    })
    expect(primary?.gymName).toBe('Salle de la gare')
    expect(primary?.favorite).toBe(true)
    expect(planB?.gymName).toBe('Salle République')
    expect(primary?.returnHm).toBeTruthy()
  })

  it('minor proposal stays before 20:00 return', () => {
    const { primary } = proposeCreneau({
      age: 16,
      nowHm: '16:00',
      afterSunset: false,
      heatVigilance: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: false,
      preferQuiet: true,
      softSession: false,
      delayMin: 0,
      favorite: {
        id: 'g1',
        name: 'Salle de la gare',
        staffFromHm: '07:00',
        staffUntilHm: '22:00',
        closesHm: '23:00',
        travelMin: 15,
        latitude: TERGNIER_COORDS.latitude,
        longitude: TERGNIER_COORDS.longitude,
        cityKnown: true,
      },
      backup: null,
      sessionMin: 45,
      nowDate: new Date(2026, 10, 24),
    })
    expect(primary).not.toBeNull()
    expect(primary!.returnHm < '20:00').toBe(true)
  })

  it('crowd: 3 taps same person ≠ sûr (CA-C22 dedupe)', () => {
    const now = 1_000_000
    const samePerson = [
      { gymId: 'g1', level: 'calme' as const, atMs: now - 5_000, personId: 'p1' },
      { gymId: 'g1', level: 'calme' as const, atMs: now - 4_000, personId: 'p1' },
      { gymId: 'g1', level: 'calme' as const, atMs: now - 3_000, personId: 'p1' },
    ]
    const one = summarizeCrowd(samePerson, 'g1', now)
    expect(one.level).toBe('calme')
    expect(one.uniquePeople).toBe(1)
    expect(one.confidence).not.toBe('sur')
    expect(one.confidenceLabel).not.toBe('sûr')
  })

  it('crowd: 3 distinct people agreeing → sûr', () => {
    const now = 1_000_000
    const reports = [
      { gymId: 'g1', level: 'calme' as const, atMs: now - 5_000, personId: 'a' },
      { gymId: 'g1', level: 'calme' as const, atMs: now - 4_000, personId: 'b' },
      { gymId: 'g1', level: 'calme' as const, atMs: now - 3_000, personId: 'c' },
    ]
    const sure = summarizeCrowd(reports, 'g1', now)
    expect(sure.confidence).toBe('sur')
    expect(sure.uniquePeople).toBe(3)
  })

  it('crowd empty → on apprend', () => {
    const empty = summarizeCrowd([], 'g1', 1_000_000)
    expect(empty.confidence).toBe('on_apprend')
    expect(empty.level).toBeNull()
  })
})
