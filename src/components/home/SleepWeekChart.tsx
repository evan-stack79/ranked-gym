import { computeTibHours } from '../../sleep-engine'
import type { SleepNightEntry } from '../../services/sleepStorage'
import {
  frenchDayShortLabel,
  hmToMinutes,
  shiftDateKey,
  todayDateKey,
} from '../../utils/sleepTimeFormat'

const RED = '#ff0702'
const GREY = '#636366'

/** Fenêtre visuelle : 22 h → 10 h (12 h), wrap minuit. */
const WINDOW_START = 22 * 60
const WINDOW_SPAN = 12 * 60

interface SleepWeekChartProps {
  nights: SleepNightEntry[]
  today?: string
}

function toWindowOffset(minutes: number): number {
  // minutes since WINDOW_START, wrapping
  let offset = minutes - WINDOW_START
  if (offset < 0) offset += 24 * 60
  return Math.min(WINDOW_SPAN, Math.max(0, offset))
}

/**
 * Barres flottantes bedtime→waketime sur 7 jours.
 * Aujourd’hui en rouge #ff0702, autres en gris. Pas de score.
 */
export function SleepWeekChart({ nights, today = todayDateKey() }: SleepWeekChartProps) {
  const byKey = new Map(nights.map((n) => [n.dateKey, n]))
  const days = Array.from({ length: 7 }, (_, i) => {
    const dateKey = shiftDateKey(today, i - 6)
    return { dateKey, night: byKey.get(dateKey) ?? null, isToday: dateKey === today }
  })

  return (
    <div className="w-full" data-sleep-week-chart>
      <div className="relative flex h-44 gap-2">
        <div
          className="flex w-8 shrink-0 flex-col justify-between pb-5 pt-1 text-right text-[10px] tabular-nums text-[#8E8E93]"
          aria-hidden
        >
          <span>22 h</span>
          <span>2 h</span>
          <span>6 h</span>
          <span>10 h</span>
        </div>
        <div className="flex min-w-0 flex-1 items-stretch gap-1.5">
          {days.map((day) => {
            const night = day.night
            let topPct = 20
            let heightPct = 40
            if (night) {
              const bed = hmToMinutes(night.bedtime)
              const wake = hmToMinutes(night.waketime)
              if (bed != null && wake != null) {
                const start = toWindowOffset(bed)
                let end = toWindowOffset(wake)
                if (end <= start) end = Math.min(WINDOW_SPAN, start + 30)
                topPct = (start / WINDOW_SPAN) * 100
                heightPct = Math.max(8, ((end - start) / WINDOW_SPAN) * 100)
              }
            }
            const tib = night ? computeTibHours(night.bedtime, night.waketime) : null
            return (
              <div key={day.dateKey} className="flex min-w-0 flex-1 flex-col items-center">
                <div className="relative w-full flex-1">
                  {night && tib != null ? (
                    <div
                      className="absolute left-1/2 w-[70%] max-w-[18px] -translate-x-1/2 rounded-full"
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        backgroundColor: day.isToday ? RED : GREY,
                      }}
                      title={`${day.dateKey}`}
                      data-sleep-week-bar={day.isToday ? 'today' : 'past'}
                    />
                  ) : (
                    <div
                      className="absolute bottom-[8%] left-1/2 h-2 w-[70%] max-w-[18px] -translate-x-1/2 rounded-full bg-white/10"
                      data-sleep-week-bar="empty"
                    />
                  )}
                </div>
                <p
                  className={`mt-1 text-[11px] ${
                    day.isToday ? 'font-semibold text-white' : 'text-[#8E8E93]'
                  }`}
                >
                  {frenchDayShortLabel(day.dateKey, today)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
