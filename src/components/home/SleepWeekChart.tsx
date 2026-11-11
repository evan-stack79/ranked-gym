import { computeTibHours } from '../../sleep-engine'
import type { SleepNightEntry } from '../../services/sleepStorage'
import { getSleepGoalHours } from '../../services/sleepStorage'
import {
  frenchDayLetter,
  shiftDateKey,
  todayDateKey,
} from '../../utils/sleepTimeFormat'
import { averageTibHours, formatAverageTibLabel } from '../../utils/sleepStats'

const RED = '#ff0702'
const GREY = '#3A3A3C'

interface SleepWeekChartProps {
  nights: SleepNightEntry[]
  today?: string
  /** Affiche la moyenne une seule fois sous les barres. */
  showAverage?: boolean
  compact?: boolean
}

/**
 * 7 barres de durée (pas d’axe 22 h / 2 h / 6 h / 10 h).
 * Nuit en cours rouge (~10 %), autres gris. Pas de chiffres au-dessus.
 */
export function SleepWeekChart({
  nights,
  today = todayDateKey(),
  showAverage = true,
  compact = false,
}: SleepWeekChartProps) {
  const byKey = new Map(nights.map((n) => [n.dateKey, n]))
  const goal = getSleepGoalHours()
  const days = Array.from({ length: 7 }, (_, i) => {
    const dateKey = shiftDateKey(today, i - 6)
    const night = byKey.get(dateKey) ?? null
    const tib = night ? computeTibHours(night.bedtime, night.waketime) : null
    return { dateKey, night, tib, isToday: dateKey === today }
  })
  const avgLabel = formatAverageTibLabel(days.filter((d) => d.night).map((d) => d.night!))
  const maxHours = Math.max(goal, averageTibHours(nights) ?? 0, 8, ...days.map((d) => d.tib ?? 0))

  return (
    <div className="w-full" data-sleep-week-chart data-sleep-week-compact={compact ? '1' : '0'}>
      <div className={`flex items-end gap-1.5 ${compact ? 'h-16' : 'h-24'}`}>
        {days.map((day) => {
          const ratio =
            day.tib != null && maxHours > 0 ? Math.min(1, Math.max(0.08, day.tib / maxHours)) : 0
          const emptyToday = day.isToday && day.tib == null
          return (
            <div key={day.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className={`relative flex w-full items-end justify-center ${compact ? 'h-12' : 'h-20'}`}>
                {day.tib != null ? (
                  <div
                    className="w-[55%] max-w-[14px] rounded-full"
                    style={{
                      height: `${ratio * 100}%`,
                      backgroundColor: day.isToday ? RED : GREY,
                      minHeight: 8,
                    }}
                    data-sleep-week-bar={day.isToday ? 'today' : 'past'}
                  />
                ) : emptyToday ? (
                  <div
                    className="w-[55%] max-w-[14px] rounded-full border border-dashed"
                    style={{
                      height: '42%',
                      borderColor: RED,
                      minHeight: 18,
                    }}
                    data-sleep-week-bar="today-empty"
                  />
                ) : (
                  <div
                    className="w-[55%] max-w-[14px] rounded-full bg-white/10"
                    style={{ height: 6 }}
                    data-sleep-week-bar="empty"
                  />
                )}
              </div>
              <p
                className={`text-[11px] ${
                  day.isToday ? 'font-semibold text-white' : 'text-[#8E8E93]'
                }`}
              >
                {frenchDayLetter(day.dateKey)}
              </p>
            </div>
          )
        })}
      </div>
      {showAverage ? (
        <p className="mt-2 text-center text-[12px] text-[#ACB4BA]" data-sleep-week-avg>
          {avgLabel ? (
            <>
              Moyenne <span className="font-semibold text-white">{avgLabel}</span> au lit
            </>
          ) : (
            'Pas encore assez de nuits pour une moyenne.'
          )}
        </p>
      ) : null}
    </div>
  )
}
