import { describe, expect, it } from 'vitest'
import {
  bottleScreenLabelForMode,
  capacityForMode,
  carouselDetailForMode,
  carouselTitleForMode,
  kindForMode,
  WATER_SETTINGS_CAROUSEL_ORDER,
} from './hydrationModeDisplay'
import { MSG_GOAL_RANGE, MSG_MEDICAL_LIMIT, MSG_PERMANENT, MSG_PREGNANCY } from '../shared/hydration'

describe('hydrationModeDisplay B v2', () => {
  it('libellés 1,5 L / 2 L cohérents (pas Cristaline sur 2 L)', () => {
    expect(bottleScreenLabelForMode('classic_15')).toBe('Cristaline 1,5 L')
    expect(bottleScreenLabelForMode('classic_2l')).toBe('Bouteille 2 L')
    expect(bottleScreenLabelForMode('classic_2l')).not.toMatch(/Cristaline/)
    expect(carouselDetailForMode('classic_15')).toBe('1,5 L')
    expect(carouselDetailForMode('classic_2l')).toBe('2 L')
    expect(carouselTitleForMode('glasses_250')).toBe('Verre')
  })

  it('capacités + kind carousel', () => {
    expect(capacityForMode('classic_15')).toBe(1500)
    expect(capacityForMode('classic_2l')).toBe(2000)
    expect(capacityForMode('glasses_250')).toBe(250)
    expect(kindForMode('classic_15')).toBe('plastic_15')
    expect(kindForMode('classic_2l')).toBe('plastic_15')
    expect(kindForMode('glasses_250')).toBe('glass_25')
    expect([...WATER_SETTINGS_CAROUSEL_ORDER]).toEqual([
      'glasses_250',
      'classic_15',
      'classic_2l',
      'my_bottle',
    ])
  })

  it('copie santé bulle i (verbatim)', () => {
    expect(MSG_GOAL_RANGE).toBe(
      'Réglable de 1 L à 3 L — repère, pas limite de santé.',
    )
    expect(MSG_PERMANENT).toMatch(/aliments/)
    expect(MSG_PREGNANCY).toMatch(/sage-femme/)
    expect(MSG_MEDICAL_LIMIT).toMatch(/médecin/)
  })
})
