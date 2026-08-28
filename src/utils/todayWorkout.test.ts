import { describe, expect, it } from 'vitest'
import type { TrainingState, Weekday } from '../types/training'
import { getTodayWorkout } from './todayWorkout'

const FIXED_DATE = new Date('2026-08-25T12:00:00')
const WEEKDAY = FIXED_DATE.getDay() as Weekday

function scheduled(
  overrides: Partial<TrainingState['schedule'][number]> = {},
): TrainingState['schedule'][number] {
  return {
    id: 's1',
    templateId: 'push',
    title: 'Push',
    days: [WEEKDAY],
    time: '18:00',
    enabled: true,
    ...overrides,
  }
}

function baseState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
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
    ...overrides,
  }
}

describe('getTodayWorkout — démarrabilité', () => {
  it('agenda + routine avec exercices → démarrable', () => {
    const plan = getTodayWorkout(
      baseState({ schedule: [scheduled()] }),
      FIXED_DATE,
    )

    expect(plan).toMatchObject({
      title: 'Push',
      routineId: 'push',
      exerciseCount: 1,
      canStart: true,
      source: 'schedule',
    })
  })

  it('agenda notebook introuvable → planifié mais non démarrable', () => {
    const plan = getTodayWorkout(
      baseState({
        schedule: [
          scheduled({
            templateId: 'notebook',
            title: 'Foot',
          }),
        ],
      }),
      FIXED_DATE,
    )

    expect(plan).toMatchObject({
      title: 'Foot',
      routineId: 'notebook',
      exerciseCount: 0,
      canStart: false,
    })
  })

  it('agenda lié à une routine vide → non démarrable', () => {
    const plan = getTodayWorkout(
      baseState({
        schedule: [scheduled({ templateId: 'push', title: 'Push vide' })],
        routines: [
          {
            id: 'push',
            label: 'Push',
            subtitle: 'Pecs',
            accent: '#f00',
            exercises: [],
            updatedAt: 1,
          },
        ],
      }),
      FIXED_DATE,
    )

    expect(plan).toMatchObject({
      title: 'Push vide',
      routineId: 'push',
      exerciseCount: 0,
      canStart: false,
    })
  })

  it('routine supprimée après planification → non démarrable', () => {
    const plan = getTodayWorkout(
      baseState({
        schedule: [scheduled({ templateId: 'pull', title: 'Pull' })],
        routines: [],
      }),
      FIXED_DATE,
    )

    expect(plan).toMatchObject({
      title: 'Pull',
      routineId: 'pull',
      exerciseCount: 0,
      canStart: false,
    })
  })

  it('aucune séance planifiée → null', () => {
    expect(getTodayWorkout(baseState(), FIXED_DATE)).toBeNull()
  })

  it('canStart false : identifiant présent mais non transmissible à onStartTraining', () => {
    const plan = getTodayWorkout(
      baseState({
        schedule: [scheduled({ templateId: 'notebook', title: 'Course' })],
      }),
      FIXED_DATE,
    )

    expect(plan?.routineId).toBe('notebook')
    expect(plan?.canStart).toBe(false)
    expect(plan?.canStart ? plan.routineId : null).toBeNull()
  })
})
