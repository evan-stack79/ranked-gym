import { describe, expect, it } from 'vitest'
import { restNextSeriesLabel, sessionFilledSetBars } from './liveActivityDisplay'

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

describe('restNextSeriesLabel (dernière série)', () => {
  it('affiche Série X sur Y ensuite quand X ≤ Y', () => {
    expect(restNextSeriesLabel(2, 4)).toBe('Série 2 sur 4 ensuite')
    expect(restNextSeriesLabel(4, 4)).toBe('Série 4 sur 4 ensuite')
  })

  it('jamais N+1 sur N après la dernière série', () => {
    // Après S4/4 terminée → next=5 > total=4
    expect(restNextSeriesLabel(5, 4)).toBe('Séries terminées')
    expect(restNextSeriesLabel(5, 4)).not.toBe('Série 5 sur 4 ensuite')
    // Après S5/5 terminée → next=6 > total=5
    expect(restNextSeriesLabel(6, 5)).toBe('Séries terminées')
    expect(restNextSeriesLabel(6, 5)).not.toMatch(/Série \d+ sur \d+/)
    // Avant la dernière série, « Série N sur N ensuite » reste valide
    expect(restNextSeriesLabel(5, 5)).toBe('Série 5 sur 5 ensuite')
  })
})
