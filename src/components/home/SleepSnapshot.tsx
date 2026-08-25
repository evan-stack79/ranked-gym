import { useEffect, useMemo, useState } from 'react'
import { Moon } from 'lucide-react'
import { getSleepHomeSnapshot } from '../../services/sleepEngineAdapter'
import { SLEEP_CHANGED_EVENT } from '../../services/sleepStorage'
import { IconBadge } from '../ui/IconBadge'
import { LogSleepNightSheet } from './LogSleepNightSheet'
import { SleepDetailsSheet } from './SleepDetailsSheet'

/**
 * Carte Accueil sommeil — pas de Sleep Score, pas de stades REM/profond.
 * Sheets toujours montés (hors branche hasData) pour éviter remount/lock résiduel.
 * Si TST inconnu : jamais de faux « X h dormies ».
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

  return (
    <>
      {!snapshot.hasData ? (
        <section className="glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <IconBadge icon={Moon} variant="violet" size="sm" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Sommeil
            </p>
          </div>
          <p className="text-[17px] font-semibold text-white">Comment s&apos;est passée ta nuit ?</p>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="ios-press mt-4 w-full rounded-2xl bg-[#5E5CE6] px-4 py-3 text-[14px] font-semibold text-white"
          >
            Enregistrer ma nuit
          </button>
        </section>
      ) : (
        <section className="glass-card rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <IconBadge icon={Moon} variant="violet" size="sm" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Sommeil
            </p>
          </div>

          {snapshot.tstKnown ? (
            <>
              <p className="text-[28px] font-black tracking-tight text-white">{snapshot.tstLabel}</p>
              <p
                className={`mt-1 text-[14px] font-semibold ${
                  snapshot.statusKey === 'optimal'
                    ? 'text-[#30D158]'
                    : snapshot.statusKey === 'deficit'
                      ? 'text-[#FF9F0A]'
                      : 'text-[#AEAEB2]'
                }`}
              >
                {snapshot.statusKey === 'optimal' ? '✓ ' : ''}
                {snapshot.statusLabel}
              </p>
              {snapshot.tibLabel && (
                <p className="mt-1 text-[13px] text-[#8E8E93]">{snapshot.tibLabel} au lit</p>
              )}
            </>
          ) : (
            <>
              <p className="text-[28px] font-black tracking-tight text-white">
                {snapshot.tibLabel ? `${snapshot.tibLabel} au lit` : '—'}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[#AEAEB2]">
                Temps réellement dormi : inconnu
              </p>
            </>
          )}

          {snapshot.tonightHint && (
            <div className="mt-4 rounded-xl border border-white/8 bg-black/25 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                Ce soir
              </p>
              <p className="mt-1 text-[14px] leading-snug text-[#E5E5EA]">{snapshot.tonightHint}</p>
            </div>
          )}

          {snapshot.insufficientHistory && (
            <p className="mt-3 text-[12px] text-[#636366]">
              Historique encore limité pour la régularité — ce n&apos;est pas un mauvais résultat.
            </p>
          )}

          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="ios-press mt-4 w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[14px] font-semibold text-white"
          >
            Voir les détails
          </button>
        </section>
      )}

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
