import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearUserWaterGoal,
  getUserWaterGoalMl,
  isValidUserWaterGoalMl,
  parseUserWaterGoalRecord,
  parseWaterGoalInput,
  setUserWaterGoalMl,
  USER_WATER_GOAL_KEY,
  WATER_GOAL_CHOICE_ADVICE,
  WATER_GOAL_MAX_ML,
  WATER_GOAL_MIN_ML,
} from './userWaterGoal'

const store = new Map<string, string>()

describe('userWaterGoal', () => {
  beforeEach(() => {
    store.clear()
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
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('source user : objectif conservé', () => {
    expect(setUserWaterGoalMl(2000)).toBe(true)
    expect(getUserWaterGoalMl()).toBe(2000)
    const raw = store.get(USER_WATER_GOAL_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.source).toBe('user')
    expect(parsed.goalMl).toBe(2000)
    expect(parsed.version).toBe(1)
  })

  it('sans source user : valeur ignorée et nettoyée', () => {
    store.set(
      USER_WATER_GOAL_KEY,
      JSON.stringify({ version: 1, goalMl: 2500, source: 'formula', updatedAt: 1 }),
    )
    expect(getUserWaterGoalMl()).toBeNull()
    expect(store.has(USER_WATER_GOAL_KEY)).toBe(false)

    store.set(
      USER_WATER_GOAL_KEY,
      JSON.stringify({ version: 1, goalMl: 2500, updatedAt: 1 }),
    )
    expect(parseUserWaterGoalRecord(store.get(USER_WATER_GOAL_KEY) ?? null)).toBeNull()
    expect(store.has(USER_WATER_GOAL_KEY)).toBe(false)
  })

  it('rejette les valeurs hors plage', () => {
    expect(isValidUserWaterGoalMl(WATER_GOAL_MIN_ML - 1)).toBe(false)
    expect(isValidUserWaterGoalMl(WATER_GOAL_MAX_ML + 1)).toBe(false)
    expect(setUserWaterGoalMl(100)).toBe(false)
    expect(setUserWaterGoalMl(9000)).toBe(false)
    expect(getUserWaterGoalMl()).toBeNull()
  })

  it('parse ml et L sans préremplissage poids', () => {
    expect(parseWaterGoalInput('2000')).toBe(2000)
    expect(parseWaterGoalInput('2 L')).toBe(2000)
    expect(parseWaterGoalInput('1,5')).toBe(1500)
    expect(parseWaterGoalInput('500 ml')).toBe(500)
    expect(parseWaterGoalInput('')).toBeNull()
  })

  it('clearUserWaterGoal retire la clé', () => {
    setUserWaterGoalMl(1800)
    clearUserWaterGoal()
    expect(getUserWaterGoalMl()).toBeNull()
  })

  it('phrase scientifique exacte', () => {
    expect(WATER_GOAL_CHOICE_ADVICE).toBe(
      "Choisis ton objectif. Ce dont tu as besoin change selon toi, la chaleur et l'effort. En cas de doute, demande à un médecin.",
    )
  })
})
