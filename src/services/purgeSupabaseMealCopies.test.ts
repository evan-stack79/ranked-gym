/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  backupPayloadContainsMealName,
  journalJsonContainsMealName,
} from '../utils/stripJournalMeals'

const isSupabaseConfigured = vi.fn(() => true)
const fromMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
  getSupabase: () => ({ from: (...args: unknown[]) => fromMock(...args) }),
}))

describe('purgeSupabaseMealCopies', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isSupabaseConfigured.mockReturnValue(true)
  })

  it('retire les repas de nutrition.journal et user_backups.payload ; garde eau / train', async () => {
    const mealName = 'Skyr Vanille'
    let nutritionJournal: unknown = {
      '2026-10-14': {
        meals: [{ id: 'm1', name: mealName, calories: 120 }],
        waterMl: 400,
        waterEntries: [{ id: 'w1', amountMl: 400 }],
      },
    }
    let backupPayload: unknown = {
      nutrition: {
        profile: { age: 30 },
        journal: {
          '2026-10-14': {
            meals: [{ id: 'm1', name: mealName, calories: 120 }],
            waterMl: 400,
          },
        },
      },
      training: { completed: [{ title: 'Leg day' }] },
    }

    fromMock.mockImplementation((table: string) => {
      if (table === 'nutrition') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { journal: nutritionJournal, profile: {}, updated_at: 't0' },
                error: null,
              }),
            }),
          }),
          update: (patch: { journal: unknown }) => ({
            eq: async () => {
              nutritionJournal = patch.journal
              return { error: null }
            },
          }),
        }
      }
      if (table === 'user_backups') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { payload: backupPayload, updated_at: 't0' },
                error: null,
              }),
            }),
          }),
          update: (patch: { payload: unknown }) => ({
            eq: async () => {
              backupPayload = patch.payload
              return { error: null }
            },
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const { purgeSupabaseMealCopies } = await import('./purgeSupabaseMealCopies')
    const result = await purgeSupabaseMealCopies('user-1')

    expect(result.skipped).toBe(false)
    expect(result.nutritionPurged).toBe(true)
    expect(result.userBackupsPurged).toBe(true)
    expect(journalJsonContainsMealName(nutritionJournal, mealName)).toBe(false)
    expect(backupPayloadContainsMealName(backupPayload, mealName)).toBe(false)
    expect(
      (nutritionJournal as { '2026-10-14': { waterMl: number; meals: unknown[] } })['2026-10-14']
        .waterMl,
    ).toBe(400)
    expect(
      (backupPayload as { training: { completed: unknown[] }; nutrition: { profile: unknown } })
        .training.completed,
    ).toEqual([{ title: 'Leg day' }])
    expect(
      (backupPayload as { nutrition: { profile: unknown } }).nutrition.profile,
    ).toEqual({ age: 30 })
  })

  it('Supabase injoignable → EraseMealsPurgeError (pas de succès silencieux)', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { message: 'Connection terminated due to connection timeout' },
          }),
        }),
      }),
    }))

    const { purgeSupabaseMealCopies, EraseMealsPurgeError, ERASE_MEALS_PURGE_FAILED_MESSAGE } =
      await import('./purgeSupabaseMealCopies')

    await expect(purgeSupabaseMealCopies('user-1')).rejects.toBeInstanceOf(EraseMealsPurgeError)
    await expect(purgeSupabaseMealCopies('user-1')).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  })
})
