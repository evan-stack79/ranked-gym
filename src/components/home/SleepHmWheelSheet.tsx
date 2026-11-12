import { useEffect, useMemo, useRef, useState } from 'react'
import { IosSheet } from '../ui/IosSheet'
import {
  readSleepWheelCenteredValue,
  SleepTimeWheelColumn,
} from './SleepTimeWheelColumn'

const RED = '#ff0702'
const ROW = '#2C2C2E'

interface SleepHmWheelSheetProps {
  open: boolean
  onClose: () => void
  title: string
  valueHm: string
  onSave: (hm: string) => void
}

/**
 * Roues HH:MM façon Horloge iOS — Coucher / Réveil.
 * Commit lit la position de scroll (pas seulement React state).
 */
export function SleepHmWheelSheet({
  open,
  onClose,
  title,
  valueHm,
  onSave,
}: SleepHmWheelSheetProps) {
  const [hour, setHour] = useState(23)
  const [minute, setMinute] = useState(0)
  const wheelsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const m = /^(\d{1,2}):(\d{2})$/.exec(valueHm.trim())
    if (m) {
      setHour(Number(m[1]) % 24)
      setMinute(Number(m[2]) % 60)
    }
  }, [open, valueHm])

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])

  const commitHm = () => {
    const root = wheelsRef.current
    const hourCol = root?.querySelector(
      '[data-sleep-wheel-column][aria-label="Heures"]',
    ) as HTMLElement | null
    const minuteCol = root?.querySelector(
      '[data-sleep-wheel-column][aria-label="Minutes"]',
    ) as HTMLElement | null
    const h = readSleepWheelCenteredValue(hourCol, hours) ?? hour
    const min = readSleepWheelCenteredValue(minuteCol, minutes) ?? minute
    onSave(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
    onClose()
  }

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={title}
      leading={
        <button type="button" onClick={onClose} className="ios-press text-[17px]" style={{ color: RED }}>
          Annuler
        </button>
      }
      footer={
        <button
          type="button"
          onClick={commitHm}
          className="ios-press w-full rounded-2xl px-4 py-3.5 text-[16px] font-semibold text-white"
          style={{ backgroundColor: RED }}
          data-sleep-hm-save
        >
          Enregistrer
        </button>
      }
    >
      <div
        ref={wheelsRef}
        className="relative flex items-center justify-center gap-2 py-2"
        data-sleep-hm-wheels
      >
        <div
          className="pointer-events-none absolute left-4 right-4 top-1/2 h-[44px] -translate-y-1/2 rounded-xl"
          style={{ backgroundColor: ROW }}
          aria-hidden
        />
        <SleepTimeWheelColumn values={hours} value={hour} onChange={setHour} ariaLabel="Heures" />
        <span className="relative z-[1] text-[28px] font-semibold text-white">:</span>
        <SleepTimeWheelColumn
          values={minutes}
          value={minute}
          onChange={setMinute}
          ariaLabel="Minutes"
        />
      </div>
    </IosSheet>
  )
}
