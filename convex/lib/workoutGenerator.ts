export type WorkoutMovement = 'push' | 'pull' | 'legs' | 'core' | 'shoulders' | 'arms'

export type CatalogExercise = {
  id: string
  name: string
  movement: WorkoutMovement
  defaultSets: number
  defaultReps: number
  restSec: number
}

export type GeneratedExercise = {
  exerciseId: string
  name: string
  sets: number
  reps: number
  restSec: number
  order: number
}

export type GeneratedWorkoutPlan = {
  title: string
  focus: string
  durationMin: number
  exercises: GeneratedExercise[]
  source: 'ai' | 'deterministic'
}

/** Pool aligné sur `src/data/exerciseCatalog.ts` (ids stables). */
export const WORKOUT_EXERCISE_POOL: CatalogExercise[] = [
  { id: 'bench_press', name: 'Développé couché', movement: 'push', defaultSets: 4, defaultReps: 8, restSec: 120 },
  { id: 'incline_bench_press', name: 'Développé incliné', movement: 'push', defaultSets: 3, defaultReps: 10, restSec: 90 },
  { id: 'dumbbell_bench_press', name: 'Développé haltères', movement: 'push', defaultSets: 3, defaultReps: 10, restSec: 90 },
  { id: 'overhead_press', name: 'Développé militaire', movement: 'shoulders', defaultSets: 3, defaultReps: 8, restSec: 120 },
  { id: 'lateral_raise', name: 'Élévations latérales', movement: 'shoulders', defaultSets: 3, defaultReps: 12, restSec: 60 },
  { id: 'dip', name: 'Dips', movement: 'push', defaultSets: 3, defaultReps: 10, restSec: 90 },
  { id: 'push_up', name: 'Pompe', movement: 'push', defaultSets: 3, defaultReps: 15, restSec: 60 },
  { id: 'pull_up', name: 'Traction', movement: 'pull', defaultSets: 4, defaultReps: 6, restSec: 120 },
  { id: 'lat_pulldown', name: 'Tirage vertical', movement: 'pull', defaultSets: 3, defaultReps: 10, restSec: 90 },
  { id: 'barbell_row', name: 'Rowing barre', movement: 'pull', defaultSets: 4, defaultReps: 8, restSec: 120 },
  { id: 'seated_cable_row', name: 'Rowing poulie', movement: 'pull', defaultSets: 3, defaultReps: 10, restSec: 90 },
  { id: 'face_pull', name: 'Face pull', movement: 'pull', defaultSets: 3, defaultReps: 15, restSec: 60 },
  { id: 'deadlift', name: 'Soulevé de terre', movement: 'pull', defaultSets: 3, defaultReps: 5, restSec: 150 },
  { id: 'back_squat', name: 'Squat', movement: 'legs', defaultSets: 4, defaultReps: 6, restSec: 150 },
  { id: 'leg_press', name: 'Presse à cuisses', movement: 'legs', defaultSets: 3, defaultReps: 10, restSec: 120 },
  { id: 'romanian_deadlift', name: 'Soulevé de terre roumain', movement: 'legs', defaultSets: 3, defaultReps: 8, restSec: 120 },
  { id: 'walking_lunge', name: 'Fentes', movement: 'legs', defaultSets: 3, defaultReps: 10, restSec: 90 },
  { id: 'hip_thrust', name: 'Hip thrust', movement: 'legs', defaultSets: 3, defaultReps: 10, restSec: 90 },
  { id: 'leg_curl', name: 'Curl ischio', movement: 'legs', defaultSets: 3, defaultReps: 12, restSec: 60 },
  { id: 'calf_raise', name: 'Mollets debout', movement: 'legs', defaultSets: 3, defaultReps: 15, restSec: 45 },
  { id: 'barbell_curl', name: 'Curl barre', movement: 'arms', defaultSets: 3, defaultReps: 10, restSec: 60 },
  { id: 'triceps_pushdown', name: 'Extension triceps poulie', movement: 'arms', defaultSets: 3, defaultReps: 12, restSec: 60 },
  { id: 'plank', name: 'Planche', movement: 'core', defaultSets: 3, defaultReps: 45, restSec: 45 },
]

const FOCUS_MOVEMENTS: Array<{ re: RegExp; movements: WorkoutMovement[]; title: string }> = [
  {
    re: /v[\s-]?taper|upper|dos|pull|largeur|lats?/i,
    movements: ['pull', 'shoulders', 'arms'],
    title: 'Upper V-Taper',
  },
  {
    re: /push|pect|chest|bench|couche/i,
    movements: ['push', 'shoulders', 'arms'],
    title: 'Push Upper',
  },
  {
    re: /leg|jambe|squat|lower|fessier/i,
    movements: ['legs', 'core'],
    title: 'Lower Power',
  },
  {
    re: /full|fullbody|tout|full.?body/i,
    movements: ['push', 'pull', 'legs', 'core'],
    title: 'Full Body',
  },
  {
    re: /épaule|shoulder|deltoid/i,
    movements: ['shoulders', 'push', 'arms'],
    title: 'Shoulders',
  },
  {
    re: /bras|arm|biceps|triceps/i,
    movements: ['arms', 'pull', 'push'],
    title: 'Arms Focus',
  },
]

export function clampDurationMin(raw: number): number {
  if (!Number.isFinite(raw)) return 45
  return Math.min(120, Math.max(20, Math.round(raw)))
}

export function resolveFocus(focus: string): { movements: WorkoutMovement[]; title: string; focus: string } {
  const trimmed = focus.trim().slice(0, 80) || 'Upper V-Taper'
  for (const rule of FOCUS_MOVEMENTS) {
    if (rule.re.test(trimmed)) {
      return { movements: rule.movements, title: rule.title, focus: trimmed }
    }
  }
  return { movements: ['pull', 'shoulders', 'arms'], title: trimmed, focus: trimmed }
}

/** Nombre d’exercices ≈ durée (≈ 6–8 min / exo avec repos). */
export function exerciseCountForDuration(durationMin: number): number {
  const n = Math.round(durationMin / 7)
  return Math.min(8, Math.max(4, n))
}

export function buildDeterministicWorkout(input: {
  focus: string
  durationMin: number
}): GeneratedWorkoutPlan {
  const durationMin = clampDurationMin(input.durationMin)
  const resolved = resolveFocus(input.focus)
  const count = exerciseCountForDuration(durationMin)
  const pool = WORKOUT_EXERCISE_POOL.filter((e) => resolved.movements.includes(e.movement))
  const fallback = WORKOUT_EXERCISE_POOL
  const source = pool.length >= 3 ? pool : fallback

  const picked: CatalogExercise[] = []
  for (let i = 0; i < count; i += 1) {
    picked.push(source[i % source.length]!)
  }

  // Déduplique en gardant l’ordre, puis complète si besoin.
  const unique: CatalogExercise[] = []
  const seen = new Set<string>()
  for (const ex of picked) {
    if (seen.has(ex.id)) continue
    seen.add(ex.id)
    unique.push(ex)
  }
  for (const ex of source) {
    if (unique.length >= count) break
    if (seen.has(ex.id)) continue
    seen.add(ex.id)
    unique.push(ex)
  }

  const density = durationMin < 35 ? 0.85 : durationMin > 60 ? 1.1 : 1
  const exercises: GeneratedExercise[] = unique.slice(0, count).map((ex, index) => ({
    exerciseId: ex.id,
    name: ex.name,
    sets: Math.max(2, Math.round(ex.defaultSets * density)),
    reps: ex.defaultReps,
    restSec: ex.restSec,
    order: index + 1,
  }))

  return {
    title: resolved.title,
    focus: resolved.focus,
    durationMin,
    exercises,
    source: 'deterministic',
  }
}

/** Parse une réponse IA JSON → plan ; null si invalide. */
export function parseAiWorkoutPlan(
  raw: string,
  fallback: GeneratedWorkoutPlan,
): GeneratedWorkoutPlan | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
  const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  if (!obj) return null
  const list = Array.isArray(obj.exercises) ? obj.exercises : null
  if (!list || list.length === 0) return null

  const byId = new Map(WORKOUT_EXERCISE_POOL.map((e) => [e.id, e]))
  const exercises: GeneratedExercise[] = []
  for (const item of list) {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
    if (!row) continue
    const exerciseId = typeof row.exerciseId === 'string' ? row.exerciseId : ''
    const catalog = byId.get(exerciseId)
    if (!catalog) continue
    const sets =
      typeof row.sets === 'number' && Number.isFinite(row.sets)
        ? Math.min(6, Math.max(2, Math.round(row.sets)))
        : catalog.defaultSets
    const reps =
      typeof row.reps === 'number' && Number.isFinite(row.reps)
        ? Math.min(30, Math.max(3, Math.round(row.reps)))
        : catalog.defaultReps
    const restSec =
      typeof row.restSec === 'number' && Number.isFinite(row.restSec)
        ? Math.min(240, Math.max(30, Math.round(row.restSec)))
        : catalog.restSec
    exercises.push({
      exerciseId: catalog.id,
      name: catalog.name,
      sets,
      reps,
      restSec,
      order: exercises.length + 1,
    })
  }
  if (exercises.length < 3) return null

  const title =
    typeof obj.title === 'string' && obj.title.trim()
      ? obj.title.trim().slice(0, 80)
      : fallback.title

  return {
    title,
    focus: fallback.focus,
    durationMin: fallback.durationMin,
    exercises: exercises.slice(0, 8),
    source: 'ai',
  }
}

export function buildWorkoutAiSystemPrompt(catalogIds: string[]): string {
  return [
    'Tu es un coach force Ranked Gym. Réponds UNIQUEMENT en JSON valide, sans markdown.',
    'Format exact: {"title":string,"exercises":[{"exerciseId":string,"sets":number,"reps":number,"restSec":number}]}',
    'Utilise uniquement ces exerciseId:',
    catalogIds.join(', '),
    '3 à 8 exercices. Sets 2–6, reps 3–20, restSec 30–180. Ton direct, hypertrophie/force.',
  ].join(' ')
}
