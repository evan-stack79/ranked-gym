import { describe, expect, it } from 'vitest'
import { SPORTS } from '../data/sports'
import type { WorkoutNote } from '../types/training'
import { deriveWeeklySummary, resolveSessionKind, trainSessionKindForSport } from './trainHub'
import { dedupeWorkoutNotes } from './workoutHistory'

describe('Train — catalogue et notes legacy', () => {
  it.each([
    ['musculation', 'strength'], ['crossfit', 'strength'], ['calisthenics', 'strength'],
    ['course-a-pied', 'endurance'], ['velo', 'endurance'], ['trail', 'endurance'],
    ['football', 'team'], ['basketball', 'team'], ['yoga', 'generic'],
    ['tennis', 'generic'], ['natation', 'generic'], ['escalade', 'generic'],
    ['ski', 'generic'], ['boxe', 'generic'], ['inconnu', 'generic'],
  ] as const)('%s ouvre la famille %s et classe ses notes legacy', (sportId, kind) => {
    expect(trainSessionKindForSport(sportId)).toBe(kind)
    const note: WorkoutNote = {
      id: 'legacy', title: 'Séance', sportId, exercises: [{ id: 'e', name: 'Activité', sets: [{ reps: 30, weightKg: 0 }] }],
      dateKey: '2026-09-04', createdAt: new Date('2026-09-04T10:00:00').getTime(),
      estimatedKcal: 0, durationMin: 30,
    }
    expect(resolveSessionKind(note)).toBe(kind)
    const filter = kind === 'generic' ? 'other' : kind
    expect(deriveWeeklySummary([note], filter, new Date('2026-09-04T15:00:00')).sessionCount).toBe(1)
  })
  it('conserve les métadonnées explicites sans réécrire la note', () => {
    const note: WorkoutNote = {
      id: 'explicit', title: 'Circuit', sportId: 'yoga', sessionKind: 'strength',
      exercises: [], estimatedKcal: 0, dateKey: '2026-09-04', createdAt: 1,
    }
    const original = structuredClone(note)
    expect(resolveSessionKind(note)).toBe('strength')
    expect(note).toEqual(original)
  })
  it('tout le catalogue possède un formulaire, jamais force par fallback fitness', () => {
    for (const sport of SPORTS) {
      expect(['strength', 'endurance', 'team', 'generic']).toContain(trainSessionKindForSport(sport.id))
      if (sport.category !== 'strength') expect(trainSessionKindForSport(sport.id)).not.toBe('strength')
    }
  })
})

describe('Déduplication multisport', () => {
  it('conserve deux sports distincts enregistrés à quelques secondes', () => {
    const base = { title: 'Yoga', sportId: 'yoga', sessionKind: 'generic' as const,
      dateKey: '2026-09-04', createdAt: 1_000_000, estimatedKcal: 0, durationMin: 30,
      exercises: [{ id: 'e', name: 'Activité', sets: [{ reps: 30, weightKg: 0 }] }] }
    const notes: WorkoutNote[] = [
      { ...base, id: 'one' },
      { ...base, id: 'two', title: 'Tennis', sportId: 'tennis', createdAt: 1_030_000 },
    ]
    expect(dedupeWorkoutNotes(notes)).toHaveLength(2)
  })

  it('conserve une note typée face à une note legacy ambiguë', () => {
    const common = {
      title: 'Séance', dateKey: '2026-09-04', estimatedKcal: 0, durationMin: 30,
      exercises: [{ id: 'e', name: 'Activité', sets: [{ reps: 30, weightKg: 0 }] }],
    }
    expect(dedupeWorkoutNotes([
      { ...common, id: 'typed', createdAt: 1_000_000, sportId: 'football', sessionKind: 'team' },
      { ...common, id: 'legacy', createdAt: 1_010_000 },
    ])).toHaveLength(2)
  })

  it('continue de fusionner un vrai doublon de sync du même sport et focus', () => {
    const common = {
      title: 'Push', dateKey: '2026-09-04', estimatedKcal: 100, routineId: 'push',
      sportId: 'musculation', sessionKind: 'strength' as const,
      exercises: [{ id: 'e', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
    }
    expect(dedupeWorkoutNotes([
      { ...common, id: 'local', createdAt: 1_000_000 },
      { ...common, id: 'cloud', createdAt: 1_010_000 },
    ])).toHaveLength(1)
  })
})
