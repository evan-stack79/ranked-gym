import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IosSheet } from '../ui/IosSheet'
import { dateFromKey, dateKeyFromDate, monthDays } from '../../utils/nutritionDate'

interface NutritionCalendarSheetProps {
  open: boolean
  selectedDateKey: string
  dataDateKeys: string[]
  onClose: () => void
  onSelect: (dateKey: string) => void
  onToday: () => void
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function NutritionCalendarSheet({
  open,
  selectedDateKey,
  dataDateKeys,
  onClose,
  onSelect,
  onToday,
}: NutritionCalendarSheetProps) {
  const [month, setMonth] = useState(() => dateFromKey(selectedDateKey))
  const dataKeys = new Set(dataDateKeys)

  useEffect(() => {
    if (open) setMonth(dateFromKey(selectedDateKey))
  }, [open, selectedDateKey])

  const days = monthDays(month)
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month)

  return (
    <IosSheet open={open} onClose={onClose} title="Choisir un jour" subtitle="Repas et hydratation">
      <div className="space-y-4 pb-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full text-[#AEAEB2]"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-[16px] font-semibold capitalize text-white">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full text-[#AEAEB2]"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#636366]">
          {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {days.map((day, index) => {
            if (Number.isNaN(day.getTime())) return <span key={`empty-${index}`} className="h-11" />
            const key = dateKeyFromDate(day)
            const selected = key === selectedDateKey
            const today = key === dateKeyFromDate(new Date())
            const hasData = dataKeys.has(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onSelect(key); onClose() }}
                aria-label={`Sélectionner le ${day.getDate()}`}
                aria-pressed={selected}
                className={`relative mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-[14px] tabular-nums ${
                  selected ? 'bg-[#FF2B2B] font-bold text-white' : 'text-[#EBEBF5]'
                } ${today && !selected ? 'ring-1 ring-[#8E8E93]' : ''}`}
              >
                <span>{day.getDate()}</span>
                {hasData ? <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? 'bg-white' : 'bg-[#FF2B2B]'}`} /> : null}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => { onToday(); onClose() }}
          className="ios-press flex w-full items-center justify-center py-2 text-[13px] font-semibold text-[#FF6B6B]"
        >
          Aujourd’hui
        </button>
      </div>
    </IosSheet>
  )
}