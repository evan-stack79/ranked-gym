import { useEffect, useMemo, useState } from 'react'
import { IosSheet } from '../ui/IosSheet'

const RED = '#ff0702'
const ROW = '#2C2C2E'
const GRAY = '#ACB4BA'

function WheelColumn({
  values,
  value,
  onChange,
  ariaLabel,
}: {
  values: number[]
  value: number
  onChange: (n: number) => void
  ariaLabel: string
}) {
  return (
    <div
      className="relative h-[180px] w-[72px] overflow-y-auto snap-y snap-mandatory"
      style={{ scrollbarWidth: 'none' }}
      aria-label={ariaLabel}
      role="listbox"
    >
      <div className="h-[68px]" aria-hidden />
      {values.map((n) => {
        const selected = n === value
        return (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(n)}
            className="flex h-[44px] w-full snap-center items-center justify-center tabular-nums"
            style={{
              color: selected ? '#FFFFFF' : GRAY,
              fontSize: selected ? 28 : 22,
              fontWeight: selected ? 600 : 400,
              opacity: selected ? 1 : 0.45,
            }}
          >
            {String(n).padStart(2, '0')}
          </button>
        )
      })}
      <div className="h-[68px]" aria-hidden />
    </div>
  )
}

interface SleepHmWheelSheetProps {
  open: boolean
  onClose: () => void
  title: string
  valueHm: string
  onSave: (hm: string) => void
}

/**
 * Roues HH:MM façon Horloge iOS — Coucher / Réveil.
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
          onClick={() => {
            onSave(
              `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            )
            onClose()
          }}
          className="ios-press w-full rounded-2xl px-4 py-3.5 text-[16px] font-semibold text-white"
          style={{ backgroundColor: RED }}
          data-sleep-hm-save
        >
          Enregistrer
        </button>
      }
    >
      <div className="relative flex items-center justify-center gap-2 py-2" data-sleep-hm-wheels>
        <div
          className="pointer-events-none absolute left-4 right-4 top-1/2 h-[44px] -translate-y-1/2 rounded-xl"
          style={{ backgroundColor: ROW }}
          aria-hidden
        />
        <WheelColumn values={hours} value={hour} onChange={setHour} ariaLabel="Heures" />
        <span className="relative z-[1] text-[28px] font-semibold text-white">:</span>
        <WheelColumn values={minutes} value={minute} onChange={setMinute} ariaLabel="Minutes" />
      </div>
    </IosSheet>
  )
}
