import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { safeError } from '../utils/safeLog'
import type { ArenaRadarAxis } from '../components/profile/charts/ArenaRadarChart'
import type { PowerCurvePoint } from '../components/profile/charts/PowerCurveChart'
import { RADAR_AXIS_LABELS } from '../constants/radarLabels'

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

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
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
    weeklySessions: { completed: 0, target: 4 },
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

  const completed = clampScore(weeklyRaw?.completed)
  const targetRaw = Number(weeklyRaw?.target)
  const target = Number.isFinite(targetRaw) && targetRaw > 0 ? Math.round(targetRaw) : 4

  return {
    radar,
    benchCurve,
    weeklySessions: { completed, target },
  }
}

export async function fetchUserStats(userId: string): Promise<UserStatsPayload> {
  if (!userId || !isSupabaseConfigured()) {
    return emptyStats()
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: userId })

    if (error) {
      safeError('[userStats] get_user_stats failed', error.message)
      return emptyStats()
    }

    return parseRpcPayload(data)
  } catch (err) {
    safeError('[userStats] fetchUserStats', err)
    return emptyStats()
  }
}
