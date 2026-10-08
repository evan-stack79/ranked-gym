import { describe, expect, it } from 'vitest'
import type { TrainingState, WorkoutRoutine } from '../types/training'
import {
  createDefaultAccueilWidgetPrefs,
  normalizeAccueilWidgetPrefs,
  setAccueilWaterGoalMl,
} from './accueilWidgetPrefs'
import {
  deriveNextSessionTile,
  deriveProgramTileModel,
  deriveSetsTileModel,
  deriveWaterTileModel,
  deriveWeekSessionBars,
  formatWaterGoalHint,
  waterRingFromPrefs,
} from './accueilWidgetTiles'

const FIXED = new Date('2026-10-07T18:30:00') // mercredi

function routine(id: string, setCount: number, doneCount = 0): WorkoutRoutine {
  const sets = Array.from({ length: setCount }, (_, i) => ({
    reps: 8,
    weightKg: 40,
    done: i < doneCount,
  }))
  return {
    id,
    label: id,
    subtitle: id,
    accent: '#FF2B2B',
    updatedAt: FIXED.getTime(),
    exercises: [{ id: `e-${id}`, name: 'Exo', sets }],
  }
}

function baseState(partial: Partial<TrainingState> = {}): TrainingState {
  return {
    primarySportId: 'musculation',
    favoriteSportIds: ['musculation'],
    stepsToday: 0,
    stepsDateKey: '2026-10-07',
    healthLinked: false,
    notificationsEnabled: false,
    templates: [],
    schedule: [],
    completed: [],
    workoutNotes: [],
    routines: [routine('push', 6, 2)],
    lastSelectedRoutineId: 'push',
    lastSelectedSportId: 'musculation',
    activeWorkoutDraft: null,
    lastVoluntaryRoute: 'train-hub',
    sportsOnboardingComplete: true,
    ...partial,
  }
}

describe('accueilWidgetTiles — water ring', () => {
  it('shows ring only when prefs have an explicit user goal', () => {
    const noGoal = createDefaultAccueilWidgetPrefs()
    expect(waterRingFromPrefs(noGoal).showRing).toBe(false)
    expect(deriveWaterTileModel(noGoal, 1200).showRing).toBe(false)
    expect(deriveWaterTileModel(noGoal, 1200).waterMl).toBe(1200)

    const withGoal = setAccueilWaterGoalMl(noGoal, 2500, 1)
    const model = deriveWaterTileModel(withGoal, 1200)
    expect(model.showRing).toBe(true)
    expect(model.goalMl).toBe(2500)
    expect(model.progress).toBeCloseTo(1200 / 2500)

    // Migrated v1 prefs without waterGoalMl → no ring
    const migrated = normalizeAccueilWidgetPrefs({
      version: 1,
      order: ['seance', 'recent', 'programme'],
      hidden: [],
      updatedAt: 1,
    })
    expect(waterRingFromPrefs(migrated).showRing).toBe(false)
  })

  it('never treats weight-based auto goal as a user goal (prefs only)', () => {
    // Even if someone passes a huge water total, ring stays off without prefs goal
    const prefs = createDefaultAccueilWidgetPrefs()
    expect(deriveWaterTileModel(prefs, 5000).showRing).toBe(false)
  })
})

describe('accueilWidgetTiles — sets goal from planned sets', () => {
  it('ring goal = planned sets in active/today session; no plan → count only', () => {
    const withActive = baseState({
      activeWorkoutDraft: {
        routineId: 'push',
        sportId: 'musculation',
        startedAt: FIXED.getTime() - 1000,
        updatedAt: FIXED.getTime(),
      },
      routines: [routine('push', 6, 2)],
    })
    const activeModel = deriveSetsTileModel(withActive, FIXED)
    expect(activeModel.doneSets).toBe(2)
    expect(activeModel.plannedSets).toBe(6)
    expect(activeModel.showRing).toBe(true)
    expect(activeModel.progress).toBeCloseTo(2 / 6)

    const noPlan = baseState({
      schedule: [],
      activeWorkoutDraft: null,
      workoutNotes: [
        {
          id: 'n1',
          title: 'Libre',
          dateKey: '2026-10-07',
          createdAt: FIXED.getTime(),
          estimatedKcal: 180,
          exercises: [
            {
              id: 'e1',
              name: 'Curl',
              sets: [
                { reps: 10, weightKg: 12 },
                { reps: 10, weightKg: 12 },
              ],
            },
          ],
        },
      ],
    })
    const freeModel = deriveSetsTileModel(noPlan, FIXED)
    expect(freeModel.doneSets).toBe(2)
    expect(freeModel.plannedSets).toBeNull()
    expect(freeModel.showRing).toBe(false)

    const planned = baseState({
      schedule: [
        {
          id: 'sch-1',
          templateId: 'tpl-push',
          title: 'Push',
          days: [3], // mercredi
          time: '18:00',
          enabled: true,
          sportId: 'musculation',
          sessionKind: 'strength',
        },
      ],
      routines: [routine('push', 4, 0)],
      activeWorkoutDraft: null,
    })
    const planModel = deriveSetsTileModel(planned, FIXED)
    expect(planModel.plannedSets).toBe(4)
    expect(planModel.showRing).toBe(true)
  })
})

describe('accueilWidgetTiles — week bars & next session', () => {
  it('counts logged sessions per day of the current week', () => {
    const exo = (id: string) => [
      { id, name: 'Exo', sets: [{ reps: 8, weightKg: 40 }] },
    ]
    const state = baseState({
      workoutNotes: [
        {
          id: 'a',
          title: 'A',
          dateKey: '2026-10-06', // mardi
          createdAt: new Date('2026-10-06T12:00:00').getTime(),
          estimatedKcal: 200,
          exercises: exo('ea'),
        },
        {
          id: 'b',
          title: 'B',
          dateKey: '2026-10-07',
          createdAt: FIXED.getTime(),
          estimatedKcal: 200,
          sportId: 'musculation',
          exercises: exo('eb'),
        },
        {
          id: 'c',
          title: 'C',
          dateKey: '2026-10-07',
          createdAt: FIXED.getTime() + 180_000,
          estimatedKcal: 220,
          sportId: 'musculation',
          exercises: exo('ec'),
        },
      ],
    })
    const bars = deriveWeekSessionBars(state, FIXED)
    expect(bars).toHaveLength(7)
    const tue = bars.find((b) => b.dateKey === '2026-10-06')
    const wed = bars.find((b) => b.dateKey === '2026-10-07')
    expect(tue?.count).toBe(1)
    expect(wed?.count).toBe(2)
    expect(wed?.isToday).toBe(true)
    expect(wed!.heightRatio).toBe(1)
    expect(tue!.heightRatio).toBe(0.5)
  })

  it('next session: Démarrer when not started, Reprendre when in progress', () => {
    const planned = baseState({
      schedule: [
        {
          id: 'sch-1',
          templateId: 'tpl-push',
          title: 'Push',
          days: [3],
          time: '18:00',
          enabled: true,
          sportId: 'musculation',
          sessionKind: 'strength',
        },
      ],
      routines: [routine('push', 4, 0)],
      activeWorkoutDraft: null,
    })
    const next = deriveNextSessionTile(planned, FIXED)
    expect(next.title).toBe('Push')
    expect(next.canStart).toBe(true)
    expect(next.inProgress).toBe(false)
    expect(next.routineId).toBe('push')

    const inProgress = baseState({
      activeWorkoutDraft: {
        routineId: 'push',
        sportId: 'musculation',
        startedAt: FIXED.getTime() - 1000,
        updatedAt: FIXED.getTime(),
      },
      routines: [routine('push', 4, 1)],
    })
    const resume = deriveNextSessionTile(inProgress, FIXED)
    expect(resume.inProgress).toBe(true)
    expect(resume.subtitle).toBe('Séance en cours')
    expect(resume.canStart).toBe(true)
  })

  it('programme subtitle is X / Y séances, not a repeated %', () => {
    const state = baseState({
      schedule: [
        {
          id: 'sch-1',
          templateId: 'tpl-push',
          title: 'Push',
          days: [1, 3, 5],
          time: '18:00',
          enabled: true,
          sportId: 'musculation',
          sessionKind: 'strength',
        },
      ],
      workoutNotes: [
        {
          id: 'n1',
          title: 'Push',
          dateKey: '2026-10-06',
          createdAt: new Date('2026-10-06T12:00:00').getTime(),
          estimatedKcal: 200,
          exercises: [{ id: 'e', name: 'Exo', sets: [{ reps: 8, weightKg: 40 }] }],
        },
      ],
    })
    const model = deriveProgramTileModel(state, FIXED)
    expect(model.plannedSessions).toBe(3)
    expect(model.doneSessions).toBe(1)
    expect(model.label).toBe('1 / 3 séances du programme')
    expect(model.label).not.toMatch(/%/)
    expect(model.label).not.toMatch(/cette semaine/)
  })

  it('formats water goal hint on one compact line', () => {
    expect(formatWaterGoalHint(2500)).toBe('sur 2,5 L')
    expect(formatWaterGoalHint(2000)).toBe('sur 2 L')
    expect(formatWaterGoalHint(750)).toBe('sur 750 ml')
  })
})
