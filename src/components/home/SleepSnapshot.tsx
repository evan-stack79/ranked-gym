import { useEffect, useMemo, useState } from 'react'
import { getSleepHomeSnapshot } from '../../services/sleepEngineAdapter'
import { SLEEP_CHANGED_EVENT } from '../../services/sleepStorage'
import {
  compactHomeQuantityStatusLabel,
  getSleepHomeCompactView,
  sleepHomeStatusColorClass,
} from '../../utils/sleepHomeCompact'
import { LogSleepNightSheet } from './LogSleepNightSheet'
import { SleepDetailsSheet } from './SleepDetailsSheet'

/**
 * Carte Accueil sommeil — résumé compact (1–2 lignes).
 * Détails, conseils et historique dans les sheets existantes.
 */
export function SleepSnapshot() {
  const [tick, setTick] = useState(0)
  const [logOpen, setLogOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener(SLEEP_CHANGED_EVENT, sync)
    window.addEventListener('ranked-gym:backup-restored', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener(SLEEP_CHANGED_EVENT, sync)
      window.removeEventListener('ranked-gym:backup-restored', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const snapshot = useMemo(() => getSleepHomeSnapshot(), [tick])
  const compact = useMemo(() => getSleepHomeCompactView(snapshot), [snapshot])

  const handleAction = () => {
    if (compact.action === 'log') {
      setLogOpen(true)
      return
    }
    setDetailsOpen(true)
  }

  return (
    <>
      <section className="glass-card rounded-2xl p-4" aria-label="Sommeil">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#8E8E93]">Sommeil</p>
            {!snapshot.hasData ? (
              <p className="mt-1 text-[15px] font-semibold leading-snug text-white">
                {compact.secondaryLine}
              </p>
            ) : snapshot.tstKnown && snapshot.tstLabel ? (
              <p className="mt-1 text-[15px] font-semibold leading-snug text-white">
                {snapshot.tstLabel} dormies
                {(snapshot.statusKey || snapshot.statusLabel) && (
                  <>
                    {' · '}
                    <span className={sleepHomeStatusColorClass(snapshot.statusKey)}>
                      {snapshot.statusKey
                        ? compactHomeQuantityStatusLabel(snapshot.statusKey)
                        : snapshot.statusLabel}
                    </span>
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1 text-[15px] font-semibold leading-snug text-white">
                {snapshot.tibLabel ? `${snapshot.tibLabel} au lit` : '—'}
                {' · '}
                <span className="text-[#AEAEB2]">Sommeil non estimé</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleAction}
            aria-label={compact.actionLabel}
            className={
              compact.action === 'log'
                ? 'btn-brand ios-press min-h-11 shrink-0 rounded-2xl border border-white/15 px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0C0E]'
                : 'ios-press min-h-11 shrink-0 rounded-2xl border border-white/12 bg-white/5 px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0C0E]'
            }
          >
            {compact.actionLabel}
          </button>
        </div>
      </section>

      <SleepDetailsSheet
        open={detailsOpen && snapshot.hasData}
        onClose={() => setDetailsOpen(false)}
        snapshot={snapshot}
        onEditNight={() => setLogOpen(true)}
      />
      <LogSleepNightSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => setTick((n) => n + 1)}
        initial={snapshot.latest}
      />
    </>
  )
}
