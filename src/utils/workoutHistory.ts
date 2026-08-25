import type { WorkoutNote } from '../types/training'
import { todayKey } from './calories'
import { exercisesVolume, estimateSessionDurationMin } from './strength'

export type HistoryDayGroup = {
  dateKey: string
  label: string
  sessions: WorkoutNote[]
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function formatHistoryDayLabel(dateKey: string, now = new Date()): string {
  const today = todayKey(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = todayKey(yesterdayDate)

  if (dateKey === today) return 'Aujourd’hui'
  if (dateKey === yesterday) return 'Hier'

  const date = parseDateKey(dateKey)
  const raw = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })
  // "18 août" → "18 Août"
  return raw.replace(/^(\d+\s+)(.)/, (_, day: string, first: string) => day + first.toUpperCase())
}

export function noteDurationMin(note: WorkoutNote): number {
  if (note.durationMin != null && note.durationMin > 0) return note.durationMin
  return estimateSessionDurationMin(note.exercises)
}

export function noteVolumeKg(note: WorkoutNote): number {
  if (note.totalVolumeKg != null && note.totalVolumeKg > 0) return note.totalVolumeKg
  return exercisesVolume(note.exercises)
}

/**
 * Keep real athlete sessions only:
 * - must have at least one exercise with sets
 * - drop near-identical duplicates (same focus + day + volume within 2 min)
 */
export function dedupeWorkoutNotes(notes: WorkoutNote[]): WorkoutNote[] {
  const sorted = [...notes]
    .filter((n) => n.exercises?.some((e) => e.sets?.length > 0))
    .sort((a, b) => b.createdAt - a.createdAt)

  const kept: WorkoutNote[] = []
  for (const note of sorted) {
    const vol = noteVolumeKg(note)
    const isDup = kept.some((k) => {
      if (k.dateKey !== note.dateKey) return false
      if ((k.routineId ?? '') !== (note.routineId ?? '')) return false
      if (Math.abs(noteVolumeKg(k) - vol) > 5) return false
      return Math.abs(k.createdAt - note.createdAt) < 120_000
    })
    if (!isDup) kept.push(note)
  }
  return kept
}

export function groupNotesByDate(notes: WorkoutNote[]): HistoryDayGroup[] {
  const clean = dedupeWorkoutNotes(notes)
  const map = new Map<string, WorkoutNote[]>()
  for (const note of clean) {
    const list = map.get(note.dateKey) ?? []
    list.push(note)
    map.set(note.dateKey, list)
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dateKey, sessions]) => ({
      dateKey,
      label: formatHistoryDayLabel(dateKey),
      sessions: sessions.sort((a, b) => b.createdAt - a.createdAt),
    }))
}

export function formatClock(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const DIFF_LABELS: Record<string, string> = {
  easy: 'Facile',
  ok: 'OK',
  hard: 'Dur',
}

/**
 * Dernière performance connue pour un exercice (historique informatif).
 * Ne prescrit aucune charge — lecture seule pour le carnet.
 */
export function findLastExerciseSets(
  history: WorkoutNote[],
  exerciseName: string,
): { dateKey: string; sets: WorkoutNote['exercises'][number]['sets'] } | null {
  const needle = exerciseName.trim().toLowerCase()
  if (!needle) return null

  const notes = dedupeWorkoutNotes(history)
  for (const note of notes) {
    for (const ex of note.exercises) {
      if (ex.name.trim().toLowerCase() === needle && ex.sets.length > 0) {
        return { dateKey: note.dateKey, sets: ex.sets }
      }
    }
  }
  return null
}

export function formatSetLoadLabel(weightKg: number, reps: number): string {
  const w = Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1).replace(/\.0$/, '')
  return `${w} kg × ${reps}`
}
