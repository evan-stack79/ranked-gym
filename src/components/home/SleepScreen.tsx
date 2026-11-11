import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import {
  getBedtimeReminderEnabled,
  getSleepSchedule,
  setBedtimeReminderEnabled,
  SLEEP_CHANGED_EVENT,
} from '../../services/sleepStorage'
import { formatClockHm } from '../../utils/sleepTimeFormat'
import { IosSheet } from '../ui/IosSheet'
import { SleepNightSummaryCard } from './SleepNightSummaryCard'
import { SleepScheduleSheet } from './SleepScheduleSheet'

interface SleepScreenProps {
  open: boolean
  onClose: () => void
}

const RED = '#ff0702'
const CARD_BG = '#1C1C1E'

/**
 * Écran Sommeil v10 — résumé partagé + ligne « Heure d'aller dormir » + interrupteur.
 * Pas d’axe 22 h/2 h, pas de doublon Horaires / Noter / cloche.
 */
export function SleepScreen({ open, onClose }: SleepScreenProps) {
  const [tick, setTick] = useState(0)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  useEffect(() => {
    if (!open) setScheduleOpen(false)
  }, [open])

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener(SLEEP_CHANGED_EVENT, sync)
    window.addEventListener('ranked-gym:backup-restored', sync)
    return () => {
      window.removeEventListener(SLEEP_CHANGED_EVENT, sync)
      window.removeEventListener('ranked-gym:backup-restored', sync)
    }
  }, [])

  const schedule = useMemo(() => getSleepSchedule(), [tick])
  const reminderOn = useMemo(() => getBedtimeReminderEnabled(), [tick])
  const hasSchedule = schedule != null

  const onToggleReminder = () => {
    if (!hasSchedule) {
      setScheduleOpen(true)
      return
    }
    setBedtimeReminderEnabled(!reminderOn)
  }

  return (
    <>
      <IosSheet open={open} onClose={onClose} title="Sommeil">
        <div className="space-y-4 pb-4" data-sleep-screen>
          {!hasSchedule ? (
            <section
              className="flex items-center gap-3 rounded-[22px] p-4"
              style={{ backgroundColor: CARD_BG }}
              data-sleep-empty-hint
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/40"
                aria-hidden
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: RED }}
                >
                  <Bell className="h-4 w-4 text-white" strokeWidth={2} />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-white">
                  Tes nuits se notent toutes seules.
                </p>
                <p className="mt-0.5 text-[13px] text-[#ACB4BA]">Règle tes horaires une fois.</p>
              </div>
            </section>
          ) : null}

          <SleepNightSummaryCard variant="sommeil" showAction={hasSchedule} />

          {hasSchedule ? (
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="ios-press flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left"
              style={{ backgroundColor: CARD_BG }}
              data-sleep-bedtime-row
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: RED }}
                aria-hidden
              >
                <Bell className="h-5 w-5 text-white" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">
                  Heure d&apos;aller dormir
                </span>
                <span className="mt-0.5 block text-[13px] text-[#ACB4BA]" data-sleep-bedtime-status>
                  {formatClockHm(schedule!.bedtime)} · lever {formatClockHm(schedule!.waketime)}
                </span>
              </span>
              <span
                role="switch"
                aria-checked={reminderOn}
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleReminder()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onToggleReminder()
                  }
                }}
                className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors"
                style={{ backgroundColor: reminderOn ? RED : '#39393D' }}
                data-sleep-bedtime-toggle={reminderOn ? 'on' : 'off'}
              >
                <span
                  className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow"
                  style={{
                    left: reminderOn ? 22 : 2,
                    transition: 'left 180ms ease',
                  }}
                />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="ios-press w-full rounded-2xl py-3.5 text-[16px] font-semibold text-white"
              style={{ backgroundColor: RED }}
              data-sleep-setup-horaires
            >
              Régler mes horaires
            </button>
          )}
        </div>
      </IosSheet>

      <SleepScheduleSheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSaved={() => {
          setTick((n) => n + 1)
          if (!getBedtimeReminderEnabled()) setBedtimeReminderEnabled(true)
        }}
      />
    </>
  )
}
