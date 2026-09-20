import type { SessionKind, SetDifficulty, WorkoutNote, WorkoutSet } from '../types/training'
import { resolveSessionKind } from './trainHub'
import {
  DIFF_LABELS,
  formatHistoryDateTimeLine,
  formatKgValue,
  noteDurationMin,
  noteVolumeKg,
} from './workoutHistory'

export const MISSING_VALUE = '—'

export type HistorySessionMetrics = {
  kind: SessionKind
  duration: number | null
  volume: number | null
  kcal: number | null
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** Métriques affichables — jamais NaN / 0 kg / énergie fictive à 0. */
export function historySessionMetrics(note: WorkoutNote): HistorySessionMetrics {
  const kind = resolveSessionKind(note)
  // Le fallback par séries reste réservé aux anciennes séances de force.
  // Pour les autres sports, seule une durée réellement enregistrée est affichée.
  const durationRaw = kind === 'strength' ? noteDurationMin(note) : note.durationMin
  const duration = isFinitePositive(durationRaw) ? durationRaw : null
  const volumeRaw = noteVolumeKg(note)
  // Volume kg uniquement pour la force avec charge réelle.
  const volume =
    kind === 'strength' && isFinitePositive(volumeRaw) ? Math.round(volumeRaw) : null
  // kcal : uniquement si > 0 et fini — pas d’énergie fictive (0 / NaN).
  const kcal = isFinitePositive(note.estimatedKcal) ? Math.round(note.estimatedKcal) : null
  return { kind, duration, volume, kcal }
}

export function formatHistoryDetailDateLine(
  note: Pick<WorkoutNote, 'dateKey' | 'createdAt'>,
  now = new Date(),
): string {
  return formatHistoryDateTimeLine(note, now)
}

export function formatHistoryDetailMetric(
  kind: 'duration' | 'volume' | 'kcal',
  value: number | null,
): string {
  if (value == null) return MISSING_VALUE
  if (kind === 'duration') return `${value} min`
  if (kind === 'volume') return `${value.toLocaleString('fr-FR')} kg`
  return `${value} kcal`
}

export function formatSetWeightLabel(kind: SessionKind, weightKg: unknown): string {
  if (kind !== 'strength') return MISSING_VALUE
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
    return MISSING_VALUE
  }
  return `${formatKgValue(weightKg)} kg`
}

export function formatSetRepsLabel(kind: SessionKind, reps: unknown): string {
  // Endurance / team / generic : les « reps » legacy sont souvent une durée, pas des répétitions.
  if (kind !== 'strength') return MISSING_VALUE
  if (typeof reps !== 'number' || !Number.isFinite(reps) || reps <= 0) return MISSING_VALUE
  return String(reps)
}

export function formatSetEffortLabel(
  kind: SessionKind,
  set: Pick<WorkoutSet, 'difficulty' | 'rpe'>,
): string {
  const difficulty = set.difficulty
  // Non-force : difficulty='ok' est souvent auto-injecté à la saisie — ne pas l’afficher.
  const showDifficulty =
    difficulty != null && (kind === 'strength' || difficulty === 'easy' || difficulty === 'hard')
  if (showDifficulty) {
    return DIFF_LABELS[difficulty as SetDifficulty] ?? MISSING_VALUE
  }
  if (typeof set.rpe === 'number' && Number.isFinite(set.rpe) && set.rpe > 0) {
    return `${set.rpe}/10`
  }
  return MISSING_VALUE
}
