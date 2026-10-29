import { describe, expect, it } from 'vitest'
import {
  computeFfmi,
  computeLeanMassKg,
  effectiveAiCallsToday,
} from '../../convex/lib/athleteMetrics'

describe('computeLeanMassKg', () => {
  it('calcule la masse maigre depuis poids et bodyfat', () => {
    expect(computeLeanMassKg(80, 15)).toBe(68)
    expect(computeLeanMassKg(100, 20)).toBe(80)
  })

  it('retourne null si données manquantes ou invalides', () => {
    expect(computeLeanMassKg(null, 15)).toBeNull()
    expect(computeLeanMassKg(80, null)).toBeNull()
    expect(computeLeanMassKg(0, 15)).toBeNull()
    expect(computeLeanMassKg(80, 100)).toBeNull()
  })
})

describe('computeFfmi', () => {
  it('calcule FFMI = masse_maigre / (taille_m²)', () => {
    // 68 kg / (1.80²) = 68 / 3.24 ≈ 21.0
    expect(computeFfmi(68, 180)).toBe(21)
  })

  it('retourne null si taille ou masse maigre absente', () => {
    expect(computeFfmi(null, 180)).toBeNull()
    expect(computeFfmi(68, null)).toBeNull()
    expect(computeFfmi(68, 0)).toBeNull()
  })
})

describe('effectiveAiCallsToday', () => {
  it('reset à 0 si la date n’est pas aujourd’hui', () => {
    expect(effectiveAiCallsToday(3, '2026-10-21', '2026-10-22')).toBe(0)
    expect(effectiveAiCallsToday(2, undefined, '2026-10-22')).toBe(0)
  })

  it('conserve le compteur si lastAiCallDate = aujourd’hui', () => {
    expect(effectiveAiCallsToday(2, '2026-10-22', '2026-10-22')).toBe(2)
  })
})
