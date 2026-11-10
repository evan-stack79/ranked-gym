import { useRef, useState } from 'react'
import {
  MSG_REMINDER_PAUSE_GOAL,
  MSG_REMINDER_PAUSE_NEUTRAL,
} from '../../shared/hydration'
import {
  defaultReminderTimes,
  sanitizeReminderTimes,
  syncHydrationReminders,
} from '../../services/hydration/hydrationReminders'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { pressIn, pressOut } from '../../motion/brandPress'

interface WaterReminderBellProps {
  enabled: boolean
  times: string[]
  goalReachedToday: boolean
  useRepereCopy?: boolean
  onChange: (next: { enabled: boolean; times: string[] }) => void
  onOpenSchedule: () => void
}

const BELL_ON = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" fill="#fff" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)

const BELL_OFF = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
    <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    <path d="m2 2 20 20" />
  </svg>
)

/**
 * Cloche B v2 — à droite de la colonne d’eau.
 * Tap = on/off ; appui long / lien Horaires = feuille créneaux.
 */
export function WaterReminderBell({
  enabled,
  times,
  goalReachedToday,
  useRepereCopy = false,
  onChange,
  onOpenSchedule,
}: WaterReminderBellProps) {
  const reduced = usePrefersReducedMotion()
  const [error, setError] = useState<string | null>(null)
  const [ringing, setRinging] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const displayTimes = times.length > 0 ? times : defaultReminderTimes()

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

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
    if (!result.ok) {
      if (result.reason === 'PERMISSION_DENIED') {
        setError('Les notifications sont refusées. Tu peux les réactiver dans les réglages du téléphone.')
      } else if (result.reason === 'WEB_NO_REMINDERS_V0') {
        setError('Les rappels sont disponibles dans l’app iOS / Android.')
      } else if (result.reason === 'PLUGIN_MISSING') {
        setError('Les rappels locaux ne sont pas encore branchés sur cet appareil.')
      }
      onChange({ enabled: false, times: displayTimes })
      return
    }
    onChange({ enabled: true, times: sanitizeReminderTimes(displayTimes) })
    if (!reduced) {
      setRinging(true)
      window.setTimeout(() => setRinging(false), 360)
    }
  }

  return (
    <div
      className="flex w-[104px] shrink-0 flex-col items-center"
      data-hydration-reminders
      data-hydration-reminders-bell
    >
      <button
        ref={bellRef}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Couper les rappels' : 'Activer les rappels'}
        data-hydration-reminders-toggle
        className={`rg-water-bell flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full ${
          enabled ? 'rg-water-bell--on' : 'rg-water-bell--off'
        }`}
        onPointerDown={(e) => {
          if (e.button != null && e.button !== 0) return
          longPressFired.current = false
          if (bellRef.current) void pressIn(bellRef.current, reduced)
          clearLongPress()
          longPressTimer.current = window.setTimeout(() => {
            longPressFired.current = true
            onOpenSchedule()
          }, 480)
        }}
        onPointerUp={(e) => {
          clearLongPress()
          if (bellRef.current) void pressOut(bellRef.current, reduced)
          if (longPressFired.current) return
          if (e.button != null && e.button !== 0) return
          void toggle(!enabled)
        }}
        onPointerCancel={() => {
          clearLongPress()
          if (bellRef.current) void pressOut(bellRef.current, reduced)
        }}
        onPointerLeave={() => {
          clearLongPress()
          if (bellRef.current) void pressOut(bellRef.current, reduced)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onOpenSchedule()
        }}
      >
        <span
          className={`rg-water-bell__ic flex ${ringing && !reduced ? 'rg-water-bell__ic--ring' : ''}`}
        >
          {enabled ? BELL_ON : BELL_OFF}
        </span>
      </button>
      <p
        className={`mt-2.5 max-w-[104px] text-center text-[12px] font-semibold leading-tight ${
          enabled ? 'text-white' : 'text-[#ACB4BA]'
        }`}
        data-hydration-reminders-status
      >
        {enabled ? 'Rappels activés' : 'Rappels coupés'}
      </p>
      <button
        type="button"
        onClick={onOpenSchedule}
        className="mt-1 text-[13px] font-semibold text-[#FF0702]"
        data-hydration-reminders-schedule-link
      >
        Horaires
      </button>
      {goalReachedToday && enabled ? (
        <p
          className="mt-2 max-w-[104px] text-center text-[11px] leading-snug text-[#C7C7CC]"
          data-hydration-reminder-pause={useRepereCopy ? 'repere' : 'goal'}
        >
          {useRepereCopy ? MSG_REMINDER_PAUSE_NEUTRAL : MSG_REMINDER_PAUSE_GOAL}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 max-w-[104px] text-center text-[11px] leading-snug text-[#C7C7CC]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
