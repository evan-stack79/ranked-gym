import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  SLEEP_RESTRICTION_EXPERIMENTAL_ENABLED,
  circularDiffMinutes,
  circularStdDevMinutes,
  computeCatchUp,
  computeSleepEfficiency,
  experimentalSuggestTibRestriction,
  parseTimeToMinutes,
  runSleepEngine,
} from './index'
import type { SleepInput } from './types'

const BASE: SleepInput = {
  bedtime: '23:00',
  waketime: '07:00',
  tstHours: 8,
}

describe('Sleep quantity', () => {
  it('1 — TST = 8h → Optimal', () => {
    const r = runSleepEngine({ ...BASE, tstHours: 8 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.status).toBe('optimal')
    expect(r.metrics.quantity.scientific_status).toBe('optimal')
  })

  it('2 — TST = 6h → Déficit', () => {
    const r = runSleepEngine({ ...BASE, bedtime: '00:00', waketime: '07:00', tstHours: 6 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.status).toBe('deficit')
  })

  it('3 — TST = 7h → limite basse valide (Optimal)', () => {
    const r = runSleepEngine({ ...BASE, tstHours: 7 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.status).toBe('optimal')
  })

  it('4 — TST = 9h → limite haute valide (Optimal)', () => {
    const r = runSleepEngine({ ...BASE, bedtime: '22:00', waketime: '08:00', tstHours: 9 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.status).toBe('optimal')
  })

  it('5 — TST = 10h → Excès', () => {
    const r = runSleepEngine({ ...BASE, bedtime: '21:00', waketime: '08:00', tstHours: 10 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.status).toBe('excess')
  })
})

describe('Sleep efficiency', () => {
  it('6 — TIB/TST → efficacité correcte', () => {
    const r = runSleepEngine({
      ...BASE,
      bedtime: '23:00',
      waketime: '07:00',
      tstHours: 7,
      currentTibHours: 8,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.metrics.efficiency.sleepEfficiencyPercent).toBeCloseTo(87.5, 5)
  })

  it('7 — TST > TIB → erreur de validation', () => {
    const r = runSleepEngine({
      ...BASE,
      tstHours: 9,
      currentTibHours: 8,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe(ERROR_CODES.TST_EXCEEDS_TIB)
    expect(r.httpStatus).toBe(400)
  })
})

describe('Circular time', () => {
  it('8 — Passage 23:50 → 00:10 correctement traité (≈20 min)', () => {
    const a = parseTimeToMinutes('23:50')
    const b = parseTimeToMinutes('00:10')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(circularDiffMinutes(a!, b!)).toBeCloseTo(20, 5)

    const std = circularStdDevMinutes([a!, b!])
    expect(std).not.toBeNull()
    expect(std!).toBeLessThan(30)
  })
})

describe('Regularity', () => {
  it('9 — Horaires parfaitement réguliers → variabilité ~0', () => {
    const r = runSleepEngine({
      ...BASE,
      historicalBedtimes: ['23:00', '23:00', '23:00'],
      historicalWaketimes: ['07:00', '07:00', '07:00'],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.metrics.regularity.insufficientHistory).toBe(false)
    expect(r.metrics.regularity.bedtimeVariabilityMinutes).toBeCloseTo(0, 5)
    expect(r.metrics.regularity.waketimeVariabilityMinutes).toBeCloseTo(0, 5)
  })

  it('10 — Horaires irréguliers → variabilité > 0', () => {
    const r = runSleepEngine({
      ...BASE,
      bedtime: '22:00',
      waketime: '06:00',
      historicalBedtimes: ['00:30', '23:00', '01:00'],
      historicalWaketimes: ['08:00', '07:30', '09:00'],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.metrics.regularity.bedtimeVariabilityMinutes!).toBeGreaterThan(30)
    expect(r.metrics.regularity.waketimeVariabilityMinutes!).toBeGreaterThan(30)
  })

  it('13 — Historique insuffisant → pas de score de régularité inventé', () => {
    const r = runSleepEngine({ ...BASE })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.metrics.regularity.insufficientHistory).toBe(true)
    expect(r.metrics.regularity.bedtimeVariabilityMinutes).toBeNull()
    expect(r.metrics.regularity.waketimeVariabilityMinutes).toBeNull()
    // Pas de classification regular/irregular inventée
    expect('regularityClass' in r.metrics.regularity).toBe(false)
  })
})

describe('Catch-up sleep', () => {
  it('11 — Moyenne workdays < 7h → recoveryNeeded', () => {
    const catchUp = computeCatchUp([6, 5.5, 6.5])
    expect(catchUp.recoveryNeeded).toBe(true)
    expect(catchUp.workdayAverageTstHours).toBeCloseTo(6, 5)
    expect(catchUp.recommendation).toBeTruthy()

    const r = runSleepEngine({
      ...BASE,
      workdayTstHours: [6, 5.5, 6.5],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.metrics.catchUp.recoveryNeeded).toBe(true)
  })

  it('12 — Moyenne workdays >= 7h → pas de catch-up obligatoire', () => {
    const catchUp = computeCatchUp([7, 7.5, 8])
    expect(catchUp.recoveryNeeded).toBe(false)
    expect(catchUp.recommendation).toBeUndefined()
  })
})

describe('Wearables & isolation', () => {
  it('14 — REM/Deep/Light présents → aucun impact sur le moteur', () => {
    const clean = runSleepEngine(BASE)
    // Stages injectés hors contrat — le moteur ne les lit pas
    const withStages = runSleepEngine({
      ...BASE,
      ...( {
        remMinutes: 90,
        deepMinutes: 60,
        lightMinutes: 240,
        sleepStages: { rem: 90, deep: 60, light: 240 },
      } as unknown as SleepInput),
    })
    expect(clean.ok && withStages.ok).toBe(true)
    if (!clean.ok || !withStages.ok) return
    expect(withStages.status).toBe(clean.status)
    expect(withStages.metrics.quantity).toEqual(clean.metrics.quantity)
    expect(withStages.metrics.efficiency).toEqual(clean.metrics.efficiency)
    expect(withStages.metrics.regularity).toEqual(clean.metrics.regularity)
  })
})

describe('Validation & recommendations', () => {
  it('15 — Données invalides → erreur propre', () => {
    const badBed = runSleepEngine({ ...BASE, bedtime: 'not-a-time' })
    expect(badBed.ok).toBe(false)
    if (badBed.ok) return
    expect(badBed.code).toBe(ERROR_CODES.INVALID_BEDTIME)

    const badTst = runSleepEngine({ ...BASE, tstHours: -1 })
    expect(badTst.ok).toBe(false)
    if (badTst.ok) return
    expect(badTst.code).toBe(ERROR_CODES.INVALID_TST)
  })

  it('16 — Recommandations → aucun impact sur les métriques', () => {
    const a = runSleepEngine({ ...BASE, tstHours: 8 })
    const b = runSleepEngine({
      ...BASE,
      tstHours: 8,
      workdayTstHours: [5, 5, 5],
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    // Catch-up ajoute des recommandations mais quantity/efficiency/TIB inchangés
    expect(b.metrics.quantity).toEqual(a.metrics.quantity)
    expect(b.metrics.efficiency.sleepEfficiencyPercent).toBe(a.metrics.efficiency.sleepEfficiencyPercent)
    expect(b.recommendations.length).toBeGreaterThan(a.recommendations.length)
  })
})

describe('Efficiency threshold documentation', () => {
  it('compare au seuil 85 % sans en faire une qualité universelle', () => {
    const low = computeSleepEfficiency(6, 8)
    expect(low.sleepEfficiencyPercent).toBeCloseTo(75, 5)
    expect(low.aboveClinicalTibRestrictionThreshold85).toBe(false)

    const high = computeSleepEfficiency(7, 8)
    expect(high.aboveClinicalTibRestrictionThreshold85).toBe(true)
  })
})

describe('Sleep restriction therapy — excluded', () => {
  it('module expérimental désactivé et non branché', () => {
    expect(SLEEP_RESTRICTION_EXPERIMENTAL_ENABLED).toBe(false)
    const stub = experimentalSuggestTibRestriction({
      currentTibHours: 8,
      sleepEfficiencyPercent: 70,
    })
    expect(stub.enabled).toBe(false)
  })
})
