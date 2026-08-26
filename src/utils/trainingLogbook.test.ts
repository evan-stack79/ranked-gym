import { describe, expect, it } from 'vitest'
import type { TrainingState, WorkoutNote } from '../types/training'
import { findLastExerciseSets, formatSetLoadLabel } from './workoutHistory'
import { getTodayWorkout } from './todayWorkout'

describe('findLastExerciseSets — historique informatif', () => {
  const history: WorkoutNote[] = [
    {
      id: 'n2',
      title: 'Push',
      dateKey: '2026-08-24',
      createdAt: 2000,
      estimatedKcal: 200,
      exercises: [
        {
          id: 'e1',
          name: 'Développé couché',
          sets: [
            { reps: 8, weightKg: 80 },
            { reps: 6, weightKg: 82.5 },
          ],
        },
      ],
    },
    {
      id: 'n1',
      title: 'Push',
      dateKey: '2026-08-20',
      createdAt: 1000,
      estimatedKcal: 180,
      exercises: [
        {
          id: 'e0',
          name: 'Développé couché',
          sets: [{ reps: 10, weightKg: 70 }],
        },
      ],
    },
  ]

  it('retourne la séance la plus récente pour le même exercice', () => {
    const last = findLastExerciseSets(history, 'Développé couché')
    expect(last?.dateKey).toBe('2026-08-24')
    expect(last?.sets).toHaveLength(2)
    expect(formatSetLoadLabel(80, 8)).toBe('80 kg × 8')
    expect(formatSetLoadLabel(82.5, 6)).toBe('82.5 kg × 6')
  })

  it('retourne null si exercice inconnu', () => {
    expect(findLastExerciseSets(history, 'Squat')).toBeNull()
  })
})

describe('getTodayWorkout — pas de suggestion coach', () => {
  const base: TrainingState = {
    primarySportId: 'musculation',
    favoriteSportIds: ['musculation'],
    stepsToday: 0,
    stepsDateKey: '2026-08-25',
    healthLinked: false,
    notificationsEnabled: false,
    templates: [],
    schedule: [],
    completed: [],
    workoutNotes: [],
    routines: [
      {
        id: 'push',
        label: 'Push',
        subtitle: 'Pecs',
        accent: '#f00',
        exercises: [{ id: 'a', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
        updatedAt: 1,
      },
    ],
    lastSelectedRoutineId: null,
    lastSelectedSportId: null,
  }

  it('null sans agenda (aucune rotation automatique)', () => {
    expect(getTodayWorkout(base, new Date('2026-08-25T12:00:00'))).toBeNull()
  })

  it('retourne la séance planifiée du jour', () => {
    const weekday = new Date('2026-08-25T12:00:00').getDay() // Tuesday = 2
    const state: TrainingState = {
      ...base,
      schedule: [
        {
          id: 's1',
          templateId: 'push',
          title: 'Push',
          days: [weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6],
          time: '18:00',
          enabled: true,
        },
      ],
    }
    const plan = getTodayWorkout(state, new Date('2026-08-25T12:00:00'))
    expect(plan?.title).toBe('Push')
    expect(plan?.exerciseCount).toBe(1)
    expect(plan?.source).toBe('schedule')
  })
})
