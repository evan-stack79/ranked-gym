import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Plus, Trash2, TrendingUp } from 'lucide-react'
import type {
  ExerciseEntry,
  SetDifficulty,
  WorkoutNote,
  WorkoutRoutine,
  WorkoutSet,
} from '../../types/training'
import {
  bestSet1RM,
  computeStrengthSessionStats,
  relativeStrength,
  relativeStrengthLabel,
  suggestNextWeight,
} from '../../utils/strength'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import { WorkoutHistory } from './WorkoutHistory'

interface WorkoutNotebookProps {
  bodyWeightKg: number
  routines: WorkoutRoutine[]
  history: WorkoutNote[]
  onSave: (note: {
    title: string
    exercises: ExerciseEntry[]
    estimatedKcal: number
    durationMin: number
    totalVolumeKg: number
    routineId: string
  }) => void
  onDeleteNote: (id: string) => void
  onAddRoutine: (label: string) => void
  /** Démarre le timer de repos après « Terminer la série ». */
  onRestStart?: (info: {
    exerciseId: string
    setIndex: number
    exerciseName: string
    setLabel: string
  }) => void
  /** Applique restSec / done sur une série (callback parent). */
  restLogRequest?: {
    exerciseId: string
    setIndex: number
    restSec: number
    /** Skip → prépare la série suivante. */
    addNextSet: boolean
    nonce: number
  } | null
}

const DIFF_OPTIONS: { id: SetDifficulty; label: string }[] = [
  { id: 'easy', label: 'Facile' },
  { id: 'ok', label: 'OK' },
  { id: 'hard', label: 'Dur' },
]

function emptySet(): WorkoutSet {
  return { reps: 8, weightKg: 20, difficulty: 'ok' }
}

function emptyExercise(): ExerciseEntry {
  return {
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    sets: [emptySet()],
  }
}

function cloneFromRoutine(routine: WorkoutRoutine): ExerciseEntry[] {
  if (!routine.exercises.length) return [emptyExercise()]
  return routine.exercises.map((e) => ({
    ...e,
    id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sets: e.sets.map((s) => ({ ...s })),
  }))
}

export function WorkoutNotebook({
  bodyWeightKg,
  routines,
  history,
  onSave,
  onDeleteNote,
  onAddRoutine,
  onRestStart,
  restLogRequest,
}: WorkoutNotebookProps) {
  const [routineId, setRoutineId] = useState(routines[0]?.id ?? 'upper')
  const [title, setTitle] = useState(routines[0]?.label ?? 'Séance')
  const [exercises, setExercises] = useState<ExerciseEntry[]>(() =>
    cloneFromRoutine(routines[0] ?? { id: 'upper', label: 'Upper', subtitle: '', accent: '#fff', exercises: [], updatedAt: 0 }),
  )
  const [customOpen, setCustomOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')

  const activeRoutine = useMemo(
    () => routines.find((r) => r.id === routineId) ?? routines[0],
    [routines, routineId],
  )

  const selectRoutine = (id: string) => {
    const routine = routines.find((r) => r.id === id)
    if (!routine) return
    setRoutineId(id)
    setTitle(routine.label)
    setExercises(cloneFromRoutine(routine))
  }

  // If routines list gains a new custom, keep selection valid
  useEffect(() => {
    if (!routines.some((r) => r.id === routineId) && routines[0]) {
      selectRoutine(routines[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routines])

  const stats = useMemo(
    () => computeStrengthSessionStats(exercises, bodyWeightKg),
    [exercises, bodyWeightKg],
  )

  const updateExercise = (id: string, patch: Partial<ExerciseEntry>) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const updateSet = (exId: string, index: number, patch: Partial<WorkoutSet>) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exId) return e
        const sets = e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s))
        return { ...e, sets }
      }),
    )
  }

  // Applique le repos loggé par le timer parent
  useEffect(() => {
    if (!restLogRequest) return
    const { exerciseId, setIndex, restSec, addNextSet } = restLogRequest
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e
        const sets = e.sets.map((s, i) =>
          i === setIndex ? { ...s, done: true, restSec } : s,
        )
        if (addNextSet && setIndex === e.sets.length - 1) {
          const last = sets[setIndex]
          return {
            ...e,
            sets: [
              ...sets,
              {
                reps: last?.reps ?? 8,
                weightKg: last?.weightKg ?? 20,
                difficulty: last?.difficulty ?? 'ok',
              },
            ],
          }
        }
        return { ...e, sets }
      }),
    )
  }, [restLogRequest])

  const finishSet = (ex: ExerciseEntry, setIndex: number) => {
    updateSet(ex.id, setIndex, { done: true })
    onRestStart?.({
      exerciseId: ex.id,
      setIndex,
      exerciseName: ex.name.trim() || 'Exercice',
      setLabel: `S${setIndex + 1}`,
    })
  }

  const handleSave = () => {
    const cleaned = exercises
      .map((e) => ({
        ...e,
        name: e.name.trim() || 'Exercice',
        sets: e.sets.filter((s) => s.reps > 0 && s.weightKg >= 0),
      }))
      .filter((e) => e.sets.length > 0)
    if (!cleaned.length) return
    onSave({
      title: title.trim() || activeRoutine?.label || 'Séance',
      exercises: cleaned,
      estimatedKcal: stats.kcal,
      durationMin: stats.durationMin,
      totalVolumeKg: stats.volume,
      routineId,
    })
    // Keep the same focus open with what was just saved (progress stays visible)
    setExercises(cleaned.map((e) => ({
      ...e,
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sets: e.sets.map((s) => ({ ...s })),
    })))
  }

  const hasSaved = (activeRoutine?.exercises.length ?? 0) > 0

  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Carnet
        </p>
        <h2 className="text-[20px] font-bold text-white">Focus · séries · progression</h2>
        <p className="mt-1 text-[12px] text-[#AEAEB2]">
          Choisis Upper, Jambes, Pecs… — on rouvre ta dernière version pour évoluer.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {routines.map((r) => {
          const active = r.id === routineId
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRoutine(r.id)}
              className={`ios-press shrink-0 rounded-full border px-3.5 py-2 text-[12px] font-semibold ${
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
          className="ios-press shrink-0 rounded-full border border-dashed border-white/20 px-3 py-2 text-[12px] font-semibold text-[#8E8E93]"
        >
          + Focus
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
            className="btn-brand rounded-xl px-4 text-[13px] font-semibold text-white"
          >
            OK
          </button>
        </div>
      )}

      <div
        className="rounded-3xl border border-white/10 p-4"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 100% 0%, ${activeRoutine?.accent ?? '#FF2B2B'}28 0%, transparent 55%), rgb(22 22 24 / 0.96)`,
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: activeRoutine?.accent }} />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nom"
            className="w-full bg-transparent text-[17px] font-bold text-white placeholder:text-[#636366] outline-none"
          />
        </div>
        <p className="mb-3 text-[11px] text-[#8E8E93]">
          {hasSaved
            ? 'Dernière progression chargée — charges déjà ajustées selon Facile / OK / Dur.'
            : 'Nouveau focus — écris tes exercices, on les gardera pour la prochaine fois.'}
        </p>

        <div className="space-y-4">
          {exercises.map((ex) => {
            const oneRm = bestSet1RM(ex.sets)
            const ratio = relativeStrength(oneRm, bodyWeightKg)
            const tip = suggestNextWeight({
              sets: ex.sets,
              bodyWeightKg,
              difficulty: ex.sets[ex.sets.length - 1]?.difficulty ?? 'ok',
            })
            return (
              <div
                key={ex.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-3.5"
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={ex.name}
                    onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
                    placeholder="Exercice (ex. Développé couché)"
                    className="w-full bg-transparent text-[15px] font-semibold text-white placeholder:text-[#636366] outline-none"
                  />
                  {exercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExercises((prev) => prev.filter((x) => x.id !== ex.id))
                      }
                      className="text-[#8E8E93]"
                      aria-label="Supprimer exercice"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {ex.sets.map((set, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
                        <span
                          className={`pb-2 text-[11px] font-bold ${
                            set.done ? 'text-[#30D158]' : 'text-[#8E8E93]'
                          }`}
                        >
                          S{idx + 1}
                        </span>
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
                        <label className="block">
                          <span className="mb-0.5 block text-[10px] text-[#636366]">Poids kg</span>
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
                        {ex.sets.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateExercise(ex.id, {
                                sets: ex.sets.filter((_, i) => i !== idx),
                              })
                            }
                            className="mb-2 text-[#636366]"
                            aria-label="Supprimer série"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="w-4" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pl-6">
                        <button
                          type="button"
                          onClick={() => finishSet(ex, idx)}
                          className={`ios-press rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            set.done
                              ? 'border-[#30D158]/35 bg-[#30D158]/12 text-[#30D158]'
                              : 'border-[#FF2B2B]/35 bg-[#FF2B2B]/12 text-[#FF6961]'
                          }`}
                        >
                          {set.done ? 'Repos · Terminer' : 'Terminer la série'}
                        </button>
                        {set.restSec != null && set.restSec > 0 ? (
                          <span className="text-[10px] font-medium tabular-nums text-[#636366]">
                            Repos {set.restSec}s
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateExercise(ex.id, { sets: [...ex.sets, emptySet()] })
                    }
                    className="ios-press rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#AEAEB2]"
                  >
                    + Série
                  </button>
                  {DIFF_OPTIONS.map((d) => {
                    const last = ex.sets[ex.sets.length - 1]
                    const on = last?.difficulty === d.id
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          updateSet(ex.id, ex.sets.length - 1, { difficulty: d.id })
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          on
                            ? 'border-[#FF2B2B]/40 bg-[#FF2B2B]/20 text-[#FF6961]'
                            : 'border-white/10 text-[#8E8E93]'
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                  {tip && (
                    <button
                      type="button"
                      onClick={() =>
                        updateSet(ex.id, ex.sets.length - 1, { weightKg: tip.nextKg })
                      }
                      className="rounded-full border border-[#30D158]/35 bg-[#30D158]/10 px-2.5 py-1 text-[11px] font-semibold text-[#30D158]"
                    >
                      Appliquer ~{tip.nextKg} kg
                    </button>
                  )}
                </div>

                {oneRm > 0 && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[12px] text-[#AEAEB2]">
                      <TrendingUp className="h-3.5 w-3.5 text-[#30D158]" />
                      1RM est. <span className="font-semibold text-white">{oneRm} kg</span>
                      {' · '}
                      {ratio}× ton poids ({relativeStrengthLabel(ratio)})
                    </p>
                    {tip && (
                      <p className="mt-1 text-[11px] leading-relaxed text-[#8E8E93]">
                        {tip.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setExercises((prev) => [...prev, emptyExercise()])}
            className="ios-press flex flex-1 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/30 py-3 text-[13px] font-semibold text-[#AEAEB2]"
          >
            <Plus className="h-4 w-4" />
            Exercice
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-brand ios-press flex-[1.4] rounded-2xl py-3 text-[13px] font-semibold text-white"
          >
            Sauver {activeRoutine?.label} · ~{stats.kcal} kcal
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-[#636366]">
          Volume {stats.volume} kg · {stats.durationMin} min · kcal = poids × durée × intensité
        </p>
      </div>

      <WorkoutHistory notes={history} onDelete={onDeleteNote} />
    </section>
  )
}
