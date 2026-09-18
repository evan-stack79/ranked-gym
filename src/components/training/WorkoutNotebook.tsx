import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, Pause, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import type {
  ExerciseEntry,
  ScheduledSession,
  SessionKind,
  SessionSource,
  SetDifficulty,
  WorkoutNote,
  WorkoutRoutine,
  WorkoutSet,
} from '../../types/training'
import {
  resolveResumedRoutineId,
  setLastSelectedRoutine,
} from '../../services/trainingStorage'
import { computeStrengthSessionStats } from '../../utils/strength'
import { sanitizeExerciseName } from '../../utils/exerciseName'
import { detectProgramSplit, filterRoutinesForProgram } from '../../utils/workoutProgram'
import {
  findLastExerciseSets,
  formatSetLoadLabel,
} from '../../utils/workoutHistory'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import { WorkoutHistory } from './WorkoutHistory'
import { ImmersiveExerciseSession } from './ImmersiveExerciseSession'

interface WorkoutNotebookProps {
  id?: string
  bodyWeightKg: number
  routines: WorkoutRoutine[]
  schedule?: ScheduledSession[]
  history: WorkoutNote[]
  initialRoutineId?: string | null
  /** Sport figé sur les nouvelles séances (pas de redéduction à la lecture). */
  sportId: string
  /** Famille de module — strength pour le carnet force / hybrid. */
  sessionKind?: SessionKind
  /** Ouvre le carnet directement en mode édition d’une note existante. */
  initialEditNote?: WorkoutNote | null
  /** Reprendre copie exactement la routine détectée ; ne réinjecte pas l'historique. */
  resume?: boolean
  onSave: (note: {
    id?: string
    title: string
    exercises: ExerciseEntry[]
    estimatedKcal: number
    durationMin: number
    totalVolumeKg: number
    routineId: string
    createdAt?: number
    dateKey?: string
    sportId?: string
    source?: SessionSource
    sessionKind?: SessionKind
  }) => void | Promise<void>
  /** Autosave séries / exercices vers Supabase (routine draft). */
  onDraftSave?: (routineId: string, exercises: ExerciseEntry[]) => void
  onDeleteNote: (id: string) => void
  onAddRoutine: (label: string) => void
  /** Démarre le timer de repos après validation d’une série. */
  onRestStart?: (info: {
    exerciseId: string
    setIndex: number
    exerciseName: string
    setLabel: string
    restSec?: number
  }) => void
  /** Applique restSec / done sur une série (callback parent). */
  restLogRequest?: {
    exerciseId: string
    setIndex: number
    restSec: number
    addNextSet: boolean
    nonce: number
  } | null
  /** Chronomètre séance active (durée réelle). Absent en mode édition historique. */
  sessionClockLabel?: string | null
  sessionPaused?: boolean
  onToggleSessionPause?: () => void
  /** Minutes chronométrées réelles — prioritaire à l’estimation à la sauvegarde. */
  sessionDurationMin?: number | null
  /** Retour hub Train (écran immersif). */
  onBack?: () => void
}

/** Tags optionnels — n’influencent plus la charge suivante. */
const DIFF_OPTIONS: { id: SetDifficulty; label: string }[] = [
  { id: 'easy', label: 'Facile' },
  { id: 'ok', label: 'OK' },
  { id: 'hard', label: 'Dur' },
]

function emptySet(): WorkoutSet {
  return { reps: 8, weightKg: 20 }
}

function emptyExercise(): ExerciseEntry {
  return {
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    sets: [emptySet()],
  }
}

function cloneFromRoutine(routine: WorkoutRoutine, history: WorkoutNote[] = []): ExerciseEntry[] {
  if (!routine.exercises.length) return [emptyExercise()]
  return routine.exercises.map((e) => {
    const last = findLastExerciseSets(history, e.name)
    // Préférer la dernière perf réelle : évite de réinjecter d’anciennes charges auto-progressées.
    const sourceSets = last?.sets ?? e.sets
    return {
      ...e,
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sets: sourceSets.map((s) => ({
        reps: s.reps,
        weightKg: s.weightKg,
        difficulty: undefined,
        rpe: undefined,
      })),
    }
  })
}

function copyExercises(exercises: ExerciseEntry[]): ExerciseEntry[] {
  return exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) }))
}

function resolveBootRoutine(
  routines: WorkoutRoutine[],
  schedule: ScheduledSession[],
  sportId: string,
  launchRoutineId?: string | null,
): WorkoutRoutine {
  const split = detectProgramSplit(schedule, routines)
  const visible = filterRoutinesForProgram(routines, split)
  const resumedId =
    resolveResumedRoutineId({
      routines,
      candidateIds: visible.map((r) => r.id),
      sportId,
      launchRoutineId,
    }) ??
    visible[0]?.id ??
    routines[0]?.id ??
    'upper'
  return (
    visible.find((r) => r.id === resumedId) ??
    routines.find((r) => r.id === resumedId) ??
    visible[0] ??
    routines[0] ?? {
      id: 'upper',
      label: 'Upper',
      subtitle: '',
      accent: '#fff',
      exercises: [],
      updatedAt: 0,
    }
  )
}

export function WorkoutNotebook({
  id,
  bodyWeightKg,
  routines,
  schedule = [],
  history,
  initialRoutineId,
  initialEditNote = null,
  resume = false,
  sportId,
  sessionKind = 'strength',
  onSave,
  onDraftSave,
  onDeleteNote,
  onAddRoutine,
  onRestStart,
  restLogRequest,
  sessionClockLabel = null,
  sessionPaused = false,
  onToggleSessionPause,
  sessionDurationMin = null,
  onBack,
}: WorkoutNotebookProps) {
  const bootRoutine = useMemo(
    () => (resume ? routines.find(r => r.id === initialRoutineId) : undefined) ??
      resolveBootRoutine(routines, schedule, sportId, initialRoutineId),
    // Montage uniquement — reprise locale ; les changements suivants passent par selectRoutine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [routineId, setRoutineId] = useState(initialEditNote?.routineId ?? bootRoutine.id)
  const [title, setTitle] = useState(initialEditNote?.title ?? bootRoutine.label)
  const [exercises, setExercises] = useState<ExerciseEntry[]>(() =>
    initialEditNote ? copyExercises(initialEditNote.exercises)
      : resume ? copyExercises(bootRoutine.exercises) : cloneFromRoutine(bootRoutine, history),
  )
  const [customOpen, setCustomOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingNote, setEditingNote] = useState<WorkoutNote | null>(initialEditNote)
  const [effortHelpOpen, setEffortHelpOpen] = useState(false)
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)
  const [restPrefSec, setRestPrefSec] = useState(90)
  const beforeEdit = useRef({
    routineId: bootRoutine.id,
    title: bootRoutine.label,
    exercises: copyExercises(bootRoutine.exercises),
  })
  const draftBlocked = useRef(Boolean(initialEditNote))
  const draftDirty = useRef(false)
  draftBlocked.current = Boolean(editingNote) || saving
  const initialLaunchApplied = useRef(initialRoutineId)

  const exercisesRef = useRef(exercises)
  const routineIdRef = useRef(routineId)
  exercisesRef.current = exercises
  routineIdRef.current = routineId

  const visibleRoutines = useMemo(() => {
    const split = detectProgramSplit(schedule, routines)
    return filterRoutinesForProgram(routines, split)
  }, [schedule, routines])

  const activeRoutine = useMemo(
    () => routines.find((r) => r.id === routineId) ?? visibleRoutines[0],
    [routines, visibleRoutines, routineId],
  )

  const stats = useMemo(
    () => computeStrengthSessionStats(exercises, bodyWeightKg),
    [exercises, bodyWeightKg],
  )

  const selectRoutine = (nextId: string) => {
    const r = visibleRoutines.find((x) => x.id === nextId) ?? routines.find((x) => x.id === nextId)
    if (!r) return
    setRoutineId(r.id)
    setTitle(r.label)
    setExercises(cloneFromRoutine(r, history))
    draftDirty.current = false
    setEditingNote(null)
    // Sauvegarde immédiate — iOS peut suspendre sans événement de fermeture.
    setLastSelectedRoutine(r.id, sportId)
  }

  useEffect(() => {
    if (editingNote || (resume && routines.some(r => r.id === routineId))) return
    if (!visibleRoutines.some((r) => r.id === routineId) && visibleRoutines[0]) {
      selectRoutine(visibleRoutines[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRoutines])

  useEffect(() => {
    if (editingNote) return
    if (!routines.some((r) => r.id === routineId) && routines[0]) {
      selectRoutine(routines[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routines])

  useEffect(() => {
    if (initialLaunchApplied.current === initialRoutineId || editingNote) return
    initialLaunchApplied.current = initialRoutineId
    if (!initialRoutineId) return
    if (!routines.some((r) => r.id === initialRoutineId)) return
    selectRoutine(initialRoutineId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoutineId])

  useEffect(() => {
    if (!restLogRequest || draftBlocked.current) return
    const { exerciseId, setIndex, restSec, addNextSet } = restLogRequest
    setExercises((prev) => {
      draftDirty.current = true
      const next = prev.map((e) => {
        if (e.id !== exerciseId) return e
        let sets = e.sets.map((s, i) => (i === setIndex ? { ...s, restSec, done: true } : s))
        if (addNextSet) {
          const last = sets[sets.length - 1]
          sets = [
            ...sets,
            {
              reps: last?.reps ?? 8,
              weightKg: last?.weightKg ?? 20,
              difficulty: last?.difficulty,
              rpe: last?.rpe,
            },
          ]
        }
        return { ...e, sets }
      })
      onDraftSave?.(routineId, next)
      draftDirty.current = false
      return next
    })
  }, [restLogRequest, onDraftSave, routineId])

  useEffect(() => {
    if (!onDraftSave || editingNote || saving || !draftDirty.current) return
    const t = window.setTimeout(() => {
      if (!draftBlocked.current && draftDirty.current) {
        onDraftSave(routineId, exercises)
        draftDirty.current = false
      }
    }, 700)
    return () => window.clearTimeout(t)
  }, [exercises, routineId, onDraftSave, editingNote, saving])

  // Flush brouillon en attente uniquement — la préférence routine est déjà écrite au select.
  useEffect(() => {
    if (!onDraftSave) return
    const flushDraft = () => {
      if (!draftBlocked.current && draftDirty.current) {
        onDraftSave(routineIdRef.current, exercisesRef.current)
        draftDirty.current = false
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushDraft()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushDraft)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushDraft)
    }
  }, [onDraftSave])

  const updateExercise = (exerciseId: string, patch: Partial<ExerciseEntry>) => {
    draftDirty.current = true
    setExercises((prev) => prev.map((e) => (e.id === exerciseId ? { ...e, ...patch } : e)))
  }

  const updateSet = (exerciseId: string, setIndex: number, patch: Partial<WorkoutSet>) => {
    draftDirty.current = true
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e
        return {
          ...e,
          sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
        }
      }),
    )
  }

  const finishSet = (
    ex: ExerciseEntry,
    setIndex: number,
    difficulty?: SetDifficulty,
    restSec = 90,
  ) => {
    draftDirty.current = true
    setExercises((prev) => {
      const next = prev.map((e) => {
        if (e.id !== ex.id) return e
        const sets = e.sets.map((s, i) =>
          i === setIndex
            ? { ...s, done: true, ...(difficulty ? { difficulty } : {}) }
            : s,
        )
        return { ...e, sets }
      })
      if (!draftBlocked.current) onDraftSave?.(routineId, next)
      draftDirty.current = false
      return next
    })
    if (!editingNote) onRestStart?.({
      exerciseId: ex.id,
      setIndex,
      exerciseName: ex.name.trim() || 'Exercice',
      setLabel: `S${setIndex + 1}`,
      restSec,
    })
  }

  /** Séance live chronométrée → canvas immersif (édition historique reste en carnet classique). */
  const immersiveLive = Boolean(sessionClockLabel) && !editingNote

  useEffect(() => {
    if (!immersiveLive || exercises.length === 0) return
    setActiveExerciseIndex((i) => Math.min(i, exercises.length - 1))
  }, [exercises.length, immersiveLive])

  // Au démarrage immersif : focus sur le premier exercice avec série en cours.
  useEffect(() => {
    if (!immersiveLive) return
    const idx = exercises.findIndex((e) => e.sets.some((s) => !s.done))
    if (idx >= 0) setActiveExerciseIndex(idx)
    // Montage immersif uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersiveLive])

  const loadNoteForEdit = (note: WorkoutNote) => {
    if (!editingNote) {
      beforeEdit.current = { routineId, title, exercises: copyExercises(exercises) }
    }
    draftBlocked.current = true
    draftDirty.current = false
    setEditingNote(note)
    setTitle(note.title)
    if (note.routineId) setRoutineId(note.routineId)
    setExercises(copyExercises(note.exercises))
  }

  const cancelEdit = () => {
    draftDirty.current = false
    setEditingNote(null)
    setRoutineId(beforeEdit.current.routineId)
    setTitle(beforeEdit.current.title)
    setExercises(copyExercises(beforeEdit.current.exercises))
  }

  const handleSave = async () => {
    const cleaned = exercises
      .map((e) => ({
        ...e,
        name: sanitizeExerciseName(e.name.trim() || 'Exercice'),
        sets: e.sets.filter((s) => s.reps > 0 && s.weightKg >= 0),
      }))
      .filter((e) => e.sets.length > 0)
    if (!cleaned.length) return
    draftBlocked.current = true
    setSaving(true)
    try {
      // Nouvelle séance : fige sport/kind/source. Édition legacy : ne pas inventer de champs.
      await onSave({
        id: editingNote?.id,
        createdAt: editingNote?.createdAt,
        dateKey: editingNote?.dateKey,
        title: title.trim() || activeRoutine?.label || 'Séance',
        exercises: cleaned,
        estimatedKcal: stats.kcal,
        durationMin:
          !editingNote && sessionDurationMin != null && sessionDurationMin > 0
            ? sessionDurationMin
            : stats.durationMin,
        totalVolumeKg: stats.volume,
        routineId,
        sportId: editingNote ? editingNote.sportId : sportId,
        sessionKind: editingNote ? editingNote.sessionKind : sessionKind,
        source: editingNote ? editingNote.source : 'manual',
      })
      if (editingNote) {
        cancelEdit()
      } else {
        draftDirty.current = false
        setExercises(
          cleaned.map((e) => ({
            ...e,
            id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sets: e.sets.map((s) => ({
              reps: s.reps,
              weightKg: s.weightKg,
              difficulty: s.difficulty,
              rpe: s.rpe,
            })),
          })),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const hasSaved = (activeRoutine?.exercises.length ?? 0) > 0

  if (immersiveLive) {
    return (
      <ImmersiveExerciseSession
        exercises={exercises}
        activeIndex={activeExerciseIndex}
        onActiveIndexChange={setActiveExerciseIndex}
        sessionClockLabel={sessionClockLabel!}
        sessionPaused={sessionPaused}
        onToggleSessionPause={onToggleSessionPause}
        onBack={onBack ?? (() => undefined)}
        onUpdateSet={updateSet}
        onAddSet={(exerciseId) => {
          const ex = exercises.find((e) => e.id === exerciseId)
          if (!ex) return
          updateExercise(exerciseId, { sets: [...ex.sets, emptySet()] })
        }}
        onValidateSet={(ex, setIndex, restSec) => finishSet(ex, setIndex, undefined, restSec)}
        onFinishSession={() => void handleSave()}
        saving={saving}
        restPrefSec={restPrefSec}
        onRestPrefChange={setRestPrefSec}
      />
    )
  }

  return (
    <section id={id} className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 className="text-[20px] font-bold text-white">Programme</h2>
        {sessionClockLabel && !editingNote ? (
          <div className="flex items-center gap-2">
            <p
              className="text-[15px] font-semibold tabular-nums tracking-tight text-white"
              aria-live="polite"
              data-session-clock
            >
              {sessionClockLabel}
              {sessionPaused ? (
                <span className="ml-1.5 text-[11px] font-medium text-[#8E8E93]">Pause</span>
              ) : null}
            </p>
            {onToggleSessionPause ? (
              <button
                type="button"
                onClick={onToggleSessionPause}
                className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white"
                aria-label={sessionPaused ? 'Reprendre la séance' : 'Mettre la séance en pause'}
              >
                {sessionPaused ? (
                  <Play className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Pause className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleRoutines.map((r) => {
          const active = r.id === routineId
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRoutine(r.id)}
              className={`ios-press flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-[12px] font-semibold ${
                active
                  ? 'border-transparent text-white'
                  : 'border-white/10 bg-black/25 text-[#8E8E93]'
              }`}
              style={
                active
                  ? { background: `${r.accent}33`, borderColor: `${r.accent}66`, color: '#fff' }
                  : undefined
              }
            >
              {r.label}
              {r.exercises.length > 0 ? ' ·' : ''}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className="ios-press flex min-h-11 shrink-0 items-center rounded-full border border-dashed border-white/20 px-3 text-[12px] font-semibold text-[#8E8E93]"
        >
          + Programme
        </button>
      </div>

      {customOpen && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Ex. Pecs & triceps"
            className="flex-1 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-[14px] text-white outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!customLabel.trim()) return
              onAddRoutine(customLabel.trim())
              setCustomLabel('')
              setCustomOpen(false)
            }}
            className="btn-brand flex min-h-11 items-center rounded-xl px-4 text-[13px] font-semibold text-white"
          >
            OK
          </button>
        </div>
      )}

      <div
        className="rounded-3xl border border-white/10 px-4 py-3.5"
        style={{
          background: editingNote
            ? `radial-gradient(ellipse 80% 60% at 100% 0%, #FF2B2B33 0%, transparent 55%), rgb(22 22 24 / 0.96)`
            : `radial-gradient(ellipse 80% 60% at 100% 0%, ${activeRoutine?.accent ?? '#FF2B2B'}28 0%, transparent 55%), rgb(22 22 24 / 0.96)`,
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
        }}
      >
        {editingNote ? (
          <div className="mb-2.5 flex items-center justify-between gap-2 rounded-2xl border border-[#FF2B2B]/35 bg-[#FF2B2B]/12 px-3 py-2">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 shrink-0 text-[#FF6961]" strokeWidth={2.25} />
              <div>
                <p className="text-[13px] font-bold text-white">Mode Édition</p>
                <p className="text-[11px] text-[#AEAEB2]">Séance du {editingNote.dateKey}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 text-[#8E8E93]"
              aria-label="Annuler l’édition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: activeRoutine?.accent }} />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nom"
            className="w-full bg-transparent text-[17px] font-bold text-white placeholder:text-[#636366] outline-none"
          />
        </div>
        {!hasSaved ? (
          <p className="mb-2.5 text-[11px] text-[#8E8E93]">
            Nouveau focus — ajoute tes exercices ; ils resteront dans ton carnet.
          </p>
        ) : null}

        <div className="mb-2 flex items-center justify-end gap-1.5">
          <span className="text-[11px] text-[#8E8E93]">Effort facultatif</span>
          <button
            type="button"
            onClick={() => setEffortHelpOpen((v) => !v)}
            className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/12 text-[12px] font-bold text-[#8E8E93]"
            aria-label="Aide Effort (facultatif)"
            aria-expanded={effortHelpOpen}
          >
            ?
          </button>
        </div>

        {effortHelpOpen ? (
          <div
            className="mb-2.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] leading-relaxed text-[#AEAEB2]"
            role="note"
          >
            <p className="font-semibold text-white">Effort · 1–10</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <span className="font-semibold text-white">6</span> : Facile
              </li>
              <li>
                <span className="font-semibold text-white">7</span> : Modéré
              </li>
              <li>
                <span className="font-semibold text-white">8</span> : Difficile — environ 2 reps
                possibles
              </li>
              <li>
                <span className="font-semibold text-white">9</span> : Très difficile — environ 1 rep
                possible
              </li>
              <li>
                <span className="font-semibold text-white">10</span> : Maximum
              </li>
            </ul>
          </div>
        ) : null}

        <div className="space-y-3">
          {exercises.map((ex) => {
            const last = findLastExerciseSets(history, ex.name)
            const pendingIdx = ex.sets.findIndex((s) => !s.done)
            const validateIdx = pendingIdx >= 0 ? pendingIdx : Math.max(0, ex.sets.length - 1)

            return (
              <div
                key={ex.id}
                className="rounded-2xl border border-white/8 bg-black/25 p-3"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={ex.name}
                    onChange={(e) =>
                      updateExercise(ex.id, { name: sanitizeExerciseName(e.target.value) })
                    }
                    placeholder="Exercice (ex. Développé couché)"
                    className="w-full bg-transparent text-[15px] font-semibold uppercase tracking-wide text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-[#636366] outline-none"
                  />
                  {exercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        draftDirty.current = true
                        setExercises((prev) => prev.filter((x) => x.id !== ex.id))
                      }}
                      className="ios-press flex min-h-11 min-w-11 items-center justify-center text-[#8E8E93]"
                      aria-label="Supprimer exercice"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {last && (
                  <div className="mb-2 px-0.5 py-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                      Dernière séance
                    </p>
                    <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {last.sets.map((s, i) => (
                        <li key={i} className="text-[12px] tabular-nums text-[#AEAEB2]">
                          {formatSetLoadLabel(s.weightKg, s.reps)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Aujourd&apos;hui
                </p>

                <div className="space-y-1.5">
                  {ex.sets.map((set, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-end gap-2"
                    >
                      <span
                        className={`pb-2 text-[11px] font-bold ${
                          set.done ? 'text-[#30D158]' : 'text-[#8E8E93]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <label className="block">
                        <span className="mb-0.5 block text-[10px] text-[#636366]">kg</span>
                        <ClearableNumberInput
                          value={set.weightKg}
                          onChange={(v) => updateSet(ex.id, idx, { weightKg: v ?? 0 })}
                          min={0}
                          max={500}
                          step={0.5}
                          aria-label="Poids"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-[15px] font-semibold text-white outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-0.5 block text-[10px] text-[#636366]">Reps</span>
                        <ClearableNumberInput
                          value={set.reps}
                          onChange={(v) =>
                            updateSet(ex.id, idx, { reps: v != null ? Math.round(v) : 0 })
                          }
                          min={1}
                          max={50}
                          aria-label="Reps"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-[15px] font-semibold text-white outline-none"
                        />
                      </label>
                      <label className="block w-[3.75rem]">
                        <span className="mb-0.5 block text-[10px] text-[#636366]">Effort</span>
                        <ClearableNumberInput
                          value={set.rpe ?? null}
                          onChange={(v) =>
                            updateSet(ex.id, idx, {
                              rpe:
                                v != null ? Math.min(10, Math.max(1, Math.round(v))) : undefined,
                            })
                          }
                          min={1}
                          max={10}
                          required={false}
                          placeholder="1–10"
                          placeholderClassName="pointer-events-none absolute inset-0 flex items-center px-2 text-[12px] font-semibold text-[#636366]"
                          aria-label="Effort facultatif, 1 à 10"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-[13px] font-semibold text-[#AEAEB2] outline-none"
                        />
                      </label>
                      {ex.sets.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateExercise(ex.id, {
                              sets: ex.sets.filter((_, i) => i !== idx),
                            })
                          }
                          className="mb-2 flex min-h-11 min-w-11 items-center justify-center text-[#636366]"
                          aria-label="Supprimer série"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="w-11" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateExercise(ex.id, { sets: [...ex.sets, emptySet()] })
                    }
                    className="ios-press inline-flex min-h-11 items-center rounded-full border border-white/10 px-3 text-[11px] font-semibold text-[#AEAEB2]"
                  >
                    + Ajouter une série
                  </button>
                  <button
                    type="button"
                    onClick={() => finishSet(ex, validateIdx)}
                    className="ios-press inline-flex min-h-11 items-center gap-1 rounded-full border border-[#30D158]/40 bg-[#30D158]/15 px-3.5 text-[12px] font-semibold text-[#30D158]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Valider
                  </button>
                  {DIFF_OPTIONS.map((d) => {
                    const set = ex.sets[validateIdx]
                    const on = set?.difficulty === d.id
                    return (
                      <button
                        key={d.id}
                        type="button"
                        title="Optionnel — n’ajuste pas automatiquement la charge"
                        onClick={() => updateSet(ex.id, validateIdx, { difficulty: d.id })}
                        className={`ios-press inline-flex min-h-11 items-center rounded-full border px-3 text-[11px] font-semibold ${
                          on
                            ? 'border-white/25 bg-white/10 text-white'
                            : 'border-white/10 text-[#636366]'
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>

                {ex.sets.some((s) => s.restSec != null && s.restSec > 0) ? (
                  <p className="mt-1.5 text-[10px] tabular-nums text-[#636366]">
                    Repos loggés :{' '}
                    {ex.sets
                      .map((s, i) =>
                        s.restSec != null && s.restSec > 0 ? `S${i + 1} ${s.restSec}s` : null,
                      )
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              draftDirty.current = true
              setExercises((prev) => [...prev, emptyExercise()])
            }}
            className="ios-press flex flex-1 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/30 py-3 text-[13px] font-semibold text-[#AEAEB2]"
          >
            <Plus className="h-4 w-4" />
            Exercice
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-brand ios-press flex flex-[1.4] flex-col items-center justify-center rounded-2xl py-2.5 text-[13px] font-semibold leading-tight text-white disabled:opacity-60"
          >
            <span>{saving ? 'Synchro…' : editingNote ? 'Sauvegarder' : 'Terminer la séance'}</span>
            {!saving && (
              <span className="mt-0.5 text-[11px] font-normal text-white/65">~{stats.kcal} kcal</span>
            )}
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-[#636366]">
          Volume {stats.volume} kg ·{' '}
          {sessionClockLabel && !editingNote
            ? `${sessionClockLabel} chronométré`
            : `${stats.durationMin} min estimées`}
        </p>
      </div>

      <WorkoutHistory
        notes={history}
        onDelete={onDeleteNote}
        onEdit={loadNoteForEdit}
      />
    </section>
  )
}
