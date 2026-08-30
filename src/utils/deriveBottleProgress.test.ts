import { describe, expect, it } from 'vitest'
import { BOTTLE_CAPACITY_ML, deriveBottleProgress } from './deriveBottleProgress'

const CAP = BOTTLE_CAPACITY_ML
const GOAL = 2900

describe('deriveBottleProgress', () => {
  it('0 ml — aucune terminée, active vide', () => {
    const r = deriveBottleProgress(0, GOAL, CAP)
    expect(r).toEqual({
      completedCount: 0,
      activeMl: 0,
      activeProgress: 0,
      goalReached: false,
      overGoalMl: 0,
      showActiveBottle: true,
    })
  })

  it('250 ml — active à 250/1500', () => {
    const r = deriveBottleProgress(250, GOAL, CAP)
    expect(r.completedCount).toBe(0)
    expect(r.activeMl).toBe(250)
    expect(r.activeProgress).toBeCloseTo(250 / 1500)
    expect(r.showActiveBottle).toBe(true)
  })

  it('1500 ml — 1 terminée + nouvelle active vide', () => {
    const r = deriveBottleProgress(1500, GOAL, CAP)
    expect(r.completedCount).toBe(1)
    expect(r.activeMl).toBe(0)
    expect(r.activeProgress).toBe(0)
    expect(r.showActiveBottle).toBe(true)
  })

  it('1750 ml — 1 terminée + active 250/1500', () => {
    const r = deriveBottleProgress(1750, GOAL, CAP)
    expect(r.completedCount).toBe(1)
    expect(r.activeMl).toBe(250)
    expect(r.activeProgress).toBeCloseTo(250 / 1500)
    expect(r.showActiveBottle).toBe(true)
  })

  it('2900 ml — objectif atteint, 1 terminée + active 1400/1500', () => {
    const r = deriveBottleProgress(2900, GOAL, CAP)
    expect(r.completedCount).toBe(1)
    expect(r.activeMl).toBe(1400)
    expect(r.activeProgress).toBeCloseTo(1400 / 1500)
    expect(r.goalReached).toBe(true)
    expect(r.overGoalMl).toBe(0)
    expect(r.showActiveBottle).toBe(true)
  })

  it('3000 ml — 2 terminées, objectif atteint, pas de nouvelle active', () => {
    const r = deriveBottleProgress(3000, GOAL, CAP)
    expect(r.completedCount).toBe(2)
    expect(r.activeMl).toBe(0)
    expect(r.goalReached).toBe(true)
    expect(r.overGoalMl).toBe(100)
    expect(r.showActiveBottle).toBe(false)
  })

  it('4500 ml — 3 terminées, aucune active', () => {
    const r = deriveBottleProgress(4500, GOAL, CAP)
    expect(r.completedCount).toBe(3)
    expect(r.activeMl).toBe(0)
    expect(r.showActiveBottle).toBe(false)
  })

  it('7500 ml — 5 terminées (affichage 3 + +2 côté UI)', () => {
    const r = deriveBottleProgress(7500, GOAL, CAP)
    expect(r.completedCount).toBe(5)
    expect(r.activeMl).toBe(0)
    expect(r.showActiveBottle).toBe(false)
  })

  it('objectif inférieur à 1,5 L — atteint avec bouteille partielle', () => {
    const r = deriveBottleProgress(800, 700, CAP)
    expect(r.completedCount).toBe(0)
    expect(r.activeMl).toBe(800)
    expect(r.goalReached).toBe(true)
    expect(r.showActiveBottle).toBe(true)
  })

  it('objectif invalide (0) — jamais atteint', () => {
    const r = deriveBottleProgress(2000, 0, CAP)
    expect(r.goalReached).toBe(false)
    expect(r.overGoalMl).toBe(0)
    expect(r.showActiveBottle).toBe(true)
  })

  it('objectif négatif — traité comme 0', () => {
    const r = deriveBottleProgress(500, -100, CAP)
    expect(r.goalReached).toBe(false)
    expect(r.showActiveBottle).toBe(true)
  })

  it('consommé négatif — ramené à 0', () => {
    const r = deriveBottleProgress(-500, GOAL, CAP)
    expect(r.completedCount).toBe(0)
    expect(r.activeMl).toBe(0)
  })

  it('NaN / Infinity — sanitisation sans NaN ni Infinity', () => {
    for (const consumed of [NaN, Infinity, -Infinity]) {
      const r = deriveBottleProgress(consumed, GOAL, CAP)
      expect(Number.isFinite(r.activeProgress)).toBe(true)
      expect(Number.isFinite(r.completedCount)).toBe(true)
      expect(r.completedCount).toBe(0)
    }
    for (const goal of [NaN, Infinity]) {
      const r = deriveBottleProgress(1000, goal, CAP)
      expect(r.goalReached).toBe(false)
      expect(Number.isFinite(r.overGoalMl)).toBe(true)
    }
  })

  it('capacité invalide — retombe sur 1500', () => {
    const r = deriveBottleProgress(1500, GOAL, 0)
    expect(r.completedCount).toBe(1)
    expect(r.activeMl).toBe(0)
  })

  it('entrée unique 1500 ml — identique à une somme d’entrées', () => {
    const single = deriveBottleProgress(1500, GOAL, CAP)
    const sum = deriveBottleProgress(250 + 250 + 1000, GOAL, CAP)
    expect(single).toEqual(sum)
  })

  it('suppression simulée — recalcul depuis le nouveau total', () => {
    const before = deriveBottleProgress(1750, GOAL, CAP)
    expect(before.completedCount).toBe(1)
    expect(before.activeMl).toBe(250)

    const after = deriveBottleProgress(1500, GOAL, CAP)
    expect(after.completedCount).toBe(1)
    expect(after.activeMl).toBe(0)
  })

  it('changement d’objectif (poids / jour Train) — bouteilles inchangées', () => {
    const consumed = 2000
    const lowGoal = deriveBottleProgress(consumed, 1800, CAP)
    const highGoal = deriveBottleProgress(consumed, 3500, CAP)

    expect(lowGoal.completedCount).toBe(highGoal.completedCount)
    expect(lowGoal.activeMl).toBe(highGoal.activeMl)
    expect(lowGoal.goalReached).toBe(true)
    expect(highGoal.goalReached).toBe(false)
    expect(lowGoal.showActiveBottle).toBe(true)
    expect(highGoal.showActiveBottle).toBe(true)
  })

  describe('liquide visible = capacité − activeMl', () => {
    const remaining = (consumed: number) => CAP - deriveBottleProgress(consumed, GOAL, CAP).activeMl

    it('0 ml → bouteille pleine (1500 ml restants)', () => {
      expect(remaining(0)).toBe(1500)
    })

    it('750 ml → moitié pleine (750 ml restants)', () => {
      expect(remaining(750)).toBe(750)
    })

    it('1 490 ml → presque vide (10 ml restants)', () => {
      expect(remaining(1490)).toBe(10)
    })

    it('1 500 ml → nouvelle bouteille pleine (0 consommé sur active)', () => {
      const r = deriveBottleProgress(1500, GOAL, CAP)
      expect(r.completedCount).toBe(1)
      expect(remaining(1500)).toBe(1500)
    })

    it('1 750 ml → 1 250 ml restants sur active', () => {
      expect(remaining(1750)).toBe(1250)
    })

    it('2 900 ml → 100 ml restants, objectif atteint', () => {
      const r = deriveBottleProgress(2900, GOAL, CAP)
      expect(r.goalReached).toBe(true)
      expect(remaining(2900)).toBe(100)
    })
  })
})
