import { describe, expect, it } from 'vitest'
import type { WorkoutNote } from '../types/training'
import {
  MISSING_VALUE,
  formatHistoryDetailDateLine,
  formatHistoryDetailMetric,
  formatSetEffortLabel,
  formatSetRepsLabel,
  formatSetWeightLabel,
  historySessionMetrics,
} from './historySessionDetail'

function note(patch: Partial<WorkoutNote> & Pick<WorkoutNote, 'id'>): WorkoutNote {
  return {
    title: 'Séance',
    dateKey: '2026-09-04',
    createdAt: Date.parse('2026-09-04T15:00:00Z'),
    estimatedKcal: 0,
    exercises: [],
    ...patch,
  }
}

describe('historySessionDetail', () => {
  it('force legacy : durée estimée, volume réel, kcal si > 0', () => {
    const metrics = historySessionMetrics(
      note({
        id: 'legacy',
        estimatedKcal: 120,
        exercises: [{ id: 'bench', name: 'Développé couché', sets: [{ reps: 8, weightKg: 50 }] }],
      }),
    )
    expect(metrics.kind).toBe('strength')
    expect(metrics.duration).toBe(15)
    expect(metrics.volume).toBe(400)
    expect(metrics.kcal).toBe(120)
  })

  it('course sans durée : pas de minutes inventées, pas de volume, pas de kcal 0', () => {
    const metrics = historySessionMetrics(
      note({
        id: 'run',
        durationMin: 0,
        totalVolumeKg: 0,
        estimatedKcal: 0,
        sessionKind: 'endurance',
        sportId: 'course-a-pied',
        exercises: [{ id: 'run', name: 'Course', sets: [{ reps: 42, weightKg: 0 }] }],
      }),
    )
    expect(metrics.kind).toBe('endurance')
    expect(metrics.duration).toBeNull()
    expect(metrics.volume).toBeNull()
    expect(metrics.kcal).toBeNull()
  })

  it('absents → tiret, jamais 0 fictif', () => {
    expect(formatHistoryDetailMetric('duration', null)).toBe(MISSING_VALUE)
    expect(formatHistoryDetailMetric('volume', null)).toBe(MISSING_VALUE)
    expect(formatHistoryDetailMetric('kcal', null)).toBe(MISSING_VALUE)
    expect(formatHistoryDetailMetric('duration', 22)).toBe('22 min')
    expect(formatHistoryDetailMetric('volume', 500)).toBe('500 kg')
    expect(formatHistoryDetailMetric('kcal', 210)).toBe('210 kcal')
  })

  it('poids / reps / effort : force réelle vs endurance legacy', () => {
    expect(formatSetWeightLabel('strength', 100)).toBe('100 kg')
    expect(formatSetWeightLabel('strength', 82.5)).toBe('82.5 kg')
    expect(formatSetWeightLabel('strength', 0)).toBe(MISSING_VALUE)
    expect(formatSetWeightLabel('endurance', 0)).toBe(MISSING_VALUE)
    expect(formatSetRepsLabel('strength', 5)).toBe('5')
    expect(formatSetRepsLabel('strength', 0)).toBe(MISSING_VALUE)
    expect(formatSetRepsLabel('endurance', 42)).toBe(MISSING_VALUE)
    expect(formatSetEffortLabel('strength', {})).toBe(MISSING_VALUE)
    expect(formatSetEffortLabel('strength', { difficulty: 'ok' })).toBe('OK')
    expect(formatSetEffortLabel('endurance', { difficulty: 'ok' })).toBe(MISSING_VALUE)
    expect(formatSetEffortLabel('generic', { difficulty: 'hard' })).toBe('Dur')
    expect(formatSetEffortLabel('strength', { rpe: 8 })).toBe('8/10')
  })

  it('date + heure depuis dateKey / createdAt, sans valeur d’exemple', () => {
    const now = new Date(2026, 8, 20, 12, 0, 0)
    expect(
      formatHistoryDetailDateLine(
        { dateKey: '2026-09-20', createdAt: new Date(2026, 8, 20, 18, 30, 0).getTime() },
        now,
      ),
    ).toMatch(/^Aujourd’hui · /)
    expect(
      formatHistoryDetailDateLine(
        { dateKey: '2026-09-19', createdAt: new Date(2026, 8, 19, 19, 15, 0).getTime() },
        now,
      ),
    ).toMatch(/^Hier · /)
  })
})
