import { useEffect, useMemo, useState } from 'react'
import { Bell, Info, Moon } from 'lucide-react'
import {
  getRecentSleepNights,
  getSleepSchedule,
  SLEEP_CHANGED_EVENT,
  type SleepNightEntry,
} from '../../services/sleepStorage'
import {
  formatAverageTibLabel,
  formatWakeRegularityLabel,
} from '../../utils/sleepStats'
import { formatClockHm, todayDateKey } from '../../utils/sleepTimeFormat'
import { IosSheet } from '../ui/IosSheet'
import { LogSleepNightSheet } from './LogSleepNightSheet'
import { SleepScheduleSheet } from './SleepScheduleSheet'
import { SleepWeekChart } from './SleepWeekChart'

interface SleepScreenProps {
  open: boolean
  onClose: () => void
}

const RED = '#ff0702'

const INFO_COPY =
  'Repère courant : 8 à 10 h pour les ados (13-18 ans), 7 à 9 h pour les adultes. C’est une info, pas un conseil médical. Tes nuits restent sur ton téléphone et sont effacées avec ton compte.'

/**
 * Écran Sommeil — Ma semaine, heure d’aller dormir, Noter ma nuit.
 * Pas de score /100, pas de mot « Au réveil », pas de message médecin.
 */
export function SleepScreen({ open, onClose }: SleepScreenProps) {
  const [tick, setTick] = useState(0)
  const [infoOpen, setInfoOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [editing, setEditing] = useState<SleepNightEntry | null>(null)

  useEffect(() => {
    if (!open) {
      setInfoOpen(false)
      setLogOpen(false)
      setScheduleOpen(false)
    }
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

  const nights = useMemo(() => getRecentSleepNights(7), [tick])
  const schedule = useMemo(() => getSleepSchedule(), [tick])
  const avgLabel = useMemo(() => formatAverageTibLabel(nights), [nights])
  const regularityLabel = useMemo(() => formatWakeRegularityLabel(nights), [nights])
  const todayNight = nights.find((n) => n.dateKey === todayDateKey()) ?? null

  return (
    <>
      <IosSheet open={open} onClose={onClose} title="Sommeil">
        <div className="space-y-5 pb-4" data-sleep-screen>
          <section className="relative rounded-2xl border border-white/8 bg-[#1C1C1E] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-white">Ma semaine</h3>
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                className="ios-press flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: RED }}
                aria-label="Repères sommeil"
                aria-expanded={infoOpen}
                data-sleep-info
              >
                <Info className="h-4 w-4 text-white" strokeWidth={2.5} aria-hidden />
              </button>
            </div>

            {infoOpen ? (
              <div
                className="mb-3 rounded-xl border border-white/10 bg-[#2C2C2E] px-3 py-2.5 text-[12px] leading-relaxed text-[#E5E5EA]"
                role="note"
                data-sleep-info-bubble
              >
                {INFO_COPY}
              </div>
            ) : null}

            <SleepWeekChart nights={nights} />

            <div className="mt-3 space-y-1 text-[12px] text-[#ACB4BA]">
              {avgLabel ? (
                <p data-sleep-week-avg>
                  Moyenne 7 nuits · <span className="text-white">{avgLabel}</span> au lit
                </p>
              ) : (
                <p>Pas encore assez de nuits pour une moyenne.</p>
              )}
              {regularityLabel ? (
                <p data-sleep-wake-regularity>{regularityLabel}</p>
              ) : nights.length >= 2 ? null : (
                <p>Encore peu de levers pour estimer la régularité.</p>
              )}
            </div>
          </section>

          <section className="flex flex-col items-center text-center">
            <p className="text-[15px] font-medium text-white">Heure d&apos;aller dormir</p>
            <div
              className="mt-3 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: RED }}
              aria-hidden
            >
              <Bell className="h-7 w-7 text-white" strokeWidth={2} />
            </div>
            <p className="mt-3 text-[14px] text-white" data-sleep-bedtime-status>
              {schedule
                ? `activé · ${formatClockHm(schedule.bedtime)}`
                : 'non réglé'}
            </p>
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="ios-press mt-1 min-h-11 px-3 text-[14px] font-semibold"
              style={{ color: RED }}
              data-sleep-open-horaires
            >
              Horaires
            </button>
          </section>

          <button
            type="button"
            onClick={() => {
              setEditing(todayNight)
              setLogOpen(true)
            }}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#2C2C2E] px-4 py-3.5 text-[15px] font-semibold text-white"
            data-sleep-noter
          >
            <Moon className="h-4 w-4" style={{ color: RED }} aria-hidden />
            Noter ma nuit
          </button>
        </div>
      </IosSheet>

      <LogSleepNightSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => setTick((n) => n + 1)}
        initial={editing}
      />
      <SleepScheduleSheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSaved={() => setTick((n) => n + 1)}
      />
    </>
  )
}
