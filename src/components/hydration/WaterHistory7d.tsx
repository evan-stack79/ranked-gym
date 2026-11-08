import { useEffect, useState } from 'react'
import { localDayKey } from '../../shared/hydration'
import { fetchHydrationHistory } from '../../services/hydration/hydrationService'

interface WaterHistory7dProps {
  goalMl: number
}

/**
 * Barres 7 jours — sans note ni couleur d’échec (HY-05).
 */
export function WaterHistory7d({ goalMl }: WaterHistory7dProps) {
  const [rows, setRows] = useState<Array<{ dayKey: string; drunkMl: number }>>([])

  useEffect(() => {
    let cancelled = false
    void fetchHydrationHistory(localDayKey())
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const max = Math.max(goalMl, 1, ...rows.map((r) => r.drunkMl))

  return (
    <div data-hydration-history className="space-y-2">
      <p className="text-[15px] font-semibold text-white">7 derniers jours</p>
      <div className="flex h-28 items-end justify-between gap-1.5">
        {rows.length === 0
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-t bg-white/5" style={{ height: '12%' }} />
            ))
          : rows.map((row) => {
              const h = Math.max(4, Math.round((row.drunkMl / max) * 100))
              const day = row.dayKey.slice(8)
              return (
                <div key={row.dayKey} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-[#5AC8FA]/55"
                    style={{ height: `${h}%` }}
                    title={`${row.drunkMl} ml`}
                  />
                  <span className="text-[10px] tabular-nums text-[#8E8E93]">{day}</span>
                </div>
              )
            })}
      </div>
    </div>
  )
}
