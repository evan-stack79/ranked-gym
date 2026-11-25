import { describe, expect, it } from 'vitest'
import { CRENEAU_PHRASES } from './constants'
import {
  formatDepartedHeadline,
  isHmPast,
  nextFutureDeparture,
  resolveDepartureDisplay,
} from './v9Display'

describe('créneau v9 — heure jamais passée + état 05 + mineur', () => {
  it('isHmPast : 17:15 est passé à 17:20', () => {
    expect(isHmPast('17:15', '17:20')).toBe(true)
    expect(isHmPast('17:15', '17:15')).toBe(false)
    expect(isHmPast('17:15', '13:09')).toBe(false)
  })

  it('resolveDepartureDisplay : futur → principal (heure inchangée)', () => {
    const d = resolveDepartureDisplay('17:15', '13:09')
    expect(d.departed).toBe(false)
    expect(d.displayHm).toBe('17:15')
    expect(d.passedHm).toBeNull()
  })

  it('état 05 : départ passé → nouvelle heure future (jamais 13:09)', () => {
    const d = resolveDepartureDisplay('17:15', '17:20')
    expect(d.departed).toBe(true)
    expect(d.passedHm).toBe('17:15')
    expect(d.displayHm).toBe('17:30')
    expect(isHmPast(d.displayHm, '17:20')).toBe(false)
    expect(formatDepartedHeadline('17:15')).toBe(
      '17:15 est passé. Nouvelle heure :',
    )
  })

  it('nextFutureDeparture avance par pas de 15 tant que ≤ now', () => {
    expect(nextFutureDeparture('17:15', '17:45')).toBe('18:00')
    expect(nextFutureDeparture('17:15', '17:30')).toBe('17:45')
  })

  it('ligne mineur exacte (mot pour mot)', () => {
    expect(CRENEAU_PHRASES.minorHeroLine).toBe(
      "Retour avant 20 h. Un adulte de confiance peut t'aider.",
    )
  })

  it('l’heure affichée n’est jamais dans le passé (échantillon)', () => {
    const now = '18:05'
    for (const base of ['13:09', '17:15', '18:00', '18:05', '19:00']) {
      const d = resolveDepartureDisplay(base, now)
      expect(isHmPast(d.displayHm, now)).toBe(false)
    }
  })
})
