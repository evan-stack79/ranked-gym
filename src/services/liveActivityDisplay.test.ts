import { describe, expect, it } from 'vitest'
import {
  formatStepsCount,
  restNextSeriesLabel,
  sessionFilledSetBars,
} from './liveActivityDisplay'

describe('sessionFilledSetBars (maquette DI)', () => {
  it('séries 1, 2 et 4 sur 4 → barres rouges 1, 2, 4', () => {
    expect(sessionFilledSetBars(1, 4)).toBe(1)
    expect(sessionFilledSetBars(2, 4)).toBe(2)
    expect(sessionFilledSetBars(4, 4)).toBe(4)
  })

  it('ne dépasse jamais le total', () => {
    expect(sessionFilledSetBars(5, 4)).toBe(4)
    expect(sessionFilledSetBars(0, 4)).toBe(0)
  })
})

describe('restNextSeriesLabel', () => {
  it('affiche Série X sur Y ensuite quand X ≤ Y', () => {
    expect(restNextSeriesLabel(2, 4)).toBe('Série 2 sur 4 ensuite')
    expect(restNextSeriesLabel(4, 4)).toBe('Série 4 sur 4 ensuite')
  })

  it('borne le numéro au total — jamais 5 sur 4 ni 5 sur 5 si total=4', () => {
    expect(restNextSeriesLabel(5, 4)).toBe('Séries terminées')
    expect(restNextSeriesLabel(5, 4)).not.toBe('Série 5 sur 4 ensuite')
    expect(restNextSeriesLabel(5, 4)).not.toBe('Série 5 sur 5 ensuite')
    expect(restNextSeriesLabel(6, 5)).toBe('Séries terminées')
  })

  it('total inconnu → null (pas de faux total ni Séries terminées)', () => {
    expect(restNextSeriesLabel(2, 0)).toBeNull()
    expect(restNextSeriesLabel(2, null)).toBeNull()
    expect(restNextSeriesLabel(2, undefined)).toBeNull()
  })
})

describe('formatStepsCount', () => {
  it('espace milliers fr-FR', () => {
    expect(formatStepsCount(6240)).toBe('6 240')
  })
})
