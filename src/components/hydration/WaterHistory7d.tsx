import { useCallback, useEffect, useState } from 'react'
import { formatLitersFr, lastNDayKeys, localDayKey } from '../../shared/hydration'
import { fetchHydrationHistory } from '../../services/hydration/hydrationService'

interface WaterHistory7dProps {
  goalMl: number
  /** Quand true, recharge à chaque passage à true (ouverture panneau). */
  active?: boolean
  className?: string
}

const DAY_LABELS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const

function dayShortLabel(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return 'Auj.'
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return DAY_LABELS[dt.getDay()] ?? ''
}

function litersLabel(ml: number): string {
  const liters = Math.max(0, ml) / 1000
  if (Number.isInteger(liters)) return String(liters)
  return liters.toFixed(1).replace('.', ',')
}

/**
 * Barres 7 jours — gris neutre, jour actuel rouge, moyenne neutre (HY-05).
 * Recharge à chaque ouverture (`active`) ; repli local via fetchHydrationHistory.
 */
export function WaterHistory7d({ goalMl, active = true, className = '' }: WaterHistory7dProps) {
  const [rows, setRows] = useState<Array<{ dayKey: string; drunkMl: number }>>([])
  const todayKey = localDayKey()

  const reload = useCallback(async () => {
    try {
      const data = await fetchHydrationHistory(todayKey)
      setRows(data)
    } catch {
      setRows(lastNDayKeys(todayKey, 7).map((dayKey) => ({ dayKey, drunkMl: 0 })))
    }
  }, [todayKey])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void reload().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [active, reload])

  const display =
    rows.length > 0
      ? rows
      : lastNDayKeys(todayKey, 7).map((dayKey) => ({ dayKey, drunkMl: 0 }))
  const max = Math.max(goalMl, 1, ...display.map((r) => r.drunkMl))
  const avg =
    display.reduce((sum, r) => sum + r.drunkMl, 0) / Math.max(1, display.length)

  return (
    <div data-hydration-history className={`space-y-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[20px] font-bold text-white">7 derniers jours</p>
        <span className="text-[13px] tabular-nums text-[#ACB4BA]">
          moy. {formatLitersFr(Math.round(avg))}
        </span>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/25 px-3.5 py-4">
        <div className="flex h-[180px] items-end justify-between gap-1.5">
          {display.map((row) => {
            const h = Math.max(8, Math.round((row.drunkMl / max) * 100))
            const isToday = row.dayKey === todayKey
            return (
              <div key={row.dayKey} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] tabular-nums text-[#ACB4BA]">
                  {litersLabel(row.drunkMl)}
                </span>
                <div className="flex h-[140px] w-full items-end justify-center">
                  <div
                    className={`w-[70%] max-w-[28px] rounded-t-md ${
                      isToday ? 'bg-[#FF0702]' : 'bg-[#5C6368]'
                    }`}
                    style={{ height: `${h}%` }}
                    title={`${row.drunkMl} ml`}
                    data-hydration-history-bar={row.dayKey}
                    data-hydration-history-today={isToday ? '1' : '0'}
                  />
                </div>
                <span
                  className={`text-[11px] ${
                    isToday ? 'font-bold text-white' : 'text-[#8E8E93]'
                  }`}
                >
                  {dayShortLabel(row.dayKey, todayKey)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
