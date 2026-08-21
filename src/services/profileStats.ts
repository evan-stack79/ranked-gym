import type { WorkoutNote } from '../types/training'
import { dedupeWorkoutNotes } from '../utils/workoutHistory'
import { getTrainingState } from './trainingStorage'
import { getPinnedPr } from './profileStorage'
import { countCheckins } from './checkinService'
import { isSupabaseConfigured } from '../lib/supabase'

export type ExercisePr = {
  exerciseName: string
  /** Max historique (kg) — recalculé depuis les logs workouts. */
  weightKg: number
  /** Epoch ms du set/séance où ce max a été touché. */
  achievedAt: number
  /** dateKey YYYY-MM-DD de la séance record. */
  dateKey?: string
}

export type ProfileAchievementId =
  | 'early_bird'
  | 'consistency'
  | 'centurion'
  | 'pr_hunter'

export type ProfileStatsSnapshot = {
  streakDays: number
  sessionCount: number
  workoutCount: number
  checkinCount: number
  sparkPoints: number[]
  bestPrs: ExercisePr[]
  pinnedPr: ExercisePr | null
  unlocked: Record<ProfileAchievementId, boolean>
}

function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function noteTimestamp(note: WorkoutNote): number {
  if (typeof note.createdAt === 'number' && Number.isFinite(note.createdAt)) {
    return note.createdAt
  }
  if (note.dateKey) {
    const [y, m, d] = note.dateKey.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
  }
  return Date.now()
}

/**
 * Meilleur poids historique par exercice, depuis les logs d’entraînement
 * (hydratés depuis Supabase `workouts.state`).
 */
export function collectBestPrs(
  notes: WorkoutNote[] = dedupeWorkoutNotes(getTrainingState().workoutNotes),
): ExercisePr[] {
  const map = new Map<string, ExercisePr>()

  for (const note of notes) {
    const at = noteTimestamp(note)
    for (const exercise of note.exercises ?? []) {
      const name = normalizeExerciseName(exercise.name || '')
      if (!name) continue
      let bestInSession = 0
      for (const set of exercise.sets ?? []) {
        if (typeof set.weightKg === 'number' && set.weightKg > bestInSession) {
          bestInSession = set.weightKg
        }
      }
      if (bestInSession <= 0) continue

      const prev = map.get(name.toLowerCase())
      if (!prev || bestInSession > prev.weightKg) {
        map.set(name.toLowerCase(), {
          exerciseName: name,
          weightKg: bestInSession,
          achievedAt: at,
          dateKey: note.dateKey,
        })
      } else if (bestInSession === prev.weightKg && at > prev.achievedAt) {
        // Même poids : garder la date la plus récente
        map.set(name.toLowerCase(), {
          ...prev,
          exerciseName: name,
          achievedAt: at,
          dateKey: note.dateKey,
        })
      }
    }
  }

  // Aussi les routines sauvegardées (dernier état connu)
  for (const routine of getTrainingState().routines ?? []) {
    for (const exercise of routine.exercises ?? []) {
      const name = normalizeExerciseName(exercise.name || '')
      if (!name) continue
      let best = 0
      for (const set of exercise.sets ?? []) {
        if (typeof set.weightKg === 'number' && set.weightKg > best) best = set.weightKg
      }
      if (best <= 0) continue
      const key = name.toLowerCase()
      const prev = map.get(key)
      if (!prev || best > prev.weightKg) {
        map.set(key, {
          exerciseName: name,
          weightKg: best,
          achievedAt: routine.updatedAt || Date.now(),
        })
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => b.weightKg - a.weightKg || a.exerciseName.localeCompare(b.exerciseName, 'fr'),
  )
}

/** Libellé relatif FR pour le badge « Battu il y a… ». */
export function formatPrAgeLabel(achievedAt: number, now = Date.now()): string {
  if (!Number.isFinite(achievedAt) || achievedAt <= 0) return 'Record enregistré'
  const days = Math.max(0, Math.floor((now - achievedAt) / 86_400_000))
  if (days <= 0) return 'Battu aujourd’hui'
  if (days === 1) return 'Battu hier'
  if (days < 7) return `Battu il y a ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'Battu il y a 1 semaine'
  if (weeks < 5) return `Battu il y a ${weeks} semaines`
  const months = Math.floor(days / 30)
  if (months <= 1) return 'Battu il y a 1 mois'
  if (months < 12) return `Battu il y a ${months} mois`
  const years = Math.floor(days / 365)
  return years <= 1 ? 'Battu il y a 1 an' : `Battu il y a ${years} ans`
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
  return notes.some((note) => new Date(note.createdAt).getHours() < 6)
}

/**
 * Résout le PR épinglé : favori choisi → max live depuis les logs.
 * Sinon premier PR dispo. Jamais de valeur figée obsolète.
 */
export function resolvePinnedPr(bestPrs: ExercisePr[]): ExercisePr | null {
  const pinned = getPinnedPr()
  if (pinned?.exerciseName) {
    const match = bestPrs.find(
      (p) => p.exerciseName.toLowerCase() === pinned.exerciseName.toLowerCase(),
    )
    if (match) return match
    // Favori choisi mais plus de logs → aucun PR affichable
    return null
  }
  return bestPrs[0] ?? null
}

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
