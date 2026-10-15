import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearUserWaterGoal,
  getUserWaterGoalMl,
  isValidUserWaterGoalMl,
  migrateAccueilWaterGoalFromPrefs,
  parseUserWaterGoalRecord,
  parseWaterGoalInput,
  setUserWaterGoalMl,
  USER_WATER_GOAL_KEY,
  WATER_GOAL_CHOICE_ADVICE,
  WATER_GOAL_MAX_ML,
  WATER_GOAL_MIN_ML,
} from './userWaterGoal'

const ACCUEIL_PREFS_KEY = 'ranked-gym:accueil-widget-prefs'

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

  it('parseWaterGoalInput : L / ml → ml entiers', () => {
    expect(parseWaterGoalInput('2 L')).toBe(2000)
    expect(Number.isInteger(parseWaterGoalInput('2 L'))).toBe(true)

    expect(parseWaterGoalInput('2,5 L')).toBe(2500)
    expect(Number.isInteger(parseWaterGoalInput('2,5 L'))).toBe(true)

    expect(parseWaterGoalInput('2.5 L')).toBe(2500)
    expect(Number.isInteger(parseWaterGoalInput('2.5 L'))).toBe(true)

    expect(parseWaterGoalInput('2000 ml')).toBe(2000)
    expect(Number.isInteger(parseWaterGoalInput('2000 ml'))).toBe(true)
  })

  it('round-trip setUserWaterGoalMl(parseWaterGoalInput(« 2,5 L »)) → 2500 entier', () => {
    const parsed = parseWaterGoalInput('2,5 L')
    expect(setUserWaterGoalMl(parsed!)).toBe(true)
    expect(getUserWaterGoalMl()).toBe(2500)
    const stored = JSON.parse(store.get(USER_WATER_GOAL_KEY)!)
    expect(stored.goalMl).toBe(2500)
    expect(Number.isInteger(stored.goalMl)).toBe(true)
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

  it('migre prefs.waterGoalMl → userWaterGoal puis retire le champ des prefs', () => {
    store.set(
      ACCUEIL_PREFS_KEY,
      JSON.stringify({
        version: 2,
        order: ['eau'],
        hidden: [],
        updatedAt: 1,
        waterGoalMl: 2500,
      }),
    )
    expect(migrateAccueilWaterGoalFromPrefs(99)).toBe(true)
    expect(getUserWaterGoalMl()).toBe(2500)
    const prefs = JSON.parse(store.get(ACCUEIL_PREFS_KEY)!)
    expect(prefs.waterGoalMl).toBeUndefined()
    const goal = JSON.parse(store.get(USER_WATER_GOAL_KEY)!)
    expect(goal).toMatchObject({ goalMl: 2500, source: 'user', version: 1, updatedAt: 99 })

    // Idempotent — second pass does not overwrite
    expect(migrateAccueilWaterGoalFromPrefs(200)).toBe(false)
    expect(getUserWaterGoalMl()).toBe(2500)
  })

  it('ne migre pas si userWaterGoal existe déjà — strip seulement le champ prefs', () => {
    setUserWaterGoalMl(1800, 1)
    store.set(
      ACCUEIL_PREFS_KEY,
      JSON.stringify({
        version: 2,
        order: ['eau'],
        hidden: [],
        updatedAt: 1,
        waterGoalMl: 3000,
      }),
    )
    expect(migrateAccueilWaterGoalFromPrefs(50)).toBe(false)
    expect(getUserWaterGoalMl()).toBe(1800)
    expect(JSON.parse(store.get(ACCUEIL_PREFS_KEY)!).waterGoalMl).toBeUndefined()
  })

  it('droppe un prefs.waterGoalMl hors bornes sans créer de userWaterGoal', () => {
    store.set(
      ACCUEIL_PREFS_KEY,
      JSON.stringify({
        version: 2,
        order: ['eau'],
        hidden: [],
        updatedAt: 1,
        waterGoalMl: 50,
      }),
    )
    expect(migrateAccueilWaterGoalFromPrefs()).toBe(false)
    expect(getUserWaterGoalMl()).toBeNull()
    expect(JSON.parse(store.get(ACCUEIL_PREFS_KEY)!).waterGoalMl).toBeUndefined()
  })
})
