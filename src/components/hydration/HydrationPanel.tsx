import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LABEL_EAU_BUE_SEULE,
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
import {
  getMemorizedRemainingMl,
  hasMemorizedRemainingMl,
  setMemorizedRemainingMl,
} from '../../services/hydration/containerLevelStorage'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { isMinorOrUnknownAge } from '../../services/nutritionSafetyRules'
import { useAuth } from '../../context/AuthContext'
import { LiveBottleVisual } from './LiveBottleVisual'
import { BottleFlowV3, type BottleFlowCommit } from './BottleFlowV3'
import {
  bottleScreenLabelForMode,
  capacityForMode,
  kindForMode,
} from '../../utils/hydrationModeDisplay'

interface HydrationPanelProps {
  onOpenSettings?: () => void
  className?: string
}

/** Icône ronde « changer de bouteille » (bouteille + flèches). */
function ChangeBottleIcon() {
  return (
    <svg
      width="24"
      height="24"
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
  )
}

/**
 * Nutrition › Hydratation v3 —
 * carte Eau → plein écran (niveau mémorisé → boire ; sinon régler).
 */
export function HydrationPanel({ onOpenSettings, className = '' }: HydrationPanelProps) {
  const { user } = useAuth()
  const [today, setToday] = useState<HydrationToday | null>(null)
  const [shapeUrl, setShapeUrl] = useState<string | null>(null)
  const [flowOpen, setFlowOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [levelTick, setLevelTick] = useState(0)
  const minorLocked = isMinorOrUnknownAge(getCalorieProfile().age)
  const userId = user?.id ?? null

  useEffect(() => {
    onHydrationAccountChanged(userId)
  }, [userId])

  const refresh = useCallback(async () => {
    const data = await fetchHydrationToday(localDayKey())
    setToday(data)
    if (data.effectiveVisualMode === 'my_bottle' && data.myBottleHasShape) {
      setShapeUrl(await loadBottleShapeUrl())
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

  const visualMode = today?.effectiveVisualMode ?? 'classic_2l'
  const myBottleMode = visualMode === 'my_bottle' && Boolean(shapeUrl)
  const kind = kindForMode(visualMode)
  const capacityMl = capacityForMode(visualMode, today?.myBottleVolumeMl)
  const bottleLabel = bottleScreenLabelForMode(visualMode)

  const memorized = useMemo(() => {
    void levelTick
    return {
      has: hasMemorizedRemainingMl(kind, userId),
      remaining: getMemorizedRemainingMl(kind, capacityMl, userId),
    }
  }, [kind, capacityMl, userId, levelTick])

  const handleCommit = useCallback(
    async (commit: BottleFlowCommit) => {
      if (!today || busy) return
      setBusy(true)
      try {
        const next = await addHydrationEntry({
          amountMl: commit.amountMl,
          source: 'slider',
          clientId: commit.clientId,
          userId,
        })
        setToday(next)
        setMemorizedRemainingMl(kind, commit.remainingAfterMl, capacityMl, userId)
        setLevelTick((n) => n + 1)
      } finally {
        setBusy(false)
      }
    },
    [today, busy, userId, kind, capacityMl],
  )

  const handleUndoCommit = useCallback(
    async (args: { amountMl: number; restoreRemainingMl: number }) => {
      setBusy(true)
      try {
        const next = await undoLastHydrationEntry(today?.dayKey ?? localDayKey())
        setToday(next)
        setMemorizedRemainingMl(kind, args.restoreRemainingMl, capacityMl, userId)
        setLevelTick((n) => n + 1)
      } finally {
        setBusy(false)
      }
    },
    [today?.dayKey, kind, capacityMl, userId],
  )

  if (!today) {
    return (
      <section
        className={`rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3 ${className}`}
        data-hydration-panel="loading"
        data-testid="nutrition-eau-card"
      >
        <p className="text-[14px] font-semibold text-white">Eau</p>
        <p className="mt-1 text-[13px] text-[#ACB4BA]">Chargement…</p>
      </section>
    )
  }

  const goalMl = today.goalMl
  const drunkL = (today.drunkMl / 1000).toFixed(2).replace('.', ',')
  const goalL = (goalMl / 1000).toFixed(goalMl % 1000 === 0 ? 0 : 2).replace('.', ',')
  const progress = goalMl > 0 ? Math.min(1, today.drunkMl / goalMl) : 0

  return (
    <>
      <section
        className={`rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3 ${className}`}
        data-hydration-panel="1"
        data-hydration-mode={visualMode}
        data-hydration-v3="b"
        data-testid="nutrition-eau-card"
        aria-label="Eau"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFlowOpen(true)}
            className="ios-press flex min-w-0 flex-1 items-center gap-3 text-left"
            data-hydration-eau-card
          >
            <div className="flex h-[72px] w-12 shrink-0 items-end justify-center">
              <LiveBottleVisual
                kind={kind}
                remainingMl={memorized.remaining}
                capacityMl={capacityMl}
                shapeUrl={myBottleMode ? shapeUrl : null}
                size="thumb"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] font-semibold text-white">
                  {myBottleMode ? 'Ma bouteille' : 'Eau'}
                </p>
                <p className="shrink-0 text-[11px] font-medium text-[#8E8E93]">
                  {LABEL_EAU_BUE_SEULE}
                </p>
              </div>
              <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-white" data-hydration-drunk>
                {drunkL}&nbsp;/&nbsp;{goalL}&nbsp;L
              </p>
              <p className="mt-0.5 truncate text-[13px] text-[#ACB4BA]" data-hydration-bottle-label>
                {bottleLabel}
              </p>
            </div>
          </button>

          {onOpenSettings && !minorLocked ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="ios-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2C3032] text-white"
              data-hydration-settings
              aria-label="Changer de bouteille"
            >
              <ChangeBottleIcon />
            </button>
          ) : null}
        </div>

        <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-[#2A2A2E]">
          <div
            className="h-full rounded-full bg-[#FF0702]"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
      </section>

      <BottleFlowV3
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        capacityMl={capacityMl}
        kind={kind}
        title={bottleLabel}
        shapeUrl={myBottleMode ? shapeUrl : null}
        initialRemainingMl={memorized.remaining}
        hasMemorizedLevel={memorized.has}
        busy={busy}
        goalMl={goalMl}
        onCommitDrunk={handleCommit}
        onUndoCommit={handleUndoCommit}
        onMarkBottleRefilled={() => {
          setMemorizedRemainingMl(kind, capacityMl, capacityMl, userId)
          setLevelTick((n) => n + 1)
        }}
        onConfirmLevel={(ml) => {
          setMemorizedRemainingMl(kind, ml, capacityMl, userId)
          setLevelTick((n) => n + 1)
        }}
      />
    </>
  )
}
