/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  backupPayloadContainsMealName,
  journalJsonContainsMealName,
} from '../utils/stripJournalMeals'

const isSupabaseConfigured = vi.fn(() => true)
const getUser = vi.fn()
const fromMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
  getSupabase: () => ({
    auth: { getUser: (...args: unknown[]) => getUser(...args) },
    from: (...args: unknown[]) => fromMock(...args),
  }),
}))

describe('purgeSupabaseMealCopies', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isSupabaseConfigured.mockReturnValue(true)
    getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    })
  })

  it('retire les repas ; identité via getUser (pas d’id argument) ; garde eau / train', async () => {
    const mealName = 'Skyr Vanille'
    let nutritionJournal: unknown = {
      '2026-10-14': {
        meals: [{ id: 'm1', name: mealName, calories: 120 }],
        waterMl: 400,
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
                data: {
                  journal: nutritionJournal,
                  profile: {},
                  updated_at: 't0',
                  user_id: 'auth-user-1',
                },
                error: null,
                count: 1,
              }),
            }),
          }),
          update: (patch: { journal: unknown }) => ({
            eq: () => ({
              select: async () => {
                nutritionJournal = patch.journal
                return { error: null, data: [{ user_id: 'auth-user-1' }] }
              },
            }),
          }),
        }
      }
      if (table === 'user_backups') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { payload: backupPayload, updated_at: 't0', user_id: 'auth-user-1' },
                error: null,
                count: 1,
              }),
            }),
          }),
          update: (patch: { payload: unknown }) => ({
            eq: () => ({
              select: async () => {
                backupPayload = patch.payload
                return { error: null, data: [{ user_id: 'auth-user-1' }] }
              },
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const { purgeSupabaseMealCopies } = await import('./purgeSupabaseMealCopies')
    const result = await purgeSupabaseMealCopies()

    expect(getUser).toHaveBeenCalled()
    expect(result.resolvedUserId).toBe('auth-user-1')
    expect(typeof result.deletedCount).toBe('number')
    expect(result.deletedCount).toBeGreaterThanOrEqual(2)
    expect(journalJsonContainsMealName(nutritionJournal, mealName)).toBe(false)
    expect(backupPayloadContainsMealName(backupPayload, mealName)).toBe(false)
    expect(
      (nutritionJournal as { '2026-10-14': { waterMl: number } })['2026-10-14'].waterMl,
    ).toBe(400)
  })

  it('fake Supabase « 0 found » sans count confirmé alors que repas existent → erreur', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          // Réponse ambiguë type maybeSingle vide — count absent
          maybeSingle: async () => ({
            data: null,
            error: null,
            count: undefined,
          }),
        }),
      }),
    }))

    const { purgeSupabaseMealCopies, EraseMealsPurgeError, ERASE_MEALS_PURGE_FAILED_MESSAGE } =
      await import('./purgeSupabaseMealCopies')

    await expect(purgeSupabaseMealCopies()).rejects.toBeInstanceOf(EraseMealsPurgeError)
    await expect(purgeSupabaseMealCopies()).rejects.toThrow(ERASE_MEALS_PURGE_FAILED_MESSAGE)
  })

  it('journal string invalide → erreur, aucune écriture', async () => {
    let updated = false
    fromMock.mockImplementation((table: string) => {
      if (table === 'nutrition') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  journal: '{broken',
                  user_id: 'auth-user-1',
                },
                error: null,
                count: 1,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: async () => {
                updated = true
                return { error: null, count: 1 }
              },
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null, count: 0 }),
          }),
        }),
      }
    })

    const { purgeSupabaseMealCopies, EraseMealsPurgeError } = await import(
      './purgeSupabaseMealCopies'
    )
    await expect(purgeSupabaseMealCopies()).rejects.toBeInstanceOf(EraseMealsPurgeError)
    expect(updated).toBe(false)
  })

  it('absent confirmé (count === 0) → succès serveur deletedCount 0', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null, count: 0 }),
        }),
      }),
    }))

    const { purgeSupabaseMealCopies } = await import('./purgeSupabaseMealCopies')
    const result = await purgeSupabaseMealCopies()
    expect(result.deletedCount).toBe(0)
    expect(result.nutritionStatus).toBe('absent')
    expect(result.userBackupsStatus).toBe('absent')
  })
})
