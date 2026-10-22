/**
 * V3-07 / V3-08 / V3-09 — tests serveur Photo IA (fake keys, pas de réseau).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  canUseMealPhotoEstimateFromProfileJson,
  clampMealPhotoCalories,
  MAX_MEAL_PHOTO_KCAL,
  MEAL_PHOTO_ESTIMATE_BLOCKED,
  scaleMealPhotoMacrosForEditedKcal,
  validateMealPhotoConfirmCalories,
} from '../../convex/lib/mealPhotoEstimateAccess'

describe('V3-07 — canUseMealPhotoEstimateFromProfileJson (serveur)', () => {
  it('adulte hors grossesse/allaitement → autorisé', () => {
    expect(
      canUseMealPhotoEstimateFromProfileJson({
        age: 25,
        sex: 'female',
        declaredPregnancy: false,
        declaredBreastfeeding: false,
      }),
    ).toBe(true)
  })

  it('mineur / âge inconnu → refusé (0 kcal côté action)', () => {
    expect(canUseMealPhotoEstimateFromProfileJson({ age: 16, sex: 'male' })).toBe(false)
    expect(canUseMealPhotoEstimateFromProfileJson({ sex: 'female' })).toBe(false)
    expect(canUseMealPhotoEstimateFromProfileJson(null)).toBe(false)
    expect(canUseMealPhotoEstimateFromProfileJson({})).toBe(false)
  })

  it('grossesse / allaitement → refusé ; homme ignore flags obsolètes', () => {
    expect(
      canUseMealPhotoEstimateFromProfileJson({
        age: 28,
        sex: 'female',
        declaredPregnancy: true,
      }),
    ).toBe(false)
    expect(
      canUseMealPhotoEstimateFromProfileJson({
        age: 28,
        sex: 'female',
        declaredBreastfeeding: true,
      }),
    ).toBe(false)
    expect(
      canUseMealPhotoEstimateFromProfileJson({
        age: 30,
        sex: 'male',
        declaredPregnancy: true,
        declaredBreastfeeding: true,
      }),
    ).toBe(true)
  })

  it('analyzeMealPhoto appelle la garde avant Gemini (contrat source)', () => {
    const source = readFileSync(new URL('../../convex/mealPhotoAi.ts', import.meta.url), 'utf8')
    expect(source).toContain('canUseMealPhotoEstimateFromProfileJson')
    expect(source).toContain('MEAL_PHOTO_ESTIMATE_BLOCKED')
    expect(source).toContain(MEAL_PHOTO_ESTIMATE_BLOCKED)
    expect(source).toContain('getNutritionProfileJsonInternal')
    const gateIdx = source.indexOf('canUseMealPhotoEstimateFromProfileJson')
    const geminiIdx = source.indexOf('runGeminiWithRetryFallback')
    const reserveIdx = source.indexOf('reserveAiMealScanInternal')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(geminiIdx).toBeGreaterThan(gateIdx)
    expect(reserveIdx).toBeGreaterThan(gateIdx)
  })
})

describe('V3-08 — plafond 5000 kcal (serveur)', () => {
  it('clampMealPhotoCalories plafonne à 5000', () => {
    expect(MAX_MEAL_PHOTO_KCAL).toBe(5000)
    expect(clampMealPhotoCalories(6000)).toBe(5000)
    expect(clampMealPhotoCalories(450)).toBe(450)
    expect(clampMealPhotoCalories(-10)).toBe(0)
    expect(clampMealPhotoCalories(Number.NaN)).toBe(0)
  })

  it('validateMealPhotoConfirmCalories refuse >5000', () => {
    expect(validateMealPhotoConfirmCalories(5000)).toEqual({ ok: true, calories: 5000 })
    expect(validateMealPhotoConfirmCalories(5001)).toEqual({ ok: false, reason: 'above_max' })
    expect(validateMealPhotoConfirmCalories(-1)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('parseMacros serveur utilise clampMealPhotoCalories (contrat)', () => {
    const source = readFileSync(new URL('../../convex/mealPhotoAi.ts', import.meta.url), 'utf8')
    expect(source).toContain('clampMealPhotoCalories')
    expect(source).toMatch(/function parseMacros[\s\S]*?clampMealPhotoCalories/)
  })
})

describe('V3-09 — scale macros proportionnel aux kcal éditées', () => {
  it('demi kcal → macros à moitié', () => {
    expect(
      scaleMealPhotoMacrosForEditedKcal({
        baseCalories: 450,
        baseProteinG: 20,
        baseCarbsG: 40,
        baseFatG: 15,
        nextCalories: 225,
      }),
    ).toEqual({
      calories: 225,
      proteinG: 10,
      carbsG: 20,
      fatG: 7.5,
    })
  })

  it('édition >5000 clampée ; base 0 → macros 0', () => {
    expect(
      scaleMealPhotoMacrosForEditedKcal({
        baseCalories: 1000,
        baseProteinG: 50,
        baseCarbsG: 100,
        baseFatG: 20,
        nextCalories: 9000,
      }).calories,
    ).toBe(5000)
    expect(
      scaleMealPhotoMacrosForEditedKcal({
        baseCalories: 0,
        baseProteinG: 10,
        baseCarbsG: 10,
        baseFatG: 10,
        nextCalories: 200,
      }),
    ).toEqual({ calories: 200, proteinG: 0, carbsG: 0, fatG: 0 })
  })
})
