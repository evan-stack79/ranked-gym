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
import {
  FACE_UNAVAILABLE_MESSAGE,
  isFaceDetectorAvailable,
} from '../../services/hydration/faceRefuse'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { isMinorOrUnknownAge } from '../../services/nutritionSafetyRules'
import { GOAL_DEFAULT_ML, localDayKey, type HydrationMode } from '../../shared/hydration'

interface WaterSettingsSheetProps {
  open: boolean
  onClose: () => void
}

export function WaterSettingsSheet({ open, onClose }: WaterSettingsSheetProps) {
  const [today, setToday] = useState<HydrationToday | null>(null)
  const [showCapture, setShowCapture] = useState(false)
  const [showProGate, setShowProGate] = useState(false)
  const [faceGateMsg, setFaceGateMsg] = useState<string | null>(null)
  const minorLocked = isMinorOrUnknownAge(getCalorieProfile().age)

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
    if (minorLocked) return
    await updateHydrationSettings({ goalMl })
    await refresh()
  }

  const saveMode = async (mode: HydrationMode) => {
    if (mode === 'my_bottle') {
      if (!today?.proActive) {
        setShowProGate(true)
        return
      }
      if (!isFaceDetectorAvailable()) {
        setFaceGateMsg(FACE_UNAVAILABLE_MESSAGE)
        return
      }
      setFaceGateMsg(null)
      setShowCapture(true)
      return
    }
    await updateHydrationSettings({ mode })
    await refresh()
  }

  const fallback2L = async () => {
    setShowCapture(false)
    setShowProGate(false)
    setFaceGateMsg(null)
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

        {faceGateMsg ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[13px] leading-snug text-[#C7C7CC]">{faceGateMsg}</p>
            <button
              type="button"
              onClick={() => void fallback2L()}
              className="ios-press min-h-11 w-full rounded-2xl bg-[#FF0702] text-[14px] font-semibold text-white"
            >
              Utiliser le mode 2 L
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
            {minorLocked ? (
              <div data-hydration-goal-locked className="space-y-1">
                <p className="text-[15px] font-semibold text-white">Objectif du jour</p>
                <p className="text-[13px] text-[#ACB4BA]">
                  Objectif par défaut — non modifiable ici.
                </p>
              </div>
            ) : (
              <WaterGoalSlider
                valueMl={today?.goalMl ?? GOAL_DEFAULT_ML}
                onChange={(g) => void saveGoal(g)}
              />
            )}
            <WaterReminders
              enabled={today?.remindersEnabled ?? false}
              times={today?.reminderTimes ?? []}
              goalReachedToday={Boolean(today && today.drunkMl >= today.goalMl)}
              onChange={(next) => {
                void (async () => {
                  await updateHydrationSettings({
                    remindersEnabled: next.enabled,
                    reminderTimes: next.times,
                  })
                  // M2 — sync conserve la récurrence ; goalReached pause seulement aujourd’hui.
                  const data = await fetchHydrationToday(localDayKey())
                  if (next.enabled) {
                    await syncHydrationReminders({
                      enabled: true,
                      times: next.times,
                      goalReachedToday: data.drunkMl >= data.goalMl,
                    })
                  } else {
                    await syncHydrationReminders({ enabled: false, times: next.times })
                  }
                  await refresh()
                })()
              }}
            />
            <WaterHistory7d goalMl={today?.goalMl ?? GOAL_DEFAULT_ML} />
          </>
        )}
      </div>
    </IosSheet>
  )
}
