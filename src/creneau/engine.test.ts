import { describe, expect, it } from 'vitest'
import {
  CRENEAU_PHRASES,
  CRENEAU_MINOR_HOME_BEFORE_HM,
} from './constants'
import {
  activationPhrase,
  addMinutes,
  evaluateSlotSafety,
  formatDelayMessage,
  isCreneauMinor,
  proposeCreneau,
  summarizeCrowd,
} from './engine'

describe('creneau safety engine', () => {
  it('treats unknown age as minor (protecteur)', () => {
    expect(isCreneauMinor(null)).toBe(true)
    expect(isCreneauMinor(16)).toBe(true)
    expect(isCreneauMinor(18)).toBe(false)
  })

  it('minors: home before 20:00, day-only walk, never staffless', () => {
    const late = evaluateSlotSafety({
      age: 16,
      activity: 'salle',
      departureHm: '18:00',
      returnHomeHm: '20:30',
      afterSunset: true,
      heatVigilance: false,
      staffed: true,
      throughPark: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: false,
    })
    expect(late.allowed).toBe(false)
    expect(late.reasons).toContain('mineur_retour_apres_20h')
    expect(late.lines).toContain(CRENEAU_PHRASES.minorEveningHelp)

    const nightWalk = evaluateSlotSafety({
      age: 16,
      activity: 'marche',
      departureHm: '17:00',
      returnHomeHm: '18:00',
      afterSunset: true,
      heatVigilance: false,
      staffed: true,
      throughPark: false,
      eveningWalkEnabled: true,
      stafflessGymEnabled: true,
    })
    expect(nightWalk.allowed).toBe(false)
    expect(nightWalk.reasons).toContain('mineur_marche_nuit')

    const staffless = evaluateSlotSafety({
      age: 16,
      activity: 'salle',
      departureHm: '17:00',
      returnHomeHm: '19:00',
      afterSunset: false,
      heatVigilance: false,
      staffed: false,
      throughPark: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: true,
    })
    expect(staffless.allowed).toBe(false)
    expect(staffless.reasons).toContain('mineur_salle_sans_personnel')

    const ok = evaluateSlotSafety({
      age: 16,
      activity: 'salle',
      departureHm: '16:30',
      returnHomeHm: '19:00',
      afterSunset: false,
      heatVigilance: false,
      staffed: true,
      throughPark: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: false,
    })
    expect(ok.allowed).toBe(true)
    expect(CRENEAU_MINOR_HOME_BEFORE_HM).toBe('20:00')
  })

  it('adults: never park evening; no walk after 22:00; evening walk opt-in', () => {
    const park = evaluateSlotSafety({
      age: 28,
      activity: 'marche',
      departureHm: '19:00',
      returnHomeHm: '20:00',
      afterSunset: true,
      heatVigilance: false,
      staffed: true,
      throughPark: true,
      eveningWalkEnabled: true,
      stafflessGymEnabled: false,
    })
    expect(park.allowed).toBe(false)
    expect(park.reasons).toContain('parc_soir')

    const late = evaluateSlotSafety({
      age: 28,
      activity: 'marche',
      departureHm: '21:30',
      returnHomeHm: '22:15',
      afterSunset: true,
      heatVigilance: false,
      staffed: true,
      throughPark: false,
      eveningWalkEnabled: true,
      stafflessGymEnabled: false,
    })
    expect(late.allowed).toBe(false)
    expect(late.reasons).toContain('marche_apres_22h')

    const noOptIn = evaluateSlotSafety({
      age: 28,
      activity: 'marche',
      departureHm: '19:00',
      returnHomeHm: '20:00',
      afterSunset: true,
      heatVigilance: false,
      staffed: true,
      throughPark: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: false,
    })
    expect(noOptIn.allowed).toBe(false)
    expect(noOptIn.reasons).toContain('marche_soir_non_activee')
  })

  it('heat vigilance blocks walk and shows imposed phrases', () => {
    const v = evaluateSlotSafety({
      age: 30,
      activity: 'marche',
      departureHm: '10:00',
      returnHomeHm: '11:00',
      afterSunset: false,
      heatVigilance: true,
      staffed: true,
      throughPark: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: false,
    })
    expect(v.allowed).toBe(false)
    expect(v.lines).toContain(CRENEAU_PHRASES.heatVigilance)
    expect(v.lines).toContain(CRENEAU_PHRASES.takeBottle)
  })

  it('activation phrases are exact (choix A)', () => {
    expect(activationPhrase('evening_walk')).toBe(CRENEAU_PHRASES.eveningWalkActivate)
    expect(activationPhrase('staffless')).toBe(CRENEAU_PHRASES.stafflessActivate)
    expect(CRENEAU_PHRASES.eveningWalkActivate).toBe(
      'Le soir, préfère un trajet que tu connais.',
    )
    expect(CRENEAU_PHRASES.stafflessActivate).toBe(
      "Sans personnel, c'est mieux d'y aller à deux.",
    )
  })

  it('delay message matches maquette wording', () => {
    expect(formatDelayMessage('18:40', '20:10')).toBe(
      'Pas de souci. Avec ce retard, on décale à 18:40, retour vers 20:10.',
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
        staffUntilHm: '22:00',
        travelMin: 15,
      },
      backup: {
        id: 'g2',
        name: 'Salle République',
        staffUntilHm: '21:00',
        travelMin: 25,
      },
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
        staffUntilHm: '22:00',
        travelMin: 15,
      },
      backup: null,
      sessionMin: 45,
    })
    expect(primary).not.toBeNull()
    const ret = primary!.returnHm
    expect(ret < '20:00').toBe(true)
  })

  it('crowd summary from check-in taps only', () => {
    const now = 1_000_000
    const empty = summarizeCrowd([], 'g1', now)
    expect(empty.confidence).toBe('on_apprend')

    const reports = [
      { gymId: 'g1', level: 'calme' as const, atMs: now - 5_000 },
      { gymId: 'g1', level: 'calme' as const, atMs: now - 10_000 },
      { gymId: 'g1', level: 'calme' as const, atMs: now - 15_000 },
    ]
    const sure = summarizeCrowd(reports, 'g1', now)
    expect(sure.level).toBe('calme')
    expect(sure.confidence).toBe('sur')
    expect(sure.label).toBe('Calme')

    const stale = summarizeCrowd(
      [{ gymId: 'g1', level: 'charge', atMs: now - 40 * 60 * 1000 }],
      'g1',
      now,
    )
    expect(stale.level).toBeNull()
  })

  it('addMinutes wraps hours', () => {
    expect(addMinutes('23:50', 20)).toBe('00:10')
  })
})
