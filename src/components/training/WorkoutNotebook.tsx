import { useMemo, useState } from 'react'
import { BookOpen, Plus, Trash2, TrendingUp } from 'lucide-react'
import type {
  ExerciseEntry,
  SetDifficulty,
  WorkoutNote,
  WorkoutSet,
} from '../../types/training'
import {
  bestSet1RM,
  relativeStrength,
  relativeStrengthLabel,
  suggestNextWeight,
  totalVolume,
  volumeToKcal,
} from '../../utils/strength'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'

interface WorkoutNotebookProps {
  bodyWeightKg: number
  history: WorkoutNote[]
  onSave: (note: {
    title: string
    exercises: ExerciseEntry[]
    estimatedKcal: number
  }) => void
  onDeleteNote: (id: string) => void
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

export function WorkoutNotebook({
  bodyWeightKg,
  history,
  onSave,
  onDeleteNote,
}: WorkoutNotebookProps) {
  const [title, setTitle] = useState('Séance')
  const [exercises, setExercises] = useState<ExerciseEntry[]>([emptyExercise()])

  const stats = useMemo(() => {
    const allSets = exercises.flatMap((e) => e.sets)
    const volume = totalVolume(allSets)
    const oneRm = bestSet1RM(allSets)
    const ratio = relativeStrength(oneRm, bodyWeightKg)
    const kcal = volumeToKcal(volume, Math.max(25, exercises.length * 10))
    return { volume, oneRm, ratio, kcal }
  }, [exercises, bodyWeightKg])

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
      title: title.trim() || 'Séance',
      exercises: cleaned,
      estimatedKcal: stats.kcal,
    })
    setTitle('Séance')
    setExercises([emptyExercise()])
  }

  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Carnet
        </p>
        <h2 className="text-[20px] font-bold text-white">Séries · poids · force</h2>
        <p className="mt-1 text-[12px] text-[#AEAEB2]">
          Note ce que tu soulèves. On estime ta force vs ton poids et une progression safe.
        </p>
      </div>

      <div
        className="rounded-3xl border border-white/10 p-4"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 100% 0%, rgb(255 43 43 / 0.16) 0%, transparent 55%), rgb(22 22 24 / 0.96)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#FF6961]" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nom de la séance (ex. Upper)"
            className="w-full bg-transparent text-[17px] font-bold text-white placeholder:text-[#636366] outline-none"
          />
        </div>

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
                    <div
                      key={idx}
                      className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2"
                    >
                      <span className="pb-2 text-[11px] font-bold text-[#8E8E93]">
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
                          onChange={(v) =>
                            updateSet(ex.id, idx, { weightKg: v ?? 0 })
                          }
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
            Sauver · ~{stats.kcal} kcal
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-[#636366]">
          Volume {stats.volume} kg · estimations pour progresser en sécurité
        </p>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[12px] font-semibold text-[#8E8E93]">Dernières séances</p>
          {history.slice(0, 5).map((note) => (
            <article
              key={note.id}
              className="glass-card flex items-start gap-3 rounded-2xl p-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{note.title}</p>
                <p className="text-[12px] text-[#8E8E93]">
                  {note.exercises.map((e) => e.name).join(' · ') || 'Exercices'}
                  {' · '}
                  {note.estimatedKcal} kcal
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteNote(note.id)}
                className="text-[#636366]"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
