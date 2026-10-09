import { describe, expect, it } from 'vitest'
import {
  clampWeeklySessionGoal,
  mergeWeeklySessionGoal,
  resolveWeeklySessionGoal,
  WEEKLY_SESSION_GOAL_DEFAULT,
} from './trainWeeklyGoal'
import { countSessionsInParisWeek } from './trainWeekProgress'
import type { WorkoutNote } from '../types/training'

describe('Mon objectif de la semaine', () => {
  it('defaults to 2, clamps 1–5, newest-wins sync, counts Paris-week Train sessions only', () => {
    expect(WEEKLY_SESSION_GOAL_DEFAULT).toBe(2)
    expect(clampWeeklySessionGoal(0)).toBe(1)
    expect(clampWeeklySessionGoal(9)).toBe(5)
    expect(clampWeeklySessionGoal(3)).toBe(3)

    const merged = mergeWeeklySessionGoal(
      { target: 4, updatedAt: 200 },
      { target: 1, updatedAt: 100 },
    )
    expect(merged.target).toBe(4)

    const lift = [{ id: 'ex', name: 'Presse', sets: [{ reps: 10, weightKg: 40 }] }]
    const notes: WorkoutNote[] = [
      {
        id: 'a',
        title: 'A',
        dateKey: '2026-10-07',
        exercises: lift,
        createdAt: 1,
        estimatedKcal: 0,
      },
      {
        id: 'b',
        title: 'B',
        dateKey: '2026-10-08',
        exercises: lift,
        createdAt: 2,
        estimatedKcal: 0,
      },
      {
        id: 'old',
        title: 'Old',
        dateKey: '2026-09-01',
        exercises: lift,
        createdAt: 3,
        estimatedKcal: 0,
      },
    ]
    const wed = new Date('2026-10-07T10:00:00Z')
    expect(countSessionsInParisWeek(notes, wed)).toBe(2)
    expect(resolveWeeklySessionGoal(null)).toBe(2)
  })
})
