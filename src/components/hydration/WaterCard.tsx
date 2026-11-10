import { useCallback, useEffect, useState } from 'react'
import {
  fillRatio,
  formatDrunkLabel,
  formatLitersFr,
  formatRemainingLabel,
  GOAL_DEFAULT_ML,
  LABEL_EAU_BUE_SEULE,
  LABEL_REPERE_JOUR,
  MSG_HIGH_INFO,
  MSG_MINOR_PERMANENT,
  MSG_PERMANENT,
  MSG_REPERE_LOCKED,
  MSG_SPORT_HEAT,
  quickAddAmountMl,
  localDayKey,
} from '../../shared/hydration'
import {
  addHydrationEntry,
  fetchHydrationToday,
  flushHydrationPendingQueue,
  HYDRATION_CHANGED_EVENT,
  onHydrationAccountChanged,
  type HydrationToday,
  undoLastHydrationEntry,
} from '../../services/hydration/hydrationService'
import { loadBottleShapeUrl } from '../../services/hydration/bottleShapeStorage'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { isMinorOrUnknownAge } from '../../services/nutritionSafetyRules'
import { useAuth } from '../../context/AuthContext'
import { BottleVisual } from './BottleVisual'

interface WaterCardProps {
  /** Compact Accueil tile-adjacent layout. */
  compact?: boolean
  onOpenSettings?: () => void
  className?: string
}

export function WaterCard({ compact = false, onOpenSettings, className = '' }: WaterCardProps) {
  const { user } = useAuth()
  const [today, setToday] = useState<HydrationToday | null>(null)
  const [shapeUrl, setShapeUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const profile = getCalorieProfile()
  const minorLocked = isMinorOrUnknownAge(profile.age)

  useEffect(() => {
    onHydrationAccountChanged(user?.id ?? null)
  }, [user?.id])

  const refresh = useCallback(async () => {
    const dayKey = localDayKey()
    const data = await fetchHydrationToday(dayKey)
    setToday(data)
    if (data.effectiveVisualMode === 'my_bottle' && data.myBottleHasShape) {
      const url = await loadBottleShapeUrl()
      setShapeUrl(url)
    } else {
      setShapeUrl(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
    void flushHydrationPendingQueue().then(() => refresh())
    const onChange = () => {
      void refresh()
    }
    const onOnline = () => {
      void flushHydrationPendingQueue().then(() => refresh())
    }
    window.addEventListener(HYDRATION_CHANGED_EVENT, onChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onChange)
    return () => {
      window.removeEventListener(HYDRATION_CHANGED_EVENT, onChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onChange)
    }
  }, [refresh])

  const add = async (source: 'glass' | 'half_bottle' | 'full_bottle') => {
    if (!today || busy) return
    setBusy(true)
    try {
      const amountMl = quickAddAmountMl(source, today.mode, today.myBottleVolumeMl)
      const next = await addHydrationEntry({ amountMl, source, userId: user?.id ?? null })
      setToday(next)
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!today || busy || !today.canUndo) return
    setBusy(true)
    try {
      const next = await undoLastHydrationEntry(today.dayKey)
      setToday(next)
    } finally {
      setBusy(false)
    }
  }

  if (!today) {
    return (
      <div
        className={`rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3 ${className}`}
        data-hydration-card="loading"
      >
        <p className="text-[14px] font-semibold text-white">Eau</p>
        <p className="mt-1 text-[13px] text-[#ACB4BA]">Chargement…</p>
      </div>
    )
  }

  const goalMl = minorLocked ? GOAL_DEFAULT_ML : today.goalMl
  const ratio = fillRatio(goalMl, today.drunkMl)
  const repereLabel = `${LABEL_REPERE_JOUR} · ${formatLitersFr(goalMl)}`

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3 ${className}`}
      data-hydration-card="1"
      data-hydration-mode={today.effectiveVisualMode}
      data-hydration-minor={minorLocked ? '1' : '0'}
    >
      <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col gap-3'}`}>
        <BottleVisual
          fillRatio={ratio}
          mode={today.effectiveVisualMode}
          shapeUrl={shapeUrl}
          className={compact ? 'h-20 w-12 shrink-0' : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[14px] font-semibold text-white">Eau</p>
            <p className="text-[11px] font-medium text-[#8E8E93]">{LABEL_EAU_BUE_SEULE}</p>
          </div>
          {minorLocked ? (
            <p
              className="mt-0.5 text-[15px] font-semibold tabular-nums text-white"
              data-hydration-minor-copy
              data-hydration-repere
              aria-label={repereLabel}
            >
              {repereLabel}
            </p>
          ) : (
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-white" data-hydration-remaining>
              {formatRemainingLabel(goalMl, today.drunkMl)}
            </p>
          )}
          <p className="text-[13px] tabular-nums text-[#ACB4BA]" data-hydration-drunk>
            {formatDrunkLabel(today.drunkMl)}
          </p>
          {minorLocked ? (
            <p
              className="mt-2 text-[12px] leading-snug text-[#8E8E93]"
              data-hydration-minor-permanent
            >
              {MSG_MINOR_PERMANENT}
            </p>
          ) : !compact ? (
            <p className="mt-2 text-[12px] leading-snug text-[#8E8E93]">{MSG_PERMANENT}</p>
          ) : null}
          {today.showHighInfo && !minorLocked ? (
            <p className="mt-2 text-[12px] leading-snug text-[#C7C7CC]" data-hydration-high-info>
              {MSG_HIGH_INFO}
            </p>
          ) : null}
          {!compact && !minorLocked ? (
            <p className="mt-1 text-[12px] leading-snug text-[#8E8E93]">{MSG_SPORT_HEAT}</p>
          ) : null}
          {minorLocked ? (
            <p className="mt-2 text-[12px] leading-snug text-[#8E8E93]" data-hydration-minor-note>
              {MSG_REPERE_LOCKED}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void add('glass')}
          className="ios-press min-h-11 rounded-xl bg-[#FF0702] px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          data-hydration-add="glass"
          aria-label="Ajouter 1 verre"
        >
          +1 verre
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void add('half_bottle')}
          className="ios-press min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          data-hydration-add="half"
        >
          +½
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void add('full_bottle')}
          className="ios-press min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          data-hydration-add="full"
        >
          +bouteille
        </button>
        <button
          type="button"
          disabled={busy || !today.canUndo}
          onClick={() => void undo()}
          className="ios-press min-h-11 rounded-xl border border-white/10 px-3 py-2.5 text-[13px] font-medium text-[#ACB4BA] disabled:opacity-40"
          data-hydration-undo
        >
          Annuler
        </button>
        {onOpenSettings && !minorLocked ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="ios-press ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2C3032] text-white"
            data-hydration-settings
            aria-label="Changer de bouteille"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 2.5h4" />
              <path d="M5.2 2.5v2.3C3.8 5.6 3 6.8 3 8.4V20a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 11 20V8.4c0-1.6-.8-2.8-2.2-3.6V2.5" />
              <path d="M3 12h8" />
              <path d="M14 8.5h7M18.5 6l2.5 2.5-2.5 2.5" />
              <path d="M21 15.5h-7M16.5 13L14 15.5l2.5 2.5" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )
}
