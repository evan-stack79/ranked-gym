import { useCallback, useEffect, useState } from 'react'
import { IosSheet } from '../ui/IosSheet'
import { WaterContainerCarousel } from './WaterContainerCarousel'
import { WaterGoalColumn } from './WaterGoalColumn'
import { WaterReminderBell } from './WaterReminderBell'
import { WaterReminderScheduleSheet } from './WaterReminderScheduleSheet'
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
import {
  GOAL_DEFAULT_ML,
  LABEL_REPERE_JOUR,
  MSG_MINOR_PERMANENT,
  MSG_PRO_BOTTLE,
  MSG_REPERE_LOCKED,
  localDayKey,
  type HydrationMode,
} from '../../shared/hydration'

interface WaterSettingsSheetProps {
  open: boolean
  onClose: () => void
}

export function WaterSettingsSheet({ open, onClose }: WaterSettingsSheetProps) {
  const [today, setToday] = useState<HydrationToday | null>(null)
  const [showCapture, setShowCapture] = useState(false)
  const [showProGate, setShowProGate] = useState(false)
  const [faceGateMsg, setFaceGateMsg] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [goalDragging, setGoalDragging] = useState(false)
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
    setToday((prev) =>
      prev
        ? {
            ...prev,
            goalMl,
            remainingMl: Math.max(0, goalMl - prev.drunkMl),
          }
        : prev,
    )
    await updateHydrationSettings({ goalMl })
    // refresh respecte le pending local si Convex a refusé
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
    // Optimiste UI immédiat — updateHydrationSettings écrit aussi le cache local.
    setToday((prev) =>
      prev
        ? {
            ...prev,
            mode,
            effectiveVisualMode: mode,
          }
        : prev,
    )
    await updateHydrationSettings({ mode })
    await refresh()
  }

  const fallback2L = async () => {
    setShowCapture(false)
    setShowProGate(false)
    setFaceGateMsg(null)
    await clearBottleShapeLocal()
    await deleteMyBottleRemote().catch(() => undefined)
    setToday((prev) =>
      prev
        ? { ...prev, mode: 'classic_2l', effectiveVisualMode: 'classic_2l' }
        : prev,
    )
    await updateHydrationSettings({ mode: 'classic_2l' })
    await refresh()
  }

  const persistReminders = async (next: { enabled: boolean; times: string[] }) => {
    setToday((prev) =>
      prev
        ? {
            ...prev,
            remindersEnabled: next.enabled,
            reminderTimes: next.times,
          }
        : prev,
    )
    await updateHydrationSettings({
      remindersEnabled: next.enabled,
      reminderTimes: next.times,
    })
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
  }

  return (
    <>
      <IosSheet
        open={open}
        onClose={onClose}
        title="Eau"
        dismissible={!goalDragging}
        scrollLocked={goalDragging}
      >
        <div className="space-y-5 pb-8" data-hydration-settings-bv2>
          {showProGate ? (
            <div className="space-y-3 rounded-2xl border border-[#FF0702]/25 bg-[#FF0702]/5 p-4">
              <p className="text-[15px] font-semibold text-white">Pass Pro</p>
              <p className="text-[13px] leading-snug text-[#C7C7CC]">
                Ma bouteille est un look cosmétique Pass Pro. Les modes 2 L et verres restent gratuits,
                avec le même suivi.
              </p>
              <p className="text-[12px] leading-snug text-[#8E8E93]">{MSG_PRO_BOTTLE}</p>
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
              <WaterContainerCarousel
                mode={today?.mode ?? 'classic_2l'}
                proActive={today?.proActive ?? false}
                onSelect={(m) => void saveMode(m)}
                onRequestPro={() => setShowProGate(true)}
              />

              {today?.mode === 'my_bottle' && today.proActive ? (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[13px] leading-snug text-[#ACB4BA]">
                    Look cosmétique Pass Pro. Aucun avantage de jeu.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isFaceDetectorAvailable()) {
                        setFaceGateMsg(FACE_UNAVAILABLE_MESSAGE)
                        return
                      }
                      setShowCapture(true)
                    }}
                    className="ios-press min-h-11 w-full rounded-2xl border border-white/15 text-[14px] font-semibold text-white"
                    data-hydration-change-photo
                  >
                    {today.myBottleHasShape ? 'Changer la photo' : 'Prendre en photo'}
                  </button>
                  {typeof today.myBottleVolumeMl === 'number' ? (
                    <p className="text-center text-[12px] text-[#8E8E93]">
                      Capacité : {today.myBottleVolumeMl}&nbsp;ml
                    </p>
                  ) : null}
                </div>
              ) : null}

              {minorLocked ? (
                <div data-hydration-goal-locked className="space-y-1">
                  <p className="text-[15px] font-semibold text-white">{LABEL_REPERE_JOUR}</p>
                  <p className="text-[13px] text-[#ACB4BA]" data-hydration-repere-locked>
                    {MSG_REPERE_LOCKED}
                  </p>
                  <p className="text-[12px] leading-snug text-[#8E8E93]" data-hydration-minor-permanent>
                    {MSG_MINOR_PERMANENT}
                  </p>
                </div>
              ) : (
                <WaterGoalColumn
                  valueMl={today?.goalMl ?? GOAL_DEFAULT_ML}
                  onChange={(g) => void saveGoal(g)}
                  onDraggingChange={setGoalDragging}
                />
              )}

              <WaterReminderBell
                enabled={today?.remindersEnabled ?? false}
                times={today?.reminderTimes ?? []}
                goalReachedToday={Boolean(today && today.drunkMl >= today.goalMl)}
                useRepereCopy={minorLocked}
                onChange={(next) => {
                  void persistReminders(next)
                }}
                onOpenSchedule={() => setScheduleOpen(true)}
              />
            </>
          )}
        </div>
      </IosSheet>

      <WaterReminderScheduleSheet
        open={scheduleOpen}
        times={today?.reminderTimes ?? []}
        onClose={() => setScheduleOpen(false)}
        onSave={(nextTimes) => {
          void persistReminders({
            enabled: today?.remindersEnabled ?? true,
            times: nextTimes,
          })
        }}
      />
    </>
  )
}
