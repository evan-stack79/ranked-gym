import type {
  CompletedSession,
  ScheduledSession,
  SessionTemplate,
  TrainingState,
  WorkoutNote,
  WorkoutRoutine,
  ExerciseEntry,
  ActiveWorkoutDraft,
  SessionKind,
} from '../types/training'
import { todayKey } from '../utils/calories'
import { getCalorieProfile } from './nutritionStorage'
import {
  computeStrengthSessionStats,
  sessionIntensity,
  strengthSessionKcal,
} from '../utils/strength'
import { getActiveCloudUserId } from './cloudSession'
import { sessionKindForSport } from '../utils/sessionMeta'
import {
  ensureDraftClock,
  pauseDraftClock,
  resolvedDurationMin,
  resumeDraftClock,
} from '../utils/sessionClock'
import { normalizePersistedRestTimer } from '../utils/restTimerPersist'

const KEY_BASE = 'ranked-gym:training'

export type StorageSaveOptions = { skipCloud?: boolean }

function triggerCloudBackup() {
  void import('./cloudBackup').then((m) => m.notifyLocalDataChanged())
}

function storageKey(): string {
  const uid = getActiveCloudUserId()
  return uid ? `${KEY_BASE}:u:${uid}` : KEY_BASE
}

/** Portée active (guest vs compte) — pour hydratation rest timer / anti-fuite. */
export function getTrainingStorageScope(): string {
  return storageKey()
}

export const DEFAULT_TEMPLATES: SessionTemplate[] = [
  {
    id: 'tpl-upper',
    kind: 'upper',
    title: 'Upper',
    subtitle: 'Haut du corps',
    muscles: ['Pectoraux', 'Dos', 'Épaules', 'Bras'],
    accent: '#FF2B2B',
  },
  {
    id: 'tpl-lower',
    kind: 'lower',
    title: 'Lower',
    subtitle: 'Bas du corps',
    muscles: ['Quadriceps', 'Ischios', 'Fessiers', 'Mollets'],
    accent: '#00B4FF',
  },
  {
    id: 'tpl-push',
    kind: 'push',
    title: 'Push',
    subtitle: 'Poussée',
    muscles: ['Pectoraux', 'Épaules', 'Triceps'],
    accent: '#FF9F0A',
  },
  {
    id: 'tpl-pull',
    kind: 'pull',
    title: 'Pull',
    subtitle: 'Tirage',
    muscles: ['Dos', 'Biceps', 'Arrière d’épaule'],
    accent: '#BF5AF2',
  },
  {
    id: 'tpl-legs',
    kind: 'legs',
    title: 'Legs',
    subtitle: 'Jambes complètes',
    muscles: ['Quads', 'Ischios', 'Fessiers'],
    accent: '#30D158',
  },
  {
    id: 'tpl-full',
    kind: 'full_body',
    title: 'Full body',
    subtitle: 'Corps entier',
    muscles: ['Tout le corps'],
    accent: '#64D2FF',
  },
]

export const DEFAULT_ROUTINES: WorkoutRoutine[] = [
  { id: 'upper', label: 'Upper', subtitle: 'Haut du corps', accent: '#FF2B2B', exercises: [], updatedAt: 0 },
  { id: 'lower', label: 'Lower', subtitle: 'Bas du corps', accent: '#00B4FF', exercises: [], updatedAt: 0 },
  { id: 'push', label: 'Push', subtitle: 'Poussée', accent: '#FF9F0A', exercises: [], updatedAt: 0 },
  { id: 'pull', label: 'Pull', subtitle: 'Tirage', accent: '#BF5AF2', exercises: [], updatedAt: 0 },
  { id: 'legs', label: 'Jambes', subtitle: 'Lower focus', accent: '#30D158', exercises: [], updatedAt: 0 },
  { id: 'pecs', label: 'Pecs', subtitle: 'Pectoraux', accent: '#FF453A', exercises: [], updatedAt: 0 },
  { id: 'dos', label: 'Dos', subtitle: 'Tirage / row', accent: '#64D2FF', exercises: [], updatedAt: 0 },
  { id: 'shoulders', label: 'Épaules', subtitle: 'Deltoïdes', accent: '#FF9F0A', exercises: [], updatedAt: 0 },
  { id: 'arms', label: 'Bras', subtitle: 'Biceps / triceps', accent: '#BF5AF2', exercises: [], updatedAt: 0 },
  { id: 'full', label: 'Full body', subtitle: 'Tout le corps', accent: '#30D158', exercises: [], updatedAt: 0 },
]

function mergeRoutines(stored?: WorkoutRoutine[]): WorkoutRoutine[] {
  const byId = new Map((stored ?? []).map((r) => [r.id, r]))
  const merged = DEFAULT_ROUTINES.map((def) => {
    const existing = byId.get(def.id)
    if (!existing) return { ...def }
    byId.delete(def.id)
    return {
      ...def,
      ...existing,
      label: existing.label || def.label,
      subtitle: existing.subtitle || def.subtitle,
      accent: existing.accent || def.accent,
      exercises: existing.exercises ?? [],
    }
  })
  // keep user-created customs
  for (const extra of byId.values()) {
    merged.push(extra)
  }
  return merged
}

const DEFAULT_STATE: TrainingState = {
  primarySportId: 'musculation',
  favoriteSportIds: ['musculation'],
  stepsToday: 0,
  stepsDateKey: todayKey(),
  healthLinked: false,
  notificationsEnabled: false,
  templates: DEFAULT_TEMPLATES,
  schedule: [],
  completed: [],
  workoutNotes: [],
  routines: DEFAULT_ROUTINES.map((r) => ({ ...r })),
  lastSelectedRoutineId: null,
  lastSelectedSportId: null,
  activeWorkoutDraft: null,
}

function cloneExercises(exercises: ExerciseEntry[]): ExerciseEntry[] {
  return exercises.map((e) => ({
    ...e,
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sets: e.sets.map((s) => ({ ...s })),
  }))
}

/**
 * Marqueurs transitoires de séance en cours (done / restSec).
 * Nettoyés atomiquement à la fin d’une séance pour ne jamais réafficher « Reprendre ».
 */
export function stripTransientSetMarkers(exercises: ExerciseEntry[]): ExerciseEntry[] {
  return exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => {
      const { done: _done, restSec: _rest, ...rest } = s
      return { ...rest }
    }),
  }))
}

/** IDs persistés : ignore non-string / vide / trop long / caractères de contrôle. */
export function sanitizeStoredId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 128) return null
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null
  return trimmed
}

function isSessionKind(value: unknown): value is SessionKind {
  return value === 'strength' || value === 'endurance' || value === 'team' || value === 'generic'
}

/** Validation stricte du marqueur additif ; une donnée legacy ambiguë reste inactive. */
export function normalizeActiveWorkoutDraft(
  value: unknown,
  routines: WorkoutRoutine[],
): ActiveWorkoutDraft | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<ActiveWorkoutDraft>
  const routineId = sanitizeStoredId(raw.routineId)
  const sportId = sanitizeStoredId(raw.sportId)
  if (!routineId || !sportId || !routines.some((routine) => routine.id === routineId)) return null
  if (!Number.isFinite(raw.startedAt) || !Number.isFinite(raw.updatedAt)) return null
  if ((raw.startedAt ?? 0) <= 0 || (raw.updatedAt ?? 0) <= 0) return null

  const draft: ActiveWorkoutDraft = {
    routineId,
    sportId,
    startedAt: raw.startedAt as number,
    updatedAt: raw.updatedAt as number,
  }

  if (Number.isFinite(raw.elapsedActiveMs) && (raw.elapsedActiveMs as number) >= 0) {
    draft.elapsedActiveMs = raw.elapsedActiveMs as number
  }
  if (raw.runningSince === null) {
    draft.runningSince = null
  } else if (Number.isFinite(raw.runningSince) && (raw.runningSince as number) > 0) {
    draft.runningSince = raw.runningSince as number
  }
  if (raw.paused === true) draft.paused = true
  else if (raw.paused === false) draft.paused = false
  if (Number.isFinite(raw.estimatedElapsedMs) && (raw.estimatedElapsedMs as number) >= 0) {
    draft.estimatedElapsedMs = raw.estimatedElapsedMs as number
  }

  if (raw.restTimer === null) {
    draft.restTimer = null
  } else {
    const rest = normalizePersistedRestTimer(raw.restTimer)
    if (rest) draft.restTimer = rest
  }

  return draft
}

function normalizeScheduleEntry<T extends Omit<ScheduledSession, 'id'> & { id?: string }>(
  entry: T,
): T {
  const sportId = sanitizeStoredId(entry.sportId)
  const sessionKind = sportId
    ? sessionKindForSport(sportId)
    : isSessionKind(entry.sessionKind)
      ? entry.sessionKind
      : undefined
  return {
    ...entry,
    ...(sportId ? { sportId, sessionKind } : {}),
  }
}

function read(): TrainingState {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) {
      return {
        ...DEFAULT_STATE,
        templates: [...DEFAULT_TEMPLATES],
        routines: DEFAULT_ROUTINES.map((r) => ({ ...r })),
      }
    }
    const parsed = JSON.parse(raw) as Partial<TrainingState>
    const routines = mergeRoutines(parsed.routines)
    const merged: TrainingState = {
      ...DEFAULT_STATE,
      ...parsed,
      primarySportId: parsed.primarySportId || 'musculation',
      templates:
        parsed.templates && parsed.templates.length > 0
          ? parsed.templates
          : [...DEFAULT_TEMPLATES],
      schedule: parsed.schedule ?? [],
      completed: parsed.completed ?? [],
      favoriteSportIds:
        parsed.favoriteSportIds && parsed.favoriteSportIds.length > 0
          ? parsed.favoriteSportIds
          : ['musculation'],
      workoutNotes: parsed.workoutNotes ?? [],
      routines,
      notificationsEnabled: Boolean(parsed.notificationsEnabled),
      lastSelectedRoutineId: sanitizeStoredId(parsed.lastSelectedRoutineId),
      lastSelectedSportId: sanitizeStoredId(parsed.lastSelectedSportId),
      activeWorkoutDraft: normalizeActiveWorkoutDraft(parsed.activeWorkoutDraft, routines),
    }
    if (merged.stepsDateKey !== todayKey()) {
      merged.stepsToday = 0
      merged.stepsDateKey = todayKey()
    }
    return merged
  } catch {
    return {
      ...DEFAULT_STATE,
      templates: [...DEFAULT_TEMPLATES],
      routines: DEFAULT_ROUTINES.map((r) => ({ ...r })),
    }
  }
}

function emitTrainingPersistError(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Erreur de sauvegarde locale'
  const target =
    typeof globalThis !== 'undefined'
      ? (globalThis as typeof globalThis & {
          dispatchEvent?: (event: Event) => boolean
        })
      : null
  if (target && typeof target.dispatchEvent === 'function') {
    target.dispatchEvent(
      new CustomEvent('ranked-gym:training-persist-error', {
        detail: { error: message },
      }),
    )
  }
}

function write(state: TrainingState, opts?: StorageSaveOptions): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state))
  } catch (error) {
    emitTrainingPersistError(error)
    throw error
  }
  if (!opts?.skipCloud) triggerCloudBackup()
  const target =
    typeof globalThis !== 'undefined'
      ? (globalThis as typeof globalThis & {
          dispatchEvent?: (event: Event) => boolean
        })
      : null
  if (target && typeof target.dispatchEvent === 'function') {
    target.dispatchEvent(new Event('ranked-gym:training-changed'))
  }
}

export function getTrainingState(): TrainingState {
  return read()
}

export function saveTrainingState(state: TrainingState, opts?: StorageSaveOptions): void {
  write(state, opts)
}

/**
 * Persiste immédiatement la routine active du carnet (reprise type YouTube).
 * Ne dépend pas de visibilitychange / pagehide / fermeture — appelée au moment du changement.
 */
export function setLastSelectedRoutine(
  routineId: string,
  sportId?: string | null,
  opts?: StorageSaveOptions,
): TrainingState {
  const state = read()
  const id = sanitizeStoredId(routineId)
  if (!id) return state
  const nextSport =
    sanitizeStoredId(sportId) ??
    sanitizeStoredId(state.primarySportId) ??
    state.lastSelectedSportId
  if (state.lastSelectedRoutineId === id && state.lastSelectedSportId === nextSport) {
    return state
  }
  const next: TrainingState = {
    ...state,
    lastSelectedRoutineId: id,
    lastSelectedSportId: nextSport,
  }
  write(next, opts)
  return next
}

/**
 * Résout la routine à reprendre au montage :
 * launch → dernière sélection valide (même sport + ID présent) → premier candidat.
 */
export function resolveResumedRoutineId(input: {
  routines: { id: string }[]
  /** Sous-ensemble visible (split programme) ; sinon toutes les routines. */
  candidateIds?: string[]
  sportId?: string | null
  launchRoutineId?: string | null
  state?: TrainingState
}): string | null {
  const state = input.state ?? read()
  const pool =
    input.candidateIds && input.candidateIds.length > 0
      ? input.routines.filter((r) => input.candidateIds!.includes(r.id))
      : input.routines
  const ids = new Set(pool.map((r) => r.id))

  const launch = sanitizeStoredId(input.launchRoutineId)
  if (launch && ids.has(launch)) return launch

  const preferred = sanitizeStoredId(state.lastSelectedRoutineId)
  const storedSport = sanitizeStoredId(state.lastSelectedSportId)
  const currentSport = sanitizeStoredId(input.sportId ?? state.primarySportId)
  const sportOk = !preferred || !storedSport || !currentSport || storedSport === currentSport

  if (preferred && sportOk && ids.has(preferred)) return preferred

  return pool[0]?.id ?? null
}

export function setPrimarySport(sportId: string): TrainingState {
  const state = read()
  const favorites = state.favoriteSportIds.includes(sportId)
    ? state.favoriteSportIds
    : [sportId, ...state.favoriteSportIds].slice(0, 8)
  const sportChanged = state.primarySportId !== sportId
  const next: TrainingState = {
    ...state,
    primarySportId: sportId,
    favoriteSportIds: favorites,
    // Évite de reprendre une routine du sport précédent.
    ...(sportChanged
      ? { lastSelectedRoutineId: null, lastSelectedSportId: null }
      : {}),
  }
  write(next)
  return next
}

export function setStepsToday(steps: number): TrainingState {
  const state = read()
  const next = {
    ...state,
    stepsToday: Math.max(0, Math.round(steps)),
    stepsDateKey: todayKey(),
  }
  write(next)
  return next
}

export function setHealthLinked(linked: boolean): TrainingState {
  const state = read()
  const next = { ...state, healthLinked: linked }
  write(next)
  return next
}

export function setNotificationsEnabled(enabled: boolean): TrainingState {
  const state = read()
  const next = { ...state, notificationsEnabled: enabled }
  write(next)
  return next
}

export function addCustomTemplate(input: {
  title: string
  muscles: string[]
  accent?: string
}): TrainingState {
  const state = read()
  const tpl: SessionTemplate = {
    id: `tpl-custom-${Date.now()}`,
    kind: 'custom',
    title: input.title.trim() || 'Séance custom',
    subtitle: 'Ciblage musculaire',
    muscles: input.muscles.length ? input.muscles : ['Personnalisé'],
    accent: input.accent ?? '#FF2B2B',
  }
  const next = { ...state, templates: [tpl, ...state.templates] }
  write(next)
  return next
}

export function upsertSchedule(
  entry: Omit<ScheduledSession, 'id'> & { id?: string },
): TrainingState {
  const state = read()
  const normalized = normalizeScheduleEntry(entry)
  if (normalized.id) {
    const next = {
      ...state,
      schedule: state.schedule.map((s) =>
        s.id === normalized.id ? { ...s, ...normalized, id: normalized.id } : s,
      ),
    }
    write(next)
    return next
  }
  const created: ScheduledSession = {
    id: `sch-${Date.now()}`,
    templateId: normalized.templateId || 'notebook',
    title: normalized.title,
    days: normalized.days,
    time: normalized.time,
    enabled: normalized.enabled,
    remindBeforeMin: normalized.remindBeforeMin ?? 10,
    ...(normalized.sportId
      ? { sportId: normalized.sportId, sessionKind: normalized.sessionKind }
      : {}),
  }
  const next = { ...state, schedule: [...state.schedule, created] }
  write(next)
  return next
}

export function removeSchedule(id: string): TrainingState {
  const state = read()
  const next = { ...state, schedule: state.schedule.filter((s) => s.id !== id) }
  write(next)
  return next
}

export function logCompletedSession(input: {
  templateId: string
  title: string
  durationMin: number
  estimatedKcal: number
}): TrainingState {
  const state = read()
  const entry: CompletedSession = {
    id: `done-${Date.now()}`,
    templateId: input.templateId,
    title: input.title,
    dateKey: todayKey(),
    durationMin: input.durationMin,
    estimatedKcal: input.estimatedKcal,
    createdAt: Date.now(),
  }
  const next = { ...state, completed: [entry, ...state.completed].slice(0, 60) }
  write(next)
  return next
}

export function saveWorkoutNote(
  note: Omit<WorkoutNote, 'id' | 'createdAt' | 'dateKey'> & {
    id?: string
    createdAt?: number
    dateKey?: string
  },
): TrainingState {
  const state = read()
  const existing = note.id ? state.workoutNotes.find((n) => n.id === note.id) : undefined
  const bodyWeightKg = getCalorieProfile().weightKg
  const isLift = note.exercises.some((e) => e.sets.some((s) => s.weightKg > 0))
  const stats = computeStrengthSessionStats(note.exercises, bodyWeightKg)

  let durationMin: number
  let totalVolumeKg: number
  let estimatedKcal: number

  if (isLift) {
    // Durée réelle chronométrée prioritaire sur l’estimation par séries.
    const activeDraft = state.activeWorkoutDraft
    const liveMin =
      note.durationMin && note.durationMin > 0
        ? note.durationMin
        : activeDraft && activeDraft.routineId === (note.routineId ?? activeDraft.routineId)
          ? resolvedDurationMin(activeDraft)
          : 0
    durationMin = liveMin > 0 ? liveMin : stats.durationMin
    totalVolumeKg = stats.volume
    estimatedKcal = strengthSessionKcal(
      bodyWeightKg,
      durationMin,
      sessionIntensity(note.exercises),
    )
  } else {
    // Les modules endurance/team fournissent leurs mesures réelles. Une valeur
    // absente reste inconnue au lieu d'être déduite des répétitions de série.
    durationMin = note.durationMin && note.durationMin > 0 ? note.durationMin : 0
    totalVolumeKg = 0
    estimatedKcal = note.estimatedKcal > 0 ? note.estimatedKcal : 0
  }

  const entry: WorkoutNote = {
    id: note.id ?? `note-${Date.now()}`,
    title: note.title,
    exercises: note.exercises,
    estimatedKcal,
    durationMin,
    totalVolumeKg,
    routineId: note.routineId ?? existing?.routineId,
    dateKey: note.dateKey ?? existing?.dateKey ?? todayKey(),
    createdAt: note.createdAt ?? existing?.createdAt ?? Date.now(),
    // Métadonnées multisport additives — jamais inventées pour les notes legacy.
    sportId: note.sportId ?? existing?.sportId,
    sessionKind: note.sessionKind ?? existing?.sessionKind,
    source: note.source ?? existing?.source,
    details: note.details ?? existing?.details,
  }
  const workoutNotes = [entry, ...state.workoutNotes.filter((n) => n.id !== entry.id)].slice(
    0,
    80,
  )
  const completedEntry: CompletedSession = {
    id: `done-note-${entry.id}`,
    templateId: entry.routineId ?? 'notebook',
    title: entry.title,
    dateKey: entry.dateKey,
    durationMin: entry.durationMin ?? durationMin,
    estimatedKcal: entry.estimatedKcal,
    createdAt: entry.createdAt,
  }
  // Drop orphan completed rows that are not linked to a real workout note
  const noteIds = new Set(workoutNotes.map((n) => n.id))
  const completed = [
    completedEntry,
    ...state.completed.filter(
      (c) =>
        c.id !== completedEntry.id &&
        (!c.id.startsWith('done-note-') || noteIds.has(c.id.replace(/^done-note-/, ''))),
    ),
  ].slice(0, 60)

  let routines = state.routines
  if (entry.routineId) {
    const base = state.routines.find((r) => r.id === entry.routineId)
    if (base) {
      // Carnet personnel : mémorise charges/reps, sans marqueurs transitoires (done/rest).
      const withActual: WorkoutRoutine = {
        ...base,
        exercises: stripTransientSetMarkers(cloneExercises(entry.exercises)),
        updatedAt: Date.now(),
      }
      routines = state.routines.map((r) => (r.id === entry.routineId ? withActual : r))
    }
  }

  const completesActiveDraft = Boolean(
    !note.id &&
      entry.routineId &&
      state.activeWorkoutDraft?.routineId === entry.routineId,
  )
  const next = {
    ...state,
    workoutNotes,
    completed,
    routines,
    activeWorkoutDraft: completesActiveDraft ? null : state.activeWorkoutDraft ?? null,
  }
  write(next)
  return next
}

/**
 * Autosave carnet en cours → routines (local + cloud).
 * Les séries validées ne restent plus uniquement en mémoire React.
 */
export function saveRoutineDraft(
  routineId: string,
  exercises: ExerciseEntry[],
  sportId?: string | null,
): TrainingState {
  const state = read()
  const cleaned = exercises
    .map((e) => ({
      ...e,
      name: e.name.trim() || 'Exercice',
      sets: e.sets.filter((s) => s.reps > 0 && s.weightKg >= 0).map((s) => ({ ...s })),
    }))
    .filter((e) => e.sets.length > 0)

  // Ignore placeholder vide (évite d’écraser une routine au montage)
  const meaningful = cleaned.some(
    (e) =>
      (e.name && e.name !== 'Exercice') ||
      e.sets.some((s) => s.done || s.restSec != null || s.weightKg !== 20 || s.reps !== 8),
  )
  if (!meaningful) return state

  const routines = state.routines.map((r) =>
    r.id === routineId
      ? {
          ...r,
          exercises: cleaned,
          updatedAt: Date.now(),
        }
      : r,
  )
  const now = Date.now()
  const cleanSportId =
    sanitizeStoredId(sportId) ??
    sanitizeStoredId(state.lastSelectedSportId) ??
    sanitizeStoredId(state.primarySportId) ??
    'musculation'
  const prior = state.activeWorkoutDraft
  const same = prior?.routineId === routineId
  const baseDraft: ActiveWorkoutDraft = {
    routineId,
    sportId: cleanSportId,
    startedAt: same ? prior!.startedAt : now,
    updatedAt: now,
    elapsedActiveMs: same ? prior?.elapsedActiveMs : 0,
    runningSince: same ? prior?.runningSince ?? (prior?.paused ? null : now) : now,
    paused: same ? prior?.paused === true : false,
    restTimer: same ? prior?.restTimer ?? null : null,
  }
  const next = {
    ...state,
    routines,
    activeWorkoutDraft: ensureDraftClock(baseDraft, now),
  }
  write(next)
  return next
}

/** Marque explicitement le clic Démarrer sans altérer le contenu de la routine. */
export function startRoutineDraft(
  routineId: string,
  sportId: string,
): TrainingState {
  const state = read()
  const cleanRoutineId = sanitizeStoredId(routineId)
  const cleanSportId = sanitizeStoredId(sportId)
  if (!cleanRoutineId || !cleanSportId) return state
  if (!state.routines.some((routine) => routine.id === cleanRoutineId && routine.exercises.length > 0)) {
    return state
  }
  const now = Date.now()
  const prior = state.activeWorkoutDraft
  const same = prior?.routineId === cleanRoutineId
  const next: TrainingState = {
    ...state,
    lastSelectedRoutineId: cleanRoutineId,
    lastSelectedSportId: cleanSportId,
    activeWorkoutDraft: ensureDraftClock({
      routineId: cleanRoutineId,
      sportId: cleanSportId,
      startedAt: same ? prior!.startedAt : now,
      updatedAt: now,
      elapsedActiveMs: same ? prior?.elapsedActiveMs : 0,
      runningSince: same && prior?.paused ? null : now,
      paused: same ? prior?.paused === true : false,
      restTimer: same ? prior?.restTimer ?? null : null,
    }, now),
  }
  write(next)
  return next
}

/** Pause / reprise du chronomètre de séance active (même clé Train). */
export function setActiveWorkoutPaused(paused: boolean): TrainingState {
  const state = read()
  const draft = state.activeWorkoutDraft
  if (!draft) return state
  const now = Date.now()
  const ensured = ensureDraftClock(draft, now)
  const nextDraft = paused ? pauseDraftClock(ensured, now) : resumeDraftClock(ensured, now)
  const next = { ...state, activeWorkoutDraft: nextDraft }
  write(next)
  return next
}

/** Garantit les champs clock sur un brouillon legacy (idempotent). */
export function ensureActiveWorkoutClock(): TrainingState {
  const state = read()
  const draft = state.activeWorkoutDraft
  if (!draft) return state
  const now = Date.now()
  const nextDraft = ensureDraftClock(draft, now)
  if (
    nextDraft.elapsedActiveMs === draft.elapsedActiveMs &&
    nextDraft.runningSince === draft.runningSince &&
    nextDraft.paused === draft.paused &&
    nextDraft.estimatedElapsedMs === draft.estimatedElapsedMs
  ) {
    return state
  }
  const next = { ...state, activeWorkoutDraft: nextDraft }
  write(next)
  return next
}

/** Persiste le snapshot repos sur le brouillon actif (ou no-op hors séance). */
export function persistActiveRestTimer(
  restTimer: ActiveWorkoutDraft['restTimer'],
): TrainingState {
  const state = read()
  const draft = state.activeWorkoutDraft
  if (!draft) return state
  const next = {
    ...state,
    activeWorkoutDraft: {
      ...draft,
      restTimer: restTimer ?? null,
      updatedAt: Date.now(),
    },
  }
  write(next)
  return next
}

export function addCustomRoutine(label: string): TrainingState {
  const state = read()
  const id = `custom-${Date.now()}`
  const routine: WorkoutRoutine = {
    id,
    label: label.trim() || 'Custom',
    subtitle: 'Focus perso',
    accent: '#FF6961',
    exercises: [],
    updatedAt: 0,
  }
  const next = { ...state, routines: [...state.routines, routine] }
  write(next)
  return next
}

export function getRoutineExercises(routineId: string): ExerciseEntry[] {
  const state = read()
  const routine = state.routines.find((r) => r.id === routineId)
  if (!routine?.exercises?.length) return []
  return cloneExercises(routine.exercises)
}

export function removeWorkoutNote(id: string): TrainingState {
  const state = read()
  const next = {
    ...state,
    workoutNotes: state.workoutNotes.filter((n) => n.id !== id),
    completed: state.completed.filter((c) => c.id !== `done-note-${id}`),
  }
  write(next)
  return next
}

import { dedupeWorkoutNotes } from '../utils/workoutHistory'

export function todayWorkoutKcal(state: TrainingState = read()): number {
  const key = todayKey()
  const fromNotes = dedupeWorkoutNotes(state.workoutNotes)
    .filter((n) => n.dateKey === key)
    .reduce((sum, n) => sum + n.estimatedKcal, 0)
  if (fromNotes > 0) return fromNotes
  return state.completed
    .filter((c) => c.dateKey === key)
    .reduce((sum, c) => sum + c.estimatedKcal, 0)
}
