import { useCallback, useEffect, useState } from 'react'
import { IosSheet } from '../ui/IosSheet'
import { WaterGoalSlider } from './WaterGoalSlider'
import { WaterHistory7d } from './WaterHistory7d'
import { WaterModePicker } from './WaterModePicker'
import { WaterReminders } from './WaterReminders'
import { BottleCaptureFlow } from './BottleCaptureFlow'
import {
  fetchHydrationToday,
  updateHydrationSettings,
  type HydrationToday,
} from '../../services/hydration/hydrationService'
import { clearBottleShapeLocal } from '../../services/hydration/bottleShapeStorage'
import { deleteMyBottleRemote } from '../../services/hydration/hydrationService'
import { syncHydrationReminders } from '../../services/hydration/hydrationReminders'
import { GOAL_DEFAULT_ML, localDayKey, type HydrationMode } from '../../shared/hydration'

interface WaterSettingsSheetProps {
  open: boolean
  onClose: () => void
}

export function WaterSettingsSheet({ open, onClose }: WaterSettingsSheetProps) {
  const [today, setToday] = useState<HydrationToday | null>(null)
  const [showCapture, setShowCapture] = useState(false)
  const [showProGate, setShowProGate] = useState(false)

  const refresh = useCallback(async () => {
    const data = await fetchHydrationToday(localDayKey())
    setToday(data)
    const goalReached = data.drunkMl >= data.goalMl
    if (data.remindersEnabled) {
      await syncHydrationReminders({
        enabled: true,
        times: data.reminderTimes,
        goalReachedToday: goalReached,
      })
    }
  }, [])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const saveGoal = async (goalMl: number) => {
    await updateHydrationSettings({ goalMl })
    await refresh()
  }

  const saveMode = async (mode: HydrationMode) => {
    if (mode === 'my_bottle') {
      if (!today?.proActive) {
        setShowProGate(true)
        return
      }
      setShowCapture(true)
      return
    }
    await updateHydrationSettings({ mode })
    await refresh()
  }

  const fallback2L = async () => {
    setShowCapture(false)
    setShowProGate(false)
    await clearBottleShapeLocal()
    await deleteMyBottleRemote().catch(() => undefined)
    await updateHydrationSettings({ mode: 'classic_2l' })
    await refresh()
  }

  return (
    <IosSheet open={open} onClose={onClose} title="Réglages Eau" subtitle="Eau bue seule">
      <div className="space-y-6 pb-8">
        {showProGate ? (
          <div className="space-y-3 rounded-2xl border border-[#FF0702]/25 bg-[#FF0702]/5 p-4">
            <p className="text-[15px] font-semibold text-white">Pass Pro</p>
            <p className="text-[13px] leading-snug text-[#C7C7CC]">
              Ma bouteille est un look cosmétique Pass Pro. Les modes 2 L et verres restent gratuits,
              avec le même suivi.
            </p>
            <button
              type="button"
              onClick={() => setShowProGate(false)}
              className="ios-press min-h-11 w-full rounded-2xl border border-white/15 text-[14px] text-white"
            >
              Continuer avec 2 L / verres
            </button>
          </div>
        ) : null}

        {showCapture ? (
          <BottleCaptureFlow
            onDone={() => {
              setShowCapture(false)
              void refresh()
            }}
            onFallback2L={() => void fallback2L()}
            onCancel={() => setShowCapture(false)}
          />
        ) : (
          <>
            <WaterModePicker
              mode={today?.mode ?? 'classic_2l'}
              proActive={today?.proActive ?? false}
              onSelect={(m) => void saveMode(m)}
              onRequestPro={() => setShowProGate(true)}
            />
            <WaterGoalSlider
              valueMl={today?.goalMl ?? GOAL_DEFAULT_ML}
              onChange={(g) => void saveGoal(g)}
            />
            <WaterReminders
              enabled={today?.remindersEnabled ?? false}
              times={today?.reminderTimes ?? []}
              goalReachedToday={Boolean(today && today.drunkMl >= today.goalMl)}
              onChange={(next) => {
                void updateHydrationSettings({
                  remindersEnabled: next.enabled,
                  reminderTimes: next.times,
                }).then(() => refresh())
              }}
            />
            <WaterHistory7d goalMl={today?.goalMl ?? GOAL_DEFAULT_ML} />
          </>
        )}
      </div>
    </IosSheet>
  )
}
