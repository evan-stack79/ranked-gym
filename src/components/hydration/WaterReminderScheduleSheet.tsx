import { useEffect, useState } from 'react'
import { IosSheet } from '../ui/IosSheet'
import {
  REMINDERS_MAX_PER_DAY,
  isReminderTimeAllowed,
} from '../../shared/hydration'
import {
  defaultReminderTimes,
  sanitizeReminderTimes,
} from '../../services/hydration/hydrationReminders'

interface WaterReminderScheduleSheetProps {
  open: boolean
  times: string[]
  onClose: () => void
  onSave: (times: string[]) => void
}

function sortTimes(times: string[]): string[] {
  return [...times].sort((a, b) => a.localeCompare(b))
}

/**
 * Sous-feuille Horaires — max 3, jamais 21 h–8 h (validé via sanitize / isReminderTimeAllowed).
 */
export function WaterReminderScheduleSheet({
  open,
  times,
  onClose,
  onSave,
}: WaterReminderScheduleSheetProps) {
  const [draft, setDraft] = useState<string[]>(() =>
    sanitizeReminderTimes(times.length ? times : defaultReminderTimes()),
  )
  const [error, setError] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(sanitizeReminderTimes(times.length ? times : defaultReminderTimes()))
    setError(null)
    setEditingIndex(null)
  }, [open, times])

  const canAdd = draft.length < REMINDERS_MAX_PER_DAY

  const removeAt = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const addSlot = () => {
    if (!canAdd) return
    const candidates = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00']
    const next = candidates.find((t) => !draft.includes(t) && isReminderTimeAllowed(t))
    if (!next) {
      setError('Aucun créneau libre entre 8 h et 21 h.')
      return
    }
    setDraft(sortTimes([...draft, next]))
    setError(null)
  }

  const commitEdit = (index: number, value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      setError('Format HH:MM requis.')
      return
    }
    if (!isReminderTimeAllowed(value)) {
      setError('Jamais la nuit (21 h–8 h).')
      return
    }
    if (draft.some((t, i) => i !== index && t === value)) {
      setError('Créneau déjà utilisé.')
      return
    }
    const next = [...draft]
    next[index] = value
    const sanitized = sanitizeReminderTimes(next)
    if (sanitized.length < next.length) {
      setError('Créneau refusé (nuit ou doublon).')
      return
    }
    setDraft(sortTimes(sanitized))
    setEditingIndex(null)
    setError(null)
  }

  const confirm = () => {
    const sanitized = sanitizeReminderTimes(draft)
    if (sanitized.length === 0) {
      setError('Ajoute au moins un créneau entre 8 h et 21 h.')
      return
    }
    if (sanitized.length > REMINDERS_MAX_PER_DAY) {
      setError(`Maximum ${REMINDERS_MAX_PER_DAY} créneaux.`)
      return
    }
    onSave(sanitized)
    onClose()
  }

  return (
    <IosSheet open={open} onClose={onClose} title="Horaires" dismissible>
      <div className="space-y-3 pb-6" data-hydration-reminders-schedule>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {draft.map((t, index) => (
            <div
              key={`${t}-${index}`}
              className="flex h-[60px] items-center gap-3 border-b border-white/10 px-4 last:border-b-0"
              data-hydration-reminder-slot={t}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF0702]/15 text-[#FF0702]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </span>
              {editingIndex === index ? (
                <input
                  type="time"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-[20px] font-bold tabular-nums text-white"
                  defaultValue={t}
                  autoFocus
                  onBlur={(e) => commitEdit(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitEdit(index, (e.target as HTMLInputElement).value)
                    }
                  }}
                />
              ) : (
                <span className="min-w-0 flex-1 text-[24px] font-bold tabular-nums tracking-tight text-white">
                  {t}
                </span>
              )}
              <button
                type="button"
                className="shrink-0 text-[13px] text-[#ACB4BA]"
                onClick={() => setEditingIndex(index)}
              >
                Modifier
              </button>
              <button
                type="button"
                aria-label={`Retirer ${t}`}
                onClick={() => removeAt(index)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2C3032] text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={!canAdd}
          onClick={addSlot}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed text-[14px] font-semibold ${
            canAdd
              ? 'border-white/25 text-white'
              : 'cursor-not-allowed border-[#42484C] text-[#42484C]'
          }`}
          data-hydration-reminder-add
        >
          <span aria-hidden>+</span> Ajouter
        </button>

        <p className="text-center text-[13px] text-[#ACB4BA]">
          Jamais la nuit (21 h–8 h) · {REMINDERS_MAX_PER_DAY} max
        </p>
        {error ? (
          <p className="text-center text-[12px] text-[#FF907F]" data-hydration-reminder-schedule-error>
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={confirm}
          className="btn-brand ios-press mt-2 flex h-[50px] w-full items-center justify-center rounded-2xl text-[16px] font-bold text-white"
          data-hydration-reminder-schedule-ok
        >
          OK
        </button>
      </div>
    </IosSheet>
  )
}
