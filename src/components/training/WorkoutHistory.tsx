import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Clock, Dumbbell, Flame, Pencil, Trash2 } from 'lucide-react'
import type { WorkoutNote } from '../../types/training'
import {
  DIFF_LABELS,
  formatClock,
  groupNotesByDate,
  noteDurationMin,
  noteVolumeKg,
} from '../../utils/workoutHistory'
import { resolveSessionKind } from '../../utils/trainHub'
import { TrainSheet as IosSheet } from './TrainSheet'
import { deriveSessionDisplayTitle } from '../../utils/sessionDisplayTitle'

interface WorkoutHistoryProps {
  notes: WorkoutNote[]
  onDelete: (id: string) => void
  onEdit?: (note: WorkoutNote) => void
  /** Filtre optionnel — masque l’action Éditer si false. */
  canEdit?: (note: WorkoutNote) => boolean
  /** Ouvre le détail d’une séance (hub « Dernières séances »). */
  focusNoteId?: string | null
  onFocusConsumed?: () => void
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** Métriques affichables — jamais NaN / 0 kg / énergie fictive à 0. */
function historyMetrics(note: WorkoutNote): {
  kind: ReturnType<typeof resolveSessionKind>
  duration: number | null
  volume: number | null
  kcal: number | null
} {
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

function setLoadLabel(
  kind: ReturnType<typeof resolveSessionKind>,
  reps: number,
  weightKg: number,
): string {
  if (kind === 'strength' && isFinitePositive(weightKg)) {
    return `${reps} reps × ${weightKg} kg`
  }
  if (kind !== 'strength') {
    return 'Mesure non renseignée'
  }
  return `${reps} reps`
}

export function WorkoutHistory({
  notes,
  onDelete,
  onEdit,
  canEdit,
  focusNoteId = null,
  onFocusConsumed,
}: WorkoutHistoryProps) {
  const [selected, setSelected] = useState<WorkoutNote | null>(null)
  const groups = useMemo(() => groupNotesByDate(notes), [notes])

  useEffect(() => {
    if (!focusNoteId) return
    const hit = notes.find((n) => n.id === focusNoteId) ?? null
    setSelected(hit)
    onFocusConsumed?.()
  }, [focusNoteId, notes, onFocusConsumed])

  if (groups.length === 0) {
    return (
      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-[20px] font-bold text-white">Historique</h2>
          <p className="mt-1 text-[12px] text-[#AEAEB2]">
            Tes séances passées apparaîtront ici, groupées par jour.
          </p>
        </div>
      </section>
    )
  }

  const selectedMetrics = selected ? historyMetrics(selected) : null
  const selectedSubtitle = selectedMetrics
    ? [
        formatClock(selected!.createdAt),
        selectedMetrics.duration != null
          ? `${selectedMetrics.duration} min`
          : selectedMetrics.kind !== 'strength'
            ? 'Durée non renseignée'
            : null,
        selectedMetrics.volume != null
          ? `${selectedMetrics.volume.toLocaleString('fr-FR')} kg`
          : null,
        selectedMetrics.kcal != null ? `${selectedMetrics.kcal} kcal` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-[20px] font-bold text-white">Historique</h2>
      </div>

      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-2">
          <p className="px-1 text-[13px] font-bold text-white">{group.label}</p>
          <ul className="space-y-2">
            {group.sessions.map((note) => {
              const metrics = historyMetrics(note)
              const exerciseCount = note.exercises.length
              const displayTitle = deriveSessionDisplayTitle(note)
              return (
                <li key={note.id}>
                  <div className="ios-press glass-card relative flex w-full items-center gap-3 rounded-2xl p-3.5 text-left">
                    <button
                      type="button"
                      onClick={() => setSelected(note)}
                      className="absolute inset-0 z-0 rounded-2xl"
                      aria-label={`Voir ${displayTitle}`}
                    />
                    <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF2B2B]/15 text-[#FF6961]">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="relative z-10 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-white">{displayTitle}</p>
                        <span className="shrink-0 text-[11px] text-[#636366]">
                          {formatClock(note.createdAt)}
                        </span>
                        {onEdit && (canEdit?.(note) ?? true) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(note)
                            }}
                            className="ios-press relative z-20 ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#AEAEB2]"
                            aria-label={`Modifier ${displayTitle}`}
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#8E8E93]">
                        {metrics.volume != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Dumbbell className="h-3 w-3" />
                            {metrics.volume.toLocaleString('fr-FR')} kg
                          </span>
                        ) : null}
                        {metrics.duration != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {metrics.duration} min
                          </span>
                        ) : metrics.kind !== 'strength' ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Durée non renseignée
                          </span>
                        ) : null}
                        {metrics.kcal != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Flame className="h-3 w-3 text-[#FF9F0A]" />
                            {metrics.kcal} kcal
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#636366]">
                        {exerciseCount} exercice{exerciseCount > 1 ? 's' : ''}
                        {note.exercises[0]?.name ? ` · ${note.exercises[0].name}` : ''}
                        {exerciseCount > 1 ? '…' : ''}
                      </p>
                    </div>
                    <ChevronRight className="relative z-10 h-4 w-4 shrink-0 text-[#636366]" />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <IosSheet
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? deriveSessionDisplayTitle(selected) : 'Séance'}
        subtitle={selectedSubtitle}
        leading={<Dumbbell className="mt-0.5 h-5 w-5 text-[#FF6961]" />}
      >
        {selected && selectedMetrics && (
          <div className="space-y-4 pb-2">
            {selected.details?.kind === 'team' ? (
              <p className="text-[13px] text-[#AEAEB2]">
                {selected.details.sessionType === 'match' ? 'Match' : 'Entraînement'}
                {selected.details.minutesPlayed != null
                  ? ` · ${selected.details.minutesPlayed} min jouées`
                  : null}
                {selected.details.position
                  ? ` · Poste : ${selected.details.position}`
                  : null}
              </p>
            ) : null}
            {selected.details?.kind === 'endurance' &&
            Number.isFinite(selected.details.distanceKm) &&
            selected.details.distanceKm > 0 ? (
              <p className="text-[13px] text-[#AEAEB2]">
                Distance : {selected.details.distanceKm} km
              </p>
            ) : null}
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
                        {setLoadLabel(selectedMetrics.kind, set.reps, set.weightKg)}
                      </span>
                      <span className="text-[11px] font-semibold text-[#AEAEB2]">
                        {DIFF_LABELS[set.difficulty ?? 'ok'] ?? 'OK'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {onEdit && (canEdit?.(selected) ?? true) ? (
              <button
                type="button"
                onClick={() => {
                  const note = selected
                  setSelected(null)
                  onEdit(note)
                }}
                className="ios-press flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#FF2B2B]/35 bg-[#FF2B2B]/12 py-3.5 text-[14px] font-semibold text-[#FF6961]"
              >
                <Pencil className="h-4 w-4" />
                Modifier cette séance
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const id = selected.id
                setSelected(null)
                onDelete(id)
              }}
              className="ios-press flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/12 py-3.5 text-[14px] font-semibold text-[#FF453A]"
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
