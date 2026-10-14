import { describe, expect, it } from 'vitest'
import {
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

  it('strip backup payload : repas partis, train / profil gardés', () => {
    const next = stripMealsFromBackupPayload({
      nutrition: {
        profile: { age: 22 },
        journal: {
          d1: { meals: [{ name: 'Pomme Golden' }], waterMl: 1 },
        },
      },
      training: { routines: [{ name: 'Pull' }] },
    })
    expect(backupPayloadContainsMealName(next, 'Pomme Golden')).toBe(false)
    expect(next).toMatchObject({
      nutrition: { profile: { age: 22 }, journal: { d1: { meals: [], waterMl: 1 } } },
      training: { routines: [{ name: 'Pull' }] },
    })
  })
})
