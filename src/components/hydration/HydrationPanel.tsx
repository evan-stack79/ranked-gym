import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  drunkMlFromStartAndCurrent,
  GLASS_ML,
  LABEL_EAU_BUE_SEULE,
  MSG_HIGH_INFO,
  MSG_PERMANENT,
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
  setMemorizedRemainingMl,
} from '../../services/hydration/containerLevelStorage'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { isMinorOrUnknownAge } from '../../services/nutritionSafetyRules'
import { useAuth } from '../../context/AuthContext'
import { BottleDragPanel } from './BottleDragPanel'
import { ContainerPicker, type CatalogContainer } from './ContainerPicker'
import type { BottleDragMode } from './LiveBottleVisual'

interface HydrationPanelProps {
  onOpenSettings?: () => void
  className?: string
}

/**
 * Nutrition › Hydratation v2 —
 * 1) Régler le niveau de départ (mémorisé / plein)
 * 2) Boire : ml bus = départ − final
 */
export function HydrationPanel({ onOpenSettings, className = '' }: HydrationPanelProps) {
  const { user } = useAuth()
  const [today, setToday] = useState<HydrationToday | null>(null)
  const [shapeUrl, setShapeUrl] = useState<string | null>(null)
  const [container, setContainer] = useState<CatalogContainer>('plastic_15')
  const [phase, setPhase] = useState<BottleDragMode>('setup')
  const [startRemainingMl, setStartRemainingMl] = useState(0)
  const [remainingMl, setRemainingMl] = useState(0)
  const [busy, setBusy] = useState(false)
  const minorLocked = isMinorOrUnknownAge(getCalorieProfile().age)

  useEffect(() => {
    onHydrationAccountChanged(user?.id ?? null)
  }, [user?.id])

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

  const loadLevelForKind = useCallback(
    (k: WaterContainerKind, cap: number) => {
      const memorized = getMemorizedRemainingMl(k, cap)
      setStartRemainingMl(memorized)
      setRemainingMl(memorized)
      setPhase('setup')
    },
    [],
  )

  useEffect(() => {
    loadLevelForKind(kind, capacityMl)
  }, [kind, capacityMl, loadLevelForKind])

  const drunkMl = useMemo(
    () =>
      phase === 'drink'
        ? drunkMlFromStartAndCurrent(startRemainingMl, remainingMl, capacityMl)
        : 0,
    [phase, startRemainingMl, remainingMl, capacityMl],
  )

  const confirmStartLevel = () => {
    setStartRemainingMl(remainingMl)
    setPhase('drink')
  }

  const backToSetup = () => {
    setPhase('setup')
  }

  const addEstimate = async () => {
    if (!today || busy || drunkMl <= 0) return
    setBusy(true)
    try {
      const next = await addHydrationEntry({
        amountMl: drunkMl,
        source: 'slider',
        userId: user?.id ?? null,
      })
      setToday(next)
      // Niveau final mémorisé ; nouveau départ = final (0 bus).
      setMemorizedRemainingMl(kind, remainingMl, capacityMl)
      setStartRemainingMl(remainingMl)
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!today || busy || !today.canUndo) return
    setBusy(true)
    try {
      setToday(await undoLastHydrationEntry(today.dayKey))
      // Retour au niveau de départ.
      setRemainingMl(startRemainingMl)
    } finally {
      setBusy(false)
    }
  }

  if (!today) {
    return (
      <section
        className={`rounded-[28px] border border-white/12 bg-white/[0.04] px-3 py-3 ${className}`}
        data-hydration-panel="loading"
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
          Hydratation
        </p>
        <h2 className="mt-0.5 text-[22px] font-semibold tracking-tight text-white">Eau</h2>
        <p className="mt-2 text-[13px] text-[#ACB4BA]">Chargement…</p>
      </section>
    )
  }

  return (
    <section
      className={`rounded-[28px] border border-white/12 bg-white/[0.04] px-3 py-2.5 ${className}`}
      data-hydration-panel="1"
      data-hydration-mode={today.effectiveVisualMode}
      data-hydration-phase={phase}
      aria-label="Eau"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
            Hydratation
          </p>
          <h2 className="mt-0.5 text-[22px] font-semibold tracking-tight text-white">
            {myBottleMode ? 'Ma bouteille' : 'Eau'}
          </h2>
        </div>
        {myBottleMode ? (
          <span
            className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF907F]"
            data-hydration-pro-chip
          >
            Pro
          </span>
        ) : (
          <p className="text-[11px] font-medium text-[#8E8E93]">{LABEL_EAU_BUE_SEULE}</p>
        )}
      </div>

      {myBottleMode ? (
        <p className="mb-2 text-[12px] leading-snug text-[#8E8E93]">
          Look cosmétique Pass Pro. Aucun avantage de jeu.
        </p>
      ) : null}

      {!myBottleMode ? (
        <ContainerPicker
          selected={container}
          onSelect={(id) => {
            setContainer(id)
          }}
        />
      ) : null}

      <p className="mt-2 text-[13px] font-medium text-[#ACB4BA]" data-hydration-phase-label>
        {phase === 'setup' ? 'Niveau de départ' : 'Boire'}
      </p>

      <div className="mt-1">
        <BottleDragPanel
          kind={kind}
          remainingMl={remainingMl}
          capacityMl={capacityMl}
          startRemainingMl={startRemainingMl}
          mode={phase}
          shapeUrl={myBottleMode ? shapeUrl : null}
          onRemainingChange={setRemainingMl}
        />
      </div>

      {phase === 'setup' ? (
        <button
          type="button"
          onClick={confirmStartLevel}
          className="ios-press mt-2 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
          data-hydration-confirm-level
        >
          C&apos;est bon
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy || drunkMl <= 0}
            onClick={() => void addEstimate()}
            className="ios-press mt-2 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white disabled:opacity-45"
            data-hydration-add="slider"
          >
            Ajouter
          </button>
          <button
            type="button"
            onClick={backToSetup}
            className="ios-press mt-2 min-h-11 w-full rounded-2xl border border-white/15 bg-white/5 text-[14px] font-semibold text-white"
            data-hydration-back-setup
          >
            Régler le niveau
          </button>
        </>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void addHydrationEntry({
              amountMl: GLASS_ML,
              source: 'glass',
              userId: user?.id ?? null,
            }).then(setToday)
          }
          className="ios-press min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          data-hydration-add="glass"
        >
          +1 verre
        </button>
        <button
          type="button"
          disabled={busy || !today.canUndo}
          onClick={() => void undo()}
          className="ios-press min-h-10 rounded-xl border border-white/10 px-3 py-2 text-[13px] font-medium text-[#ACB4BA] disabled:opacity-40"
          data-hydration-undo
        >
          Annuler
        </button>
        {onOpenSettings && !minorLocked ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="ios-press ml-auto min-h-10 rounded-xl px-2 text-[13px] font-medium text-[#8E8E93]"
            data-hydration-settings
          >
            Réglages
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-[12px] leading-snug text-[#8E8E93]">{MSG_PERMANENT}</p>
      {today.showHighInfo && !minorLocked ? (
        <p className="mt-1 text-[12px] leading-snug text-[#C7C7CC]" data-hydration-high-info>
          {MSG_HIGH_INFO}
        </p>
      ) : null}

      {myBottleMode ? (
        <p className="mt-1.5 text-center text-[12px] leading-snug text-[#8E8E93]">
          Pas de visage sur la photo
        </p>
      ) : null}
    </section>
  )
}
