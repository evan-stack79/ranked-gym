import { useState } from 'react'
import {
  DEFAULT_REMINDER_TIMES,
  MSG_REMINDER_PAUSE_GOAL,
  MSG_REMINDER_PAUSE_NEUTRAL,
  REMINDERS_MAX_PER_DAY,
} from '../../shared/hydration'
import {
  defaultReminderTimes,
  sanitizeReminderTimes,
  syncHydrationReminders,
} from '../../services/hydration/hydrationReminders'

interface WaterRemindersProps {
  enabled: boolean
  times: string[]
  goalReachedToday: boolean
  /** M7 — mineurs / âge inconnu : pause neutre, jamais « objectif » / réussite. */
  useRepereCopy?: boolean
  onChange: (next: { enabled: boolean; times: string[] }) => void
}

export function WaterReminders({
  enabled,
  times,
  goalReachedToday,
  useRepereCopy = false,
  onChange,
}: WaterRemindersProps) {
  const [error, setError] = useState<string | null>(null)
  const displayTimes = times.length > 0 ? times : defaultReminderTimes()

  const toggle = async (nextEnabled: boolean) => {
    setError(null)
    if (!nextEnabled) {
      await syncHydrationReminders({ enabled: false, times: displayTimes })
      onChange({ enabled: false, times: displayTimes })
      return
    }
    const result = await syncHydrationReminders({
      enabled: true,
      times: sanitizeReminderTimes(displayTimes),
      goalReachedToday,
    })
    if (!result.ok && result.reason === 'PERMISSION_DENIED') {
      setError('Notifications coupées. Active-les dans les Réglages du téléphone.')
      onChange({ enabled: false, times: displayTimes })
      return
    }
    if (!result.ok && result.reason === 'WEB_NO_REMINDERS_V0') {
      setError("Rappels dispo seulement dans l'app.")
      onChange({ enabled: false, times: displayTimes })
      return
    }
    if (!result.ok && result.reason === 'PLUGIN_MISSING') {
      setError('Pas encore de rappels sur ce téléphone.')
      onChange({ enabled: false, times: displayTimes })
      return
    }
    onChange({ enabled: true, times: sanitizeReminderTimes(displayTimes) })
  }

  return (
    <div className="space-y-3" data-hydration-reminders>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-white">Rappels d’eau</p>
          <p className="text-[12px] text-[#8E8E93]">
            {REMINDERS_MAX_PER_DAY} max par jour. Jamais de 21 h à 8 h.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => void toggle(!enabled)}
          className={`relative h-8 w-14 rounded-full transition-colors ${
            enabled ? 'bg-[#FF0702]' : 'bg-[#3A3A3C]'
          }`}
          data-hydration-reminders-toggle
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <p className="text-[12px] text-[#8E8E93]">
        Heures : {(displayTimes.length ? displayTimes : DEFAULT_REMINDER_TIMES).join(' · ')}
      </p>
      {goalReachedToday && enabled ? (
        <p
          className="text-[12px] text-[#C7C7CC]"
          data-hydration-reminder-pause={useRepereCopy ? 'repere' : 'goal'}
        >
          {useRepereCopy ? MSG_REMINDER_PAUSE_NEUTRAL : MSG_REMINDER_PAUSE_GOAL}
        </p>
      ) : null}
      {error ? <p className="text-[12px] text-[#C7C7CC]">{error}</p> : null}
    </div>
  )
}
