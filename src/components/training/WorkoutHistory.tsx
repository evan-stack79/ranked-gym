import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { WorkoutNote } from '../../types/training'
import {
  formatClock,
  formatHistoryMetricsLine,
  groupNotesByDate,
} from '../../utils/workoutHistory'
import { historySessionMetrics } from '../../utils/historySessionDetail'
import {
  deriveSessionDisplayTitle,
  formatHistoryExerciseSummary,
} from '../../utils/sessionDisplayTitle'
import { HistorySessionThumb } from './HistorySessionThumb'
import { HistorySessionSheet } from './HistorySessionSheet'

interface WorkoutHistoryProps {
  notes: WorkoutNote[]
  onDelete: (id: string) => void | Promise<void>
  onEdit?: (note: WorkoutNote) => void
  /** Filtre optionnel — masque l’action Éditer si false. */
  canEdit?: (note: WorkoutNote) => boolean
  /** Ouvre le détail d’une séance (hub « Dernières séances »). */
  focusNoteId?: string | null
  onFocusConsumed?: () => void
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

  return (
    <section className="history-page" data-history-page="list">
      {pageTitle}

      {groups.map((group) => (
        <div key={group.dateKey} className="mt-5 first:mt-4">
          <p className="text-left text-[12px] font-semibold text-[#8E8E93]">{group.label}</p>
          <ul>
            {group.sessions.map((note) => {
              const metrics = historySessionMetrics(note)
              const displayTitle = deriveSessionDisplayTitle(note)
              const metricsLine = formatHistoryMetricsLine(metrics)
              const exerciseLine = formatHistoryExerciseSummary(note)
              const isSelected = selected?.id === note.id
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.currentTarget.focus()
                      setSelected(note)
                    }}
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

      <HistorySessionSheet
        note={selected}
        onClose={() => setSelected(null)}
        onDelete={onDelete}
        onEdit={onEdit}
        canEdit={canEdit}
      />
    </section>
  )
}
