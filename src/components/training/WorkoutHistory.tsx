import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Dumbbell, Pencil, Trash2 } from 'lucide-react'
import type { WorkoutNote } from '../../types/training'
import {
  DIFF_LABELS,
  formatClock,
  formatHistoryMetricsLine,
  groupNotesByDate,
  noteDurationMin,
  noteVolumeKg,
} from '../../utils/workoutHistory'
import { resolveSessionKind } from '../../utils/trainHub'
import {
  deriveSessionDisplayTitle,
  formatHistoryExerciseSummary,
} from '../../utils/sessionDisplayTitle'
import { TrainSheet as IosSheet } from './TrainSheet'
import { HistorySessionThumb } from './HistorySessionThumb'

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

  const pageTitle = (
    <h2 className="text-left text-[22px] font-extrabold tracking-tight text-white">
      Historique
    </h2>
  )

  if (groups.length === 0) {
    return (
      <section className="history-page" data-history-page="empty">
        {pageTitle}
        <p className="mt-2 text-left text-[13px] leading-5 text-[#8E8E93]">
          Aucune séance enregistrée. Termine une séance pour la retrouver ici, groupée par
          jour.
        </p>
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
    <section className="history-page" data-history-page="list">
      {pageTitle}

      {groups.map((group) => (
        <div key={group.dateKey} className="mt-5 first:mt-4">
          <p className="text-left text-[12px] font-semibold text-[#8E8E93]">{group.label}</p>
          <ul>
            {group.sessions.map((note) => {
              const metrics = historyMetrics(note)
              const displayTitle = deriveSessionDisplayTitle(note)
              const metricsLine = formatHistoryMetricsLine(metrics)
              const exerciseLine = formatHistoryExerciseSummary(note)
              const isSelected = selected?.id === note.id
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(note)}
                    aria-label={`Voir ${displayTitle}`}
                    data-history-row={note.id}
                    data-history-selected={isSelected ? 'true' : undefined}
                    className={`history-row ios-press flex w-full items-start gap-3 py-2.5 text-left ${
                      isSelected ? 'history-row--active' : ''
                    }`}
                  >
                    <HistorySessionThumb note={note} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 truncate text-[16px] font-extrabold leading-5 text-white">
                          {displayTitle}
                        </span>
                        <time
                          className="shrink-0 pt-0.5 text-[12px] font-medium tabular-nums text-[#8E8E93]"
                          dateTime={new Date(note.createdAt).toISOString()}
                        >
                          {formatClock(note.createdAt)}
                        </time>
                      </span>
                      {metricsLine ? (
                        <span className="mt-0.5 block truncate text-[12px] leading-4 text-[#AEAEB2]">
                          {metricsLine}
                        </span>
                      ) : null}
                      {exerciseLine ? (
                        <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#636366]">
                          {exerciseLine}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#3A3A3C]"
                      aria-hidden="true"
                    />
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
        title={selected ? deriveSessionDisplayTitle(selected) : 'Séance'}
        subtitle={selectedSubtitle}
        leading={<Dumbbell className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        {selected && selectedMetrics && (
          <div className="space-y-4 pb-2" data-history-detail={selected.id}>
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
