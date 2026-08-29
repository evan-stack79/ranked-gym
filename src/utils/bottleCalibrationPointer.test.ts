import { describe, expect, it } from 'vitest'
import {
  calibrationRemainingMlFromKey,
  calibrationRemainingMlFromPointer,
} from './bottleCalibrationPointer'

const RECT = { top: 100, bottom: 400, height: 300 }

describe('bottleCalibrationPointer', () => {
  it('place le haut de la bouteille à 1 500 ml restants', () => {
    expect(calibrationRemainingMlFromPointer(100, RECT)).toBe(1500)
  })

  it('place le milieu de la bouteille à 750 ml restants', () => {
    expect(calibrationRemainingMlFromPointer(250, RECT)).toBe(750)
  })

  it('place le bas de la bouteille à 0 ml restant', () => {
    expect(calibrationRemainingMlFromPointer(400, RECT)).toBe(0)
  })

  it('borne le doigt hors de la bouteille et arrondit par pas de 10 ml', () => {
    expect(calibrationRemainingMlFromPointer(40, RECT)).toBe(1500)
    expect(calibrationRemainingMlFromPointer(460, RECT)).toBe(0)
    expect(calibrationRemainingMlFromPointer(199, RECT) % 10).toBe(0)
  })

  it('gère le clavier par pas de 50 ml avec Home et End', () => {
    expect(calibrationRemainingMlFromKey(750, 'ArrowUp')).toBe(800)
    expect(calibrationRemainingMlFromKey(750, 'ArrowDown')).toBe(700)
    expect(calibrationRemainingMlFromKey(750, 'Home')).toBe(0)
    expect(calibrationRemainingMlFromKey(750, 'End')).toBe(1500)
    expect(calibrationRemainingMlFromKey(750, 'Enter')).toBeNull()
  })

  it('ne modifie pas le rectangle reçu pendant le calcul de preview', () => {
    const rect = { ...RECT }
    expect(calibrationRemainingMlFromPointer(250, rect)).toBe(750)
    expect(rect).toEqual(RECT)
  })

  it('reste sûr avec un rectangle de hauteur invalide', () => {
    expect(
      calibrationRemainingMlFromPointer(100, { top: 100, bottom: 100, height: 0 }),
    ).toBe(0)
  })
})
