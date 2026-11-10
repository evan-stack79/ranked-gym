import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getSleepSchedule, saveSleepSchedule } from '../../services/sleepStorage'
import { formatClockHm } from '../../utils/sleepTimeFormat'
import { IosSheet } from '../ui/IosSheet'
import { SleepClockDial } from './SleepClockDial'

interface SleepScheduleSheetProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

const RED = '#ff0702'

/**
 * « Tes horaires » — cadran pour coucher / lever prévus (une fois).
 * Aucune alarme, aucun son, aucune notif nocturne.
 */
export function SleepScheduleSheet({ open, onClose, onSaved }: SleepScheduleSheetProps) {
  const [bedtime, setBedtime] = useState('23:00')
  const [waketime, setWaketime] = useState('07:30')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const schedule = getSleepSchedule()
    setBedtime(schedule?.bedtime ?? '23:00')
    setWaketime(schedule?.waketime ?? '07:30')
    setError(null)
  }, [open])

  const handleSave = () => {
    setError(null)
    const saved = saveSleepSchedule({ bedtime, waketime })
    if (!saved) {
      setError('Impossible d’enregistrer — vérifie tes horaires.')
      return
    }
    onClose()
    queueMicrotask(() => onSaved?.())
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title="Tes horaires"
      scrollLocked
      footer={
        <button
          type="button"
          onClick={handleSave}
          className="ios-press w-full rounded-2xl px-4 py-3.5 text-[16px] font-semibold text-white"
          style={{ backgroundColor: RED }}
          data-sleep-schedule-save
        >
          Enregistrer
        </button>
      }
    >
      <div className="space-y-4 pb-2" data-sleep-schedule-sheet>
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
