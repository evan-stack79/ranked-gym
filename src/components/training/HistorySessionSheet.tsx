import { useEffect, useId, useRef, useState } from 'react'
import { Ellipsis, Trash2 } from 'lucide-react'
import type { WorkoutNote } from '../../types/training'
import {
  deriveSessionDisplayTitle,
  resolveExerciseDisplayName,
} from '../../utils/sessionDisplayTitle'
import {
  formatHistoryDetailDateLine,
  formatHistoryDetailMetric,
  formatSetEffortLabel,
  formatSetRepsLabel,
  formatSetWeightLabel,
  historySessionMetrics,
} from '../../utils/historySessionDetail'
import { TrainSheet } from './TrainSheet'

interface HistorySessionSheetProps {
  note: WorkoutNote | null
  onClose: () => void
  onDelete: (id: string) => void | Promise<void>
  onEdit?: (note: WorkoutNote) => void
  canEdit?: (note: WorkoutNote) => boolean
}

export function HistorySessionSheet({
  note,
  onClose,
  onDelete,
  onEdit,
  canEdit,
}: HistorySessionSheetProps) {
  const cachedRef = useRef<WorkoutNote | null>(note)
  if (note) cachedRef.current = note
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deletingRef = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmTitleId = useId()
  const confirmDescId = useId()
  const current = note ?? cachedRef.current

  useEffect(() => {
    setMenuOpen(false)
    setConfirmOpen(false)
    setDeleting(false)
    setDeleteError(null)
    deletingRef.current = false
  }, [note?.id])

  useEffect(() => {
    if (!confirmOpen) return
    cancelRef.current?.focus()
  }, [confirmOpen])

  const metrics = current ? historySessionMetrics(current) : null
  const title = current ? deriveSessionDisplayTitle(current) : 'Séance'
  const canModify = Boolean(current && onEdit && (canEdit?.(current) ?? true))

  const requestClose = () => {
    if (deletingRef.current) return
    if (confirmOpen) {
      setConfirmOpen(false)
      return
    }
    setMenuOpen(false)
    onClose()
  }

  const handleEdit = () => {
    if (!current || !onEdit || !canModify) return
    setMenuOpen(false)
    onClose()
    onEdit(current)
  }

  const handleConfirmDelete = async () => {
    if (!current || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(current.id)
      setConfirmOpen(false)
      onClose()
    } catch {
      setDeleteError('Impossible de supprimer cette séance.')
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const exercises = current?.exercises ?? []
  const namedCount = exercises.filter(
    (ex) => Boolean(ex.canonicalExerciseId?.trim()) || Boolean(ex.name?.trim()),
  ).length

  return (
    <TrainSheet
      open={note != null}
      onClose={requestClose}
      title={title}
      subtitle={current ? formatHistoryDetailDateLine(current) : undefined}
      tone="graphite"
      dismissible={!deleting}
      headerActions={
        <div className="relative">
          <button
            type="button"
            className="ios-press flex min-h-11 min-w-11 items-center justify-center text-[#AEAEB2]"
            aria-label="Actions de la séance"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-history-menu-trigger
            disabled={deleting}
            onClick={() => {
              setConfirmOpen(false)
              setMenuOpen((open) => !open)
            }}
          >
            <Ellipsis className="h-5 w-5" strokeWidth={2} />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              data-history-edit-menu
              className="absolute right-0 top-full z-20 min-w-[11.5rem] rounded-xl border border-[#2C2C2E] bg-[#111113] py-1"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!canModify}
                data-history-edit-available={canModify ? 'true' : 'false'}
                onClick={handleEdit}
                className="flex min-h-11 w-full items-center px-3 text-left text-[14px] text-white disabled:text-[#636366]"
              >
                Modifier la séance
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      {note && current && metrics ? (
        <div className="relative flex min-h-full flex-col pb-2" data-history-detail={current.id}>
          {confirmOpen ? (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={confirmTitleId}
              aria-describedby={confirmDescId}
              data-history-delete-confirm
              className="flex flex-1 flex-col pt-2"
            >
              <p id={confirmTitleId} className="text-[16px] font-semibold text-white">
                Supprimer cette séance ?
              </p>
              <p id={confirmDescId} className="mt-1.5 text-[13px] leading-5 text-[#AEAEB2]">
                Cette action est définitive et supprimera cette séance de ton historique.
              </p>
              {deleteError ? (
                <p className="mt-3 text-[12px] text-[#FF453A]" data-history-delete-error>
                  {deleteError}
                </p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <button
                  ref={cancelRef}
                  type="button"
                  data-history-confirm-cancel
                  disabled={deleting}
                  onClick={() => setConfirmOpen(false)}
                  className="ios-press flex min-h-11 flex-1 items-center justify-center text-[14px] font-medium text-[#AEAEB2]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-history-confirm-delete
                  disabled={deleting}
                  onClick={() => void handleConfirmDelete()}
                  className="ios-press flex min-h-11 flex-1 items-center justify-center text-[14px] font-semibold text-[#FF453A]"
                >
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          ) : (
            <>
          <div
            className="grid grid-cols-3 gap-2 border-b border-[#161618] pb-3"
            data-history-detail-summary
          >
            <div>
              <p className="text-[11px] font-medium text-[#8E8E93]">Durée</p>
              <p className="mt-0.5 text-[14px] tabular-nums text-white" data-history-metric="duration">
                {formatHistoryDetailMetric('duration', metrics.duration)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#8E8E93]">Volume</p>
              <p className="mt-0.5 text-[14px] tabular-nums text-white" data-history-metric="volume">
                {formatHistoryDetailMetric('volume', metrics.volume)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#8E8E93]">Calories</p>
              <p className="mt-0.5 text-[14px] tabular-nums text-white" data-history-metric="kcal">
                {formatHistoryDetailMetric('kcal', metrics.kcal)}
              </p>
            </div>
          </div>

          {current.details?.kind === 'team' ? (
            <p className="mt-3 text-[13px] text-[#AEAEB2]">
              {current.details.sessionType === 'match' ? 'Match' : 'Entraînement'}
              {current.details.minutesPlayed != null
                ? ` · ${current.details.minutesPlayed} min jouées`
                : null}
              {current.details.position ? ` · Poste : ${current.details.position}` : null}
            </p>
          ) : null}
          {current.details?.kind === 'endurance' &&
          Number.isFinite(current.details.distanceKm) &&
          current.details.distanceKm > 0 ? (
            <p className="mt-3 text-[13px] text-[#AEAEB2]">
              Distance : {current.details.distanceKm} km
            </p>
          ) : null}

          <section className="mt-4 min-h-0 flex-1" aria-label="Séries">
            <h3 className="text-[13px] font-semibold text-white">Séries</h3>
            {exercises.length === 0 ? (
              <p className="mt-2 text-[13px] text-[#8E8E93]">—</p>
            ) : (
              <div className="mt-2 space-y-4">
                {exercises.map((exercise) => {
                  const exerciseName = resolveExerciseDisplayName(exercise) || 'Exercice'
                  const showHeading =
                    namedCount > 1 || (namedCount === 1 && exerciseName !== title)
                  return (
                    <div key={exercise.id} data-history-exercise={exercise.id}>
                      {showHeading ? (
                        <p className="mb-1.5 text-[13px] font-medium text-[#AEAEB2]">{exerciseName}</p>
                      ) : null}
                      {exercise.sets.length === 0 ? (
                        <p className="text-[13px] text-[#8E8E93]">—</p>
                      ) : (
                        <table className="w-full table-fixed border-collapse text-left">
                          <thead>
                            <tr className="text-[11px] font-medium text-[#8E8E93]">
                              <th scope="col" className="w-[18%] py-1 pr-2 font-medium">
                                Série
                              </th>
                              <th scope="col" className="w-[24%] py-1 pr-2 font-medium">
                                Poids
                              </th>
                              <th scope="col" className="w-[34%] py-1 pr-2 font-medium">
                                Répétitions
                              </th>
                              <th scope="col" className="w-[24%] py-1 font-medium">
                                Effort
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {exercise.sets.map((set, idx) => (
                              <tr
                                key={`${exercise.id}-${idx}`}
                                className="border-t border-[#161618] text-[13px] text-white"
                                data-history-set-row={`${exercise.id}-${idx}`}
                              >
                                <td className="py-2 pr-2 tabular-nums text-[#AEAEB2]">{idx + 1}</td>
                                <td className="py-2 pr-2 tabular-nums" data-history-set="weight">
                                  {formatSetWeightLabel(metrics.kind, set.weightKg)}
                                </td>
                                <td className="py-2 pr-2 tabular-nums" data-history-set="reps">
                                  {formatSetRepsLabel(metrics.kind, set.reps)}
                                </td>
                                <td className="py-2 tabular-nums" data-history-set="effort">
                                  {formatSetEffortLabel(metrics.kind, set)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {deleteError ? (
            <p className="mt-3 text-center text-[12px] text-[#FF453A]" data-history-delete-error>
              {deleteError}
            </p>
          ) : null}

          <button
            type="button"
            data-history-delete
            disabled={deleting}
            onClick={() => {
              setMenuOpen(false)
              setDeleteError(null)
              setConfirmOpen(true)
            }}
            className="ios-press mt-5 flex min-h-11 w-full items-center justify-center gap-1.5 text-[13px] text-[#FF453A]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Supprimer la séance
          </button>
            </>
          )}
        </div>
      ) : null}
    </TrainSheet>
  )
}
