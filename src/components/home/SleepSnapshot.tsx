import { useEffect, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { computeTibHours } from '../../sleep-engine'
import { SLEEP_CHANGED_EVENT, getLatestSleepNight } from '../../services/sleepStorage'
import {
  formatDurationHoursLabel,
  formatNightRangeLabel,
} from '../../utils/sleepTimeFormat'
import { AccueilProgressRing } from './AccueilProgressRing'
import { SleepScreen } from './SleepScreen'

const RED = '#ff0702'
/** Repère visuel anneau (adulte haut de fourchette) — pas un score. */
const RING_REF_HOURS = 9

/**
 * Carte Accueil sommeil — tout en haut, 1 tap → écran Sommeil.
 * Affiche TIB + plage, sans statut qualité /100.
 */
export function SleepSnapshot() {
  const [tick, setTick] = useState(0)
  const [screenOpen, setScreenOpen] = useState(false)

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

  const latest = useMemo(() => getLatestSleepNight(), [tick])
  const tib = latest ? computeTibHours(latest.bedtime, latest.waketime) : null
  const tibLabel = tib != null && tib > 0 ? formatDurationHoursLabel(tib) : null
  const rangeLabel =
    latest != null ? formatNightRangeLabel(latest.bedtime, latest.waketime) : null
  const progress = tib != null && tib > 0 ? Math.min(1, tib / RING_REF_HOURS) : 0

  return (
    <>
      <button
        type="button"
        onClick={() => setScreenOpen(true)}
        className="ios-press flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0702]/55"
        style={{
          backgroundColor: 'rgba(20,20,22,0.92)',
          borderColor: 'rgba(255,7,2,0.28)',
        }}
        aria-label="Sommeil"
        data-sleep-home-card
      >
        <div className="relative shrink-0">
          <AccueilProgressRing
            progress={progress}
            accent={RED}
            track="rgba(255,255,255,0.12)"
            size={56}
            strokeWidth={5}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[#ACB4BA]">Sommeil</p>
          {tibLabel ? (
            <>
              <p className="mt-0.5 text-[17px] font-bold leading-snug tabular-nums text-white">
                {tibLabel} au lit
              </p>
              {rangeLabel ? (
                <p className="mt-0.5 text-[13px] tabular-nums text-[#8E8E93]">{rangeLabel}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-0.5 text-[15px] font-semibold leading-snug text-white">
              Comment était ta nuit ?
            </p>
          )}
        </div>

        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2C3032] text-white"
          aria-hidden
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </span>
      </button>

      <SleepScreen open={screenOpen} onClose={() => setScreenOpen(false)} />
    </>
  )
}
