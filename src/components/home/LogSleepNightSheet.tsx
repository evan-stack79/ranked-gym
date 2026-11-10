import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { saveSleepNight, type SleepNightEntry, getSleepSchedule } from '../../services/sleepStorage'
import { formatClockHm, todayDateKey } from '../../utils/sleepTimeFormat'
import { IosSheet } from '../ui/IosSheet'
import { SleepClockDial } from './SleepClockDial'

interface LogSleepNightSheetProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Prefill when editing an existing night */
  initial?: SleepNightEntry | null
  /** Optional override dateKey (defaults to today / initial). */
  dateKey?: string
  title?: string
}

const RED = '#ff0702'

/**
 * Saisie « Ta nuit » — cadran 24 h (coucher / lever).
 * Pas de TST inventé ; pas de texte « Au réveil ».
 */
export function LogSleepNightSheet({
  open,
  onClose,
  onSaved,
  initial,
  dateKey,
  title = 'Ta nuit',
}: LogSleepNightSheetProps) {
  const [bedtime, setBedtime] = useState('23:00')
  const [waketime, setWaketime] = useState('07:00')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setBedtime(initial.bedtime)
      setWaketime(initial.waketime)
    } else {
      const schedule = getSleepSchedule()
      setBedtime(schedule?.bedtime ?? '23:00')
      setWaketime(schedule?.waketime ?? '07:00')
    }
    setError(null)
  }, [open, initial])

  const handleSave = () => {
    setError(null)
    const saved = saveSleepNight({
      bedtime,
      waketime,
      tstHours: initial?.tstHours ?? null,
      feelingLevel: initial?.feelingLevel ?? null,
      dateKey: dateKey ?? initial?.dateKey ?? todayDateKey(),
      source: 'manual',
    })
    if (!saved) {
      setError('Impossible d’enregistrer — vérifie tes horaires.')
      return
    }
    onClose()
    queueMicrotask(() => onSaved())
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={title}
      scrollLocked
      footer={
        <button
          type="button"
          onClick={handleSave}
          className="ios-press w-full rounded-2xl px-4 py-3.5 text-[16px] font-semibold text-white"
          style={{ backgroundColor: RED }}
          data-sleep-log-save
        >
          Enregistrer
        </button>
      }
    >
      <div className="space-y-4 pb-2" data-sleep-log-sheet>
        <SleepClockDial
          bedtime={bedtime}
          waketime={waketime}
          onChange={({ bedtime: b, waketime: w }) => {
            setBedtime(b)
            setWaketime(w)
            setError(null)
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/8 bg-[#1C1C1E] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[12px] text-[#ACB4BA]">
              <Moon className="h-3.5 w-3.5" style={{ color: RED }} aria-hidden />
              Coucher
            </p>
            <p className="mt-1 text-[22px] font-bold tabular-nums text-white">
              {formatClockHm(bedtime)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#1C1C1E] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[12px] text-[#ACB4BA]">
              <Sun className="h-3.5 w-3.5" style={{ color: RED }} aria-hidden />
              Lever
            </p>
            <p className="mt-1 text-[22px] font-bold tabular-nums text-white">
              {formatClockHm(waketime)}
            </p>
          </div>
        </div>

        {error ? <p className="text-[13px] text-[#FF907F]">{error}</p> : null}
      </div>
    </IosSheet>
  )
}
