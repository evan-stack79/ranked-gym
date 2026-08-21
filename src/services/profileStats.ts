import type { WorkoutNote } from '../types/training'
import { dedupeWorkoutNotes } from '../utils/workoutHistory'
import { getTrainingState } from './trainingStorage'
import { getPinnedPr } from './profileStorage'
import { countCheckins } from './checkinService'
import { isSupabaseConfigured } from '../lib/supabase'

export type ExercisePr = {
  exerciseName: string
  weightKg: number
}

export type ProfileAchievementId =
  | 'early_bird'
  | 'consistency'
  | 'centurion'
  | 'pr_hunter'

export type ProfileStatsSnapshot = {
  streakDays: number
  /** Workouts (notes) + check-ins Lobby. */
  sessionCount: number
  workoutCount: number
  checkinCount: number
  /** Activité relative des 10 dernières semaines (sparkline). */
  sparkPoints: number[]
  /** Meilleurs poids par exercice (triés desc). */
  bestPrs: ExercisePr[]
  /** PR affiché en vitrine. */
  pinnedPr: ExercisePr | null
  unlocked: Record<ProfileAchievementId, boolean>
}

function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Meilleur poids touché pour chaque exercice (toutes séances). */
export function collectBestPrs(notes: WorkoutNote[] = dedupeWorkoutNotes(getTrainingState().workoutNotes)): ExercisePr[] {
  const map = new Map<string, number>()
  for (const note of notes) {
    for (const exercise of note.exercises ?? []) {
      const name = normalizeExerciseName(exercise.name || '')
      if (!name) continue
      let best = 0
      for (const set of exercise.sets ?? []) {
        if (typeof set.weightKg === 'number' && set.weightKg > best) best = set.weightKg
      }
      if (best <= 0) continue
      const prev = map.get(name) ?? 0
      if (best > prev) map.set(name, best)
    }
  }
  return [...map.entries()]
    .map(([exerciseName, weightKg]) => ({ exerciseName, weightKg }))
    .sort((a, b) => b.weightKg - a.weightKg || a.exerciseName.localeCompare(b.exerciseName, 'fr'))
}

function weekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildSparkPoints(notes: WorkoutNote[], weeks = 10): number[] {
  const now = new Date()
  const buckets: number[] = Array.from({ length: weeks }, () => 0)
  const weekStarts: string[] = []
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    weekStarts.push(weekKey(`${y}-${m}-${day}`))
  }
  const index = new Map(weekStarts.map((k, i) => [k, i]))
  for (const note of notes) {
    const key = weekKey(note.dateKey)
    const idx = index.get(key)
    if (idx != null) buckets[idx] += 1
  }
  return buckets
}

function hasEarlyBirdSession(notes: WorkoutNote[]): boolean {
  return notes.some((note) => {
    const hour = new Date(note.createdAt).getHours()
    return hour < 6
  })
}

function resolvePinnedPr(bestPrs: ExercisePr[]): ExercisePr | null {
  const pinned = getPinnedPr()
  if (pinned?.exerciseName) {
    const match = bestPrs.find(
      (p) => p.exerciseName.toLowerCase() === pinned.exerciseName.toLowerCase(),
    )
    if (match) return match
    if (pinned.weightKg > 0) return pinned
  }
  return bestPrs[0] ?? null
}

/**
 * Agrège streak profil, séances (workouts + checkins) et PRs locaux (sync cloud).
 */
export async function loadProfileStats(input: {
  userId?: string | null
  streakDays: number
}): Promise<ProfileStatsSnapshot> {
  const notes = dedupeWorkoutNotes(getTrainingState().workoutNotes)
  const workoutCount = notes.length
  let checkinCount = 0
  if (input.userId && isSupabaseConfigured()) {
    try {
      checkinCount = await countCheckins(input.userId)
    } catch {
      checkinCount = 0
    }
  }

  const sessionCount = workoutCount + checkinCount
  const bestPrs = collectBestPrs(notes)
  const pinnedPr = resolvePinnedPr(bestPrs)
  const streakDays = Math.max(0, Math.floor(input.streakDays || 0))

  return {
    streakDays,
    sessionCount,
    workoutCount,
    checkinCount,
    sparkPoints: buildSparkPoints(notes),
    bestPrs,
    pinnedPr,
    unlocked: {
      early_bird: hasEarlyBirdSession(notes),
      consistency: streakDays >= 7,
      centurion: sessionCount >= 100,
      pr_hunter: bestPrs.length >= 3,
    },
  }
}
