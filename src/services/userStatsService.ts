import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { safeError } from '../utils/safeLog'
import type { ArenaRadarAxis } from '../components/profile/charts/ArenaRadarChart'
import type { PowerCurvePoint } from '../components/profile/charts/PowerCurveChart'
import { RADAR_AXIS_LABELS } from '../constants/radarLabels'
import { dedupeWorkoutNotes } from '../utils/workoutHistory'
import { getTrainingState } from './trainingStorage'
import {
  isTimestampInLocalWeek,
  workoutValidationMs,
} from '../utils/weekBounds'

export type UserStatsRadar = {
  upper: number
  lower: number
  force: number
  volume: number
  regularite: number
}

export type UserStatsPayload = {
  radar: ArenaRadarAxis[]
  benchCurve: PowerCurvePoint[]
  weeklySessions: { completed: number; target: number }
}

const EMPTY_WEEK_LABELS = ['S-3', 'S-2', 'S-1', 'Act.'] as const
const WEEKLY_TARGET = 4

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function parseSessionCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n)
}

/**
 * Séances validées dans la semaine locale (lun 00:00 → dim 23:59).
 * Compte chaque note (pas seulement les séries avec poids > 0).
 */
export function countLocalWeekSessions(now = new Date()): number {
  const notes = dedupeWorkoutNotes(getTrainingState().workoutNotes)
  let count = 0
  for (const note of notes) {
    const ms = workoutValidationMs({
      createdAt: note.createdAt,
      dateKey: note.dateKey,
    })
    if (ms != null && isTimestampInLocalWeek(ms, now)) count += 1
  }
  return count
}

function emptyStats(): UserStatsPayload {
  return {
    radar: [
      { label: 'Upper', value: 0 },
      { label: 'Lower', value: 0 },
      { label: 'Force', value: 0 },
      { label: 'Volume', value: 0 },
      { label: RADAR_AXIS_LABELS.regularity, value: 0 },
    ],
    benchCurve: EMPTY_WEEK_LABELS.map((label) => ({ label, valueKg: 0 })),
    weeklySessions: { completed: 0, target: WEEKLY_TARGET },
  }
}

function parseRpcPayload(raw: unknown): UserStatsPayload {
  if (!raw || typeof raw !== 'object') return emptyStats()

  const data = raw as Record<string, unknown>
  const radarRaw = data.radar as Record<string, unknown> | undefined
  const curveRaw = Array.isArray(data.bench_1rm_curve) ? data.bench_1rm_curve : []
  const weeklyRaw = data.weekly_sessions as Record<string, unknown> | undefined

  const radar: ArenaRadarAxis[] = [
    { label: 'Upper', value: clampScore(radarRaw?.upper) },
    { label: 'Lower', value: clampScore(radarRaw?.lower) },
    { label: 'Force', value: clampScore(radarRaw?.force) },
    { label: 'Volume', value: clampScore(radarRaw?.volume) },
    { label: RADAR_AXIS_LABELS.regularity, value: clampScore(radarRaw?.regularite) },
  ]

  const benchCurve: PowerCurvePoint[] =
    curveRaw.length > 0
      ? curveRaw.map((point, index) => {
          const row = point as Record<string, unknown>
          const valueKg = Number(row.value_kg)
          return {
            label: typeof row.label === 'string' ? row.label : EMPTY_WEEK_LABELS[index] ?? `S${index}`,
            valueKg: Number.isFinite(valueKg) ? Math.round(valueKg * 10) / 10 : 0,
          }
        })
      : emptyStats().benchCurve

  const rpcCompleted = parseSessionCount(weeklyRaw?.completed)
  const targetRaw = Number(weeklyRaw?.target)
  const target =
    Number.isFinite(targetRaw) && targetRaw > 0 ? Math.round(targetRaw) : WEEKLY_TARGET

  const localCompleted = countLocalWeekSessions()
  const completed = Math.max(rpcCompleted, localCompleted)

  return {
    radar,
    benchCurve,
    weeklySessions: { completed, target },
  }
}

export async function fetchUserStats(userId: string): Promise<UserStatsPayload> {
  const localCompleted = countLocalWeekSessions()

  if (!userId || !isSupabaseConfigured()) {
    return {
      ...emptyStats(),
      weeklySessions: { completed: localCompleted, target: WEEKLY_TARGET },
    }
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: userId })

    if (error) {
      safeError('[userStats] get_user_stats failed', error.message)
      return {
        ...emptyStats(),
        weeklySessions: { completed: localCompleted, target: WEEKLY_TARGET },
      }
    }

    const parsed = parseRpcPayload(data)
    return {
      ...parsed,
      weeklySessions: {
        completed: Math.max(parsed.weeklySessions.completed, localCompleted),
        target: parsed.weeklySessions.target || WEEKLY_TARGET,
      },
    }
  } catch (err) {
    safeError('[userStats] fetchUserStats', err)
    return {
      ...emptyStats(),
      weeklySessions: { completed: localCompleted, target: WEEKLY_TARGET },
    }
  }
}
