import { describe, expect, it } from 'vitest'
import {
  StripJournalParseError,
  backupPayloadContainsMealName,
  journalJsonContainsMealName,
  stripMealsFromBackupPayload,
  stripMealsFromJournalJson,
} from './stripJournalMeals'

describe('stripJournalMeals', () => {
  it('vide meals et conserve water / autres champs', () => {
    const next = stripMealsFromJournalJson({
      '2026-10-14': {
        meals: [{ id: '1', name: 'Skyr Vanille', calories: 120 }],
        waterMl: 500,
        waterEntries: [{ id: 'w', amountMl: 500 }],
      },
    })
    expect(journalJsonContainsMealName(next, 'Skyr Vanille')).toBe(false)
    expect(next['2026-10-14']).toMatchObject({
      meals: [],
      waterMl: 500,
      waterEntries: [{ id: 'w', amountMl: 500 }],
    })
  })

  it('journal stocké en string JSON : parse puis retire seulement les repas', () => {
    const raw = JSON.stringify({
      d1: {
        meals: [{ name: 'Pomme Golden' }],
        waterMl: 200,
      },
    })
    const next = stripMealsFromJournalJson(raw)
    expect(journalJsonContainsMealName(next, 'Pomme Golden')).toBe(false)
    expect(next.d1).toMatchObject({ meals: [], waterMl: 200 })
  })

  it('string journal invalide → StripJournalParseError (rien n’est effacé côté appelant)', () => {
    expect(() => stripMealsFromJournalJson('{not-json')).toThrow(StripJournalParseError)
    expect(() => stripMealsFromJournalJson('["array"]')).toThrow(StripJournalParseError)
  })

  it('strip backup payload : repas partis, train / profil gardés', () => {
    const { payload, mealsRemoved } = stripMealsFromBackupPayload({
      nutrition: {
        profile: { age: 22 },
        journal: {
          d1: { meals: [{ name: 'Pomme Golden' }], waterMl: 1 },
        },
      },
      training: { routines: [{ name: 'Pull' }] },
    })
    expect(mealsRemoved).toBe(1)
    expect(backupPayloadContainsMealName(payload, 'Pomme Golden')).toBe(false)
    expect(payload).toMatchObject({
      nutrition: { profile: { age: 22 }, journal: { d1: { meals: [], waterMl: 1 } } },
      training: { routines: [{ name: 'Pull' }] },
    })
  })
})
