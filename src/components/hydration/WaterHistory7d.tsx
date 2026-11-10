import { useCallback, useEffect, useState } from 'react'
import { formatLitersFr, lastNDayKeys, localDayKey } from '../../shared/hydration'
import {
  deleteHydrationDayEntry,
  fetchHydrationDayEntries,
  fetchHydrationHistory,
  type HydrationDayEntry,
} from '../../services/hydration/hydrationService'

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

function timeLabel(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * Barres 7 jours + section Aujourd’hui (ajouts + suppression).
 */
export function WaterHistory7d({ goalMl, active = true, className = '' }: WaterHistory7dProps) {
  const [rows, setRows] = useState<Array<{ dayKey: string; drunkMl: number }>>([])
  const [entries, setEntries] = useState<HydrationDayEntry[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const todayKey = localDayKey()

  const reload = useCallback(async () => {
    try {
      const [history, dayEntries] = await Promise.all([
        fetchHydrationHistory(todayKey),
        fetchHydrationDayEntries(todayKey),
      ])
      setRows(history)
      setEntries(dayEntries)
    } catch {
      setRows(lastNDayKeys(todayKey, 7).map((dayKey) => ({ dayKey, drunkMl: 0 })))
      setEntries([])
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

  const removeEntry = async (entry: HydrationDayEntry) => {
    if (busyId) return
    setBusyId(entry.clientId)
    try {
      await deleteHydrationDayEntry({
        clientId: entry.clientId,
        dayKey: todayKey,
        amountMl: entry.amountMl,
      })
      setConfirmId(null)
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  const display =
    rows.length > 0
      ? rows
      : lastNDayKeys(todayKey, 7).map((dayKey) => ({ dayKey, drunkMl: 0 }))
  const max = Math.max(goalMl, 1, ...display.map((r) => r.drunkMl))
  const avg =
    display.reduce((sum, r) => sum + r.drunkMl, 0) / Math.max(1, display.length)

  return (
    <div data-hydration-history className={`space-y-5 ${className}`}>
      <section className="space-y-2" data-hydration-today-entries>
        <p className="text-[20px] font-bold text-white">Aujourd’hui</p>
        {entries.length === 0 ? (
          <p className="text-[13px] text-[#8E8E93]">Aucun ajout pour l’instant.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
            {entries.map((entry) => (
              <li
                key={entry.clientId}
                className="flex items-center gap-3 border-b border-white/10 px-3.5 py-3 last:border-b-0"
                data-hydration-today-entry={entry.clientId}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tabular-nums text-white">
                    +{entry.amountMl.toLocaleString('fr-FR')}&nbsp;ml
                  </p>
                  <p className="text-[12px] text-[#8E8E93]">
                    {timeLabel(entry.createdAt)}
                    {entry.pending ? ' · en attente' : ''}
                  </p>
                </div>
                {confirmId === entry.clientId ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-[#ACB4BA]"
                      onClick={() => setConfirmId(null)}
                      disabled={busyId === entry.clientId}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-[#FF0702] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"
                      data-hydration-today-entry-confirm
                      disabled={busyId === entry.clientId}
                      onClick={() => void removeEntry(entry)}
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`Retirer ${entry.amountMl} ml`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C3032] text-white"
                    data-hydration-today-entry-delete
                    disabled={busyId != null}
                    onClick={() => setConfirmId(entry.clientId)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-3">
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
    </div>
  )
}
