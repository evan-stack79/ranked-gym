import type { WeekDayCell } from '../../utils/trainHub'

interface TrainWeekStripProps {
  days: WeekDayCell[]
}

/**
 * Bande compacte 7 jours — coche uniquement si vraie séance enregistrée.
 * Aujourd’hui : texte blanc, pas de fond rouge translucide.
 */
export function TrainWeekStrip({ days }: TrainWeekStripProps) {
  return (
    <section aria-label="Cette semaine">
      <ol className="grid grid-cols-7 gap-1" role="list">
        {days.map((day) => (
          <li key={day.dateKey} className="min-w-0">
            <div
              className="flex min-h-11 flex-col items-center justify-center px-0.5 py-1"
              aria-label={day.accessibleLabel}
              aria-current={day.isToday ? 'date' : undefined}
            >
              <span
                className={`text-[10px] font-semibold uppercase ${
                  day.isToday ? 'text-white' : 'text-[#636366]'
                }`}
              >
                {day.shortLabel}
              </span>
              <span
                className={`mt-0.5 text-[14px] font-bold tabular-nums ${
                  day.isToday ? 'text-white' : 'text-[#AEAEB2]'
                }`}
              >
                {day.dayNumber}
              </span>
              <span
                className={`mt-1 h-1 w-1 rounded-full ${
                  day.hasSession ? 'bg-[#FF2B2B]' : day.isToday ? 'bg-white/40' : 'bg-transparent'
                }`}
                aria-hidden="true"
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
