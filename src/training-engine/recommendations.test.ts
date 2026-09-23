import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG, getCatalogExercise } from '../data/exerciseCatalog'
import {
  recommendExercises,
  resolveCanonicalExerciseId,
  scoreCatalogCandidates,
  lastLoggedSetCount,
} from './recommendations'
import type { RecommendationHistoryEntry, RecommendationProfile } from './types'

const NOW = Date.parse('2026-09-23T10:00:00.000Z')

function history(
  id: string,
  count: number,
  opts?: { daysAgo?: number },
): RecommendationHistoryEntry[] {
  const createdAt = NOW - (opts?.daysAgo ?? 3) * 24 * 60 * 60 * 1000
  return Array.from({ length: count }, (_, i) => ({
    canonicalExerciseId: id,
    completed: true,
    createdAt: createdAt - i * 60_000,
    dateKey: '2026-09-20',
  }))
}

function baseProfile(patch: Partial<RecommendationProfile> = {}): RecommendationProfile {
  return {
    selectedSportIds: ['musculation'],
    goal: 'bulk',
    nowMs: NOW,
    history: [],
    ...patch,
  }
}

describe('catalogue canonique', () => {
  it('chaque exercice a sport, mouvement, effort, niveau', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThan(10)
    for (const ex of EXERCISE_CATALOG) {
      expect(ex.sportIds.length).toBeGreaterThan(0)
      expect(['push', 'pull', 'legs', 'core']).toContain(ex.movement)
      expect(['strength', 'hypertrophy', 'endurance']).toContain(ex.effortType)
      expect(['beginner', 'intermediate', 'advanced']).toContain(ex.level)
      expect(getCatalogExercise(ex.id)?.id).toBe(ex.id)
    }
  })
})

describe('recommendExercises', () => {
  it('nouvel utilisateur : propose depuis sports + objectif, sans historique', () => {
    const result = recommendExercises(baseProfile())
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.redo).toBeNull()
    expect(result.discover).not.toBeNull()
    expect(result.discover?.canonicalExerciseId).toBeTruthy()
    expect(getCatalogExercise(result.discover!.canonicalExerciseId)).toBeTruthy()
    expect(result.discover?.reasonText).not.toMatch(/%|kcal|médical/i)
    expect(['goal_equipment', 'sport_match', 'level_match']).toContain(result.discover!.reasonCode)
  })

  it('multisport callisthénie : un exercice poids du corps peut sortir', () => {
    const result = recommendExercises(
      baseProfile({
        selectedSportIds: ['calisthenics'],
        availableEquipment: ['Poids du corps'],
      }),
    )
    expect(result.items.length).toBeGreaterThan(0)
    for (const item of result.items) {
      const ex = getCatalogExercise(item.canonicalExerciseId)
      expect(ex?.equipment).toBe('Poids du corps')
      expect(ex?.sportIds).toContain('calisthenics')
    }
  })

  it('exercice fréquent → À refaire + justification fréquent', () => {
    const result = recommendExercises(
      baseProfile({
        history: history('bench_press', 3),
      }),
    )
    expect(result.redo?.canonicalExerciseId).toBe('bench_press')
    expect(result.redo?.reasonCode).toBe('frequent_movement')
    expect(result.redo?.reasonText).toBe('Parce que tu réalises souvent ce mouvement')
    const scored = scoreCatalogCandidates(
      baseProfile({ history: history('bench_press', 3) }),
    )
    const bench = scored.find((row) => row.exercise.id === 'bench_press')
    expect(bench?.frequencyPoints).toBeGreaterThanOrEqual(80)
    expect(result.redo?.score).toBe(bench?.score)
  })

  it('exercice refusé « Pas pour moi » exclu', () => {
    const withBench = recommendExercises(baseProfile({ history: history('bench_press', 3) }))
    expect(withBench.redo?.canonicalExerciseId).toBe('bench_press')
    const dismissed = recommendExercises(
      baseProfile({
        history: history('bench_press', 3),
        dismissedExerciseIds: ['bench_press'],
      }),
    )
    expect(dismissed.items.every((item) => item.canonicalExerciseId !== 'bench_press')).toBe(true)
  })

  it('matériel incompatible exclu (barre absente)', () => {
    const result = recommendExercises(
      baseProfile({
        availableEquipment: ['Haltères'],
        history: history('bench_press', 4),
      }),
    )
    for (const item of result.items) {
      expect(getCatalogExercise(item.canonicalExerciseId)?.equipment).toBe('Haltères')
    }
    expect(result.items.some((item) => item.canonicalExerciseId === 'bench_press')).toBe(false)
  })

  it('limitation musculaire déclarée exclut les pecs', () => {
    const result = recommendExercises(
      baseProfile({
        limitedMuscles: ['Pectoraux'],
        history: history('bench_press', 4),
      }),
    )
    for (const item of result.items) {
      const ex = getCatalogExercise(item.canonicalExerciseId)
      expect(ex?.muscles.includes('Pectoraux')).toBe(false)
    }
  })

  it('aucun candidat (sport hors catalogue exercice) → pas de carte fake', () => {
    const result = recommendExercises(
      baseProfile({
        selectedSportIds: ['tennis'],
        sportsUndecided: false,
      }),
    )
    expect(result.items).toEqual([])
    expect(result.redo).toBeNull()
    expect(result.discover).toBeNull()
  })

  it('doublon déjà dans la séance exclu', () => {
    const result = recommendExercises(
      baseProfile({
        currentSessionCanonicalIds: ['bench_press'],
        history: history('bench_press', 4),
      }),
    )
    expect(result.items.every((item) => item.canonicalExerciseId !== 'bench_press')).toBe(true)
  })

  it('titre libre non canonique ne compte pas comme historique', () => {
    expect(resolveCanonicalExerciseId({ name: 'DÉVELOPPER' })).toBeNull()
    const result = recommendExercises(
      baseProfile({
        history: [
          {
            canonicalExerciseId: resolveCanonicalExerciseId({ name: 'DÉVELOPPER' }),
            completed: true,
            createdAt: NOW,
            dateKey: '2026-09-23',
          },
        ],
      }),
    )
    expect(result.redo).toBeNull()
    expect(result.discover).not.toBeNull()
  })

  it('justification cohérente avec le score (complément poussée)', () => {
    const result = recommendExercises(
      baseProfile({
        currentSessionCanonicalIds: ['bench_press'],
        history: [],
      }),
    )
    expect(result.discover).not.toBeNull()
    const scored = scoreCatalogCandidates(
      baseProfile({ currentSessionCanonicalIds: ['bench_press'] }),
    )
    const top = scored[0]
    expect(result.discover?.canonicalExerciseId).toBe(top.exercise.id)
    expect(result.discover?.reasonCode).toBe(top.reasonCode)
    if (top.complementPoints > 0) {
      expect(['complete_pull', 'complete_legs']).toContain(top.reasonCode)
      expect(result.discover?.reasonText.startsWith('Pour compléter ton entraînement')).toBe(true)
    }
  })
})

describe('lastLoggedSetCount', () => {
  it('lit le nombre de séries du dernier log canonique, sinon null', () => {
    expect(lastLoggedSetCount([], 'bench_press')).toBeNull()
    expect(
      lastLoggedSetCount(
        [
          {
            id: 'n',
            title: 'Push',
            dateKey: '2026-09-20',
            createdAt: NOW,
            estimatedKcal: 0,
            exercises: [
              {
                id: 'e',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [{ reps: 8, weightKg: 60 }, { reps: 6, weightKg: 60 }, { reps: 6, weightKg: 55 }],
              },
            ],
          },
        ],
        'bench_press',
      ),
    ).toBe(3)
    expect(
      lastLoggedSetCount(
        [
          {
            id: 'n',
            title: 'Push',
            dateKey: '2026-09-20',
            createdAt: NOW,
            estimatedKcal: 0,
            exercises: [{ id: 'e', name: 'DÉVELOPPER', sets: [{ reps: 8, weightKg: 20 }] }],
          },
        ],
        'bench_press',
      ),
    ).toBeNull()
    expect(
      lastLoggedSetCount(
        [
          {
            id: 'old',
            title: 'Push',
            dateKey: '2026-09-10',
            createdAt: NOW - 10 * 86400000,
            estimatedKcal: 0,
            exercises: [
              {
                id: 'e1',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [{ reps: 8, weightKg: 40 }, { reps: 8, weightKg: 40 }, { reps: 8, weightKg: 40 }],
              },
            ],
          },
          {
            id: 'new',
            title: 'Push',
            dateKey: '2026-09-22',
            createdAt: NOW - 86400000,
            estimatedKcal: 0,
            exercises: [
              {
                id: 'e2',
                name: 'Développé couché',
                canonicalExerciseId: 'bench_press',
                sets: [{ reps: 8, weightKg: 60 }, { reps: 6, weightKg: 60 }],
              },
            ],
          },
        ],
        'bench_press',
      ),
    ).toBe(2)
  })
})
