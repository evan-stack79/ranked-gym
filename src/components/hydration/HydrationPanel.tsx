import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GLASS_ML,
  LABEL_EAU_BUE_SEULE,
  WATER_CONTAINER_CAPACITY_ML,
  localDayKey,
  type WaterContainerKind,
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
import type { CatalogContainer } from './ContainerPicker'

interface HydrationPanelProps {
  onOpenSettings?: () => void
  className?: string
}

/**
 * Nutrition › Hydratation v3 —
 * carte Eau → plein écran (niveau mémorisé → boire ; sinon régler).
 */
export function HydrationPanel({ onOpenSettings, className = '' }: HydrationPanelProps) {
  const { user } = useAuth()
  const [today, setToday] = useState<HydrationToday | null>(null)
  const [shapeUrl, setShapeUrl] = useState<string | null>(null)
  const [container] = useState<CatalogContainer>('plastic_15')
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

  const myBottleMode =
    today?.effectiveVisualMode === 'my_bottle' && Boolean(shapeUrl)

  const capacityMl = useMemo(() => {
    if (myBottleMode) {
      return Math.max(GLASS_ML, today?.myBottleVolumeMl ?? 750)
    }
    return WATER_CONTAINER_CAPACITY_ML[container]
  }, [container, myBottleMode, today?.myBottleVolumeMl])

  const kind: WaterContainerKind = myBottleMode ? 'gourd' : container

  const memorized = useMemo(() => {
    void levelTick
    return {
      has: hasMemorizedRemainingMl(kind, userId),
      remaining: getMemorizedRemainingMl(kind, capacityMl, userId),
    }
  }, [kind, capacityMl, userId, levelTick, today?.drunkMl])

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
        data-hydration-mode={today.effectiveVisualMode}
        data-hydration-v3="b"
        data-testid="nutrition-eau-card"
        aria-label="Eau"
      >
        <button
          type="button"
          onClick={() => setFlowOpen(true)}
          className="ios-press flex w-full items-center gap-3 text-left"
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
              <p className="text-[11px] font-medium text-[#8E8E93]">{LABEL_EAU_BUE_SEULE}</p>
            </div>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-white" data-hydration-drunk>
              {drunkL}&nbsp;/&nbsp;{goalL}&nbsp;L
            </p>
            <p className="mt-0.5 text-[13px] text-[#ACB4BA]">
              {myBottleMode ? 'Pass Pro' : 'Cristaline 1,5 L'}
            </p>
          </div>
          <span className="text-[20px] font-light text-[#8E8E93]" aria-hidden>
            ›
          </span>
        </button>

        <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-[#2A2A2E]">
          <div
            className="h-full rounded-full bg-[#FF0702]"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>

        {onOpenSettings && !minorLocked ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="ios-press mt-1 min-h-10 rounded-xl px-1 text-[13px] font-medium text-[#8E8E93]"
            data-hydration-settings
          >
            Réglages
          </button>
        ) : null}
      </section>

      <BottleFlowV3
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        capacityMl={capacityMl}
        kind={kind}
        shapeUrl={myBottleMode ? shapeUrl : null}
        initialRemainingMl={memorized.remaining}
        hasMemorizedLevel={memorized.has}
        busy={busy}
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
