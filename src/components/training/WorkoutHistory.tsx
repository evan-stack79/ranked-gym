import { useMemo, useState } from 'react'
import { ChevronRight, Clock, Dumbbell, Flame, Trash2 } from 'lucide-react'
import type { WorkoutNote } from '../../types/training'
import {
  DIFF_LABELS,
  formatClock,
  groupNotesByDate,
  noteDurationMin,
  noteVolumeKg,
} from '../../utils/workoutHistory'
import { IosSheet } from '../ui/IosSheet'

interface WorkoutHistoryProps {
  notes: WorkoutNote[]
  onDelete: (id: string) => void
}

export function WorkoutHistory({ notes, onDelete }: WorkoutHistoryProps) {
  const [selected, setSelected] = useState<WorkoutNote | null>(null)
  const groups = useMemo(() => groupNotesByDate(notes), [notes])

  if (groups.length === 0) {
    return (
      <section className="space-y-2">
        <div className="px-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Historique
          </p>
          <h2 className="text-[20px] font-bold text-white">Journal d’athlète</h2>
          <p className="mt-1 text-[12px] text-[#AEAEB2]">
            Tes séances passées apparaîtront ici, groupées par jour.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="px-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Historique
        </p>
        <h2 className="text-[20px] font-bold text-white">Journal d’athlète</h2>
        <p className="mt-1 text-[12px] text-[#AEAEB2]">
          Chronologique · volume · durée · détail des séries.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-2">
          <p className="px-1 text-[13px] font-bold text-white">{group.label}</p>
          <ul className="space-y-2">
            {group.sessions.map((note) => {
              const volume = noteVolumeKg(note)
              const duration = noteDurationMin(note)
              const exerciseCount = note.exercises.length
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(note)}
                    className="ios-press glass-card flex w-full items-center gap-3 rounded-2xl p-3.5 text-left"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF2B2B]/15 text-[#FF6961]">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-white">{note.title}</p>
                        <span className="shrink-0 text-[11px] text-[#636366]">
                          {formatClock(note.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#8E8E93]">
                        <span className="inline-flex items-center gap-1">
                          <Dumbbell className="h-3 w-3" />
                          {volume.toLocaleString('fr-FR')} kg
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {duration} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Flame className="h-3 w-3 text-[#FF9F0A]" />
                          {note.estimatedKcal} kcal
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#636366]">
                        {exerciseCount} exercice{exerciseCount > 1 ? 's' : ''}
                        {note.exercises[0]?.name ? ` · ${note.exercises[0].name}` : ''}
                        {exerciseCount > 1 ? '…' : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#636366]" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <IosSheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? 'Séance'}
        subtitle={
          selected
            ? `${formatClock(selected.createdAt)} · ${noteDurationMin(selected)} min · ${noteVolumeKg(selected).toLocaleString('fr-FR')} kg · ${selected.estimatedKcal} kcal`
            : undefined
        }
        leading={<Dumbbell className="mt-0.5 h-5 w-5 text-[#FF6961]" />}
      >
        {selected && (
          <div className="space-y-4 pb-2">
            {selected.exercises.map((ex) => (
              <div
                key={ex.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-3.5"
              >
                <p className="text-[15px] font-semibold text-white">{ex.name || 'Exercice'}</p>
                <ul className="mt-2 space-y-1.5">
                  {ex.sets.map((set, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[13px]"
                    >
                      <span className="font-semibold text-[#8E8E93]">Série {idx + 1}</span>
                      <span className="text-white">
                        {set.reps} reps × {set.weightKg} kg
                      </span>
                      <span className="text-[11px] font-semibold text-[#AEAEB2]">
                        {DIFF_LABELS[set.difficulty ?? 'ok'] ?? 'OK'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                const id = selected.id
                setSelected(null)
                onDelete(id)
              }}
              className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/12 py-3.5 text-[14px] font-semibold text-[#FF453A]"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer cette séance
            </button>
          </div>
        )}
      </IosSheet>
    </section>
  )
}
