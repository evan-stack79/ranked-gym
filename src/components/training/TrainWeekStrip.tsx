import type { WeekDayCell } from '../../utils/trainHub'

interface TrainWeekStripProps {
  days: WeekDayCell[]
}

/**
 * Bande compacte 7 jours — coche uniquement si vraie séance enregistrée.
 */
export function TrainWeekStrip({ days }: TrainWeekStripProps) {
  return (
    <section aria-label="Cette semaine">
      <p className="mb-3 text-[13px] font-semibold text-[#8E8E93]">Cette semaine</p>
      <ol className="grid grid-cols-7 gap-1.5" role="list">
        {days.map((day) => (
          <li key={day.dateKey} className="min-w-0">
            <div
              className={`flex min-h-11 flex-col items-center justify-center rounded-2xl border px-0.5 py-2 ${
                day.isToday
                  ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/12'
                  : 'border-white/8 bg-[#141416]'
              }`}
              aria-label={day.accessibleLabel}
              aria-current={day.isToday ? 'date' : undefined}
            >
              <span
                className={`text-[10px] font-semibold uppercase ${
                  day.isToday ? 'text-[#FF6961]' : 'text-[#636366]'
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
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  day.hasSession ? 'bg-[#FF2B2B]' : 'bg-transparent'
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
