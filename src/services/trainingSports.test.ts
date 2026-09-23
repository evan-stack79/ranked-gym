import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v)
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => store.clear(),
})

vi.mock('./cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: () => null,
}))

vi.mock('./nutritionStorage', () => ({
  getCalorieProfile: vi.fn(() => ({
    weightKg: 75,
    onboardingComplete: true,
  })),
}))

const { getTrainingState, setTrainingSports } = await import('./trainingStorage')

describe('setTrainingSports', () => {
  beforeEach(() => {
    store.clear()
  })

  it('persiste une sélection multi-sports dans l’état Training (offline)', () => {
    const next = setTrainingSports(['musculation', 'tennis', 'football'])
    expect(next.favoriteSportIds).toEqual(['musculation', 'tennis', 'football'])
    expect(next.primarySportId).toBe('musculation')
    expect(next.sportsUndecided).toBe(false)
    expect(next.sportsOnboardingComplete).toBe(true)
    expect(getTrainingState().favoriteSportIds).toEqual(['musculation', 'tennis', 'football'])
  })

  it('Je ne sais pas encore : flag dédié, pas de sports inventés', () => {
    const next = setTrainingSports([], { undecided: true })
    expect(next.favoriteSportIds).toEqual([])
    expect(next.sportsUndecided).toBe(true)
    expect(next.sportsOnboardingComplete).toBe(true)
    expect(getTrainingState().sportsUndecided).toBe(true)
  })

  it('ignore un id hors catalogue', () => {
    const next = setTrainingSports(['musculation', 'not-a-sport'])
    expect(next.favoriteSportIds).toEqual(['musculation'])
  })
})
