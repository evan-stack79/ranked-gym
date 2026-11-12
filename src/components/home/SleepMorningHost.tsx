import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { planMorningAutoLog } from '../../utils/sleepAutoLog'
import { todayDateKey, minutesToHm } from '../../utils/sleepTimeFormat'
import {
  getMorningPromptDateKey,
  getSleepNightByDateKey,
  getSleepSchedule,
  markMorningPromptShown,
  saveSleepNight,
  SLEEP_CHANGED_EVENT,
  type SleepNightEntry,
} from '../../services/sleepStorage'
import { handleSleepAlarmNotificationAction } from '../../services/sleepAlarmService'
import {
  isRankedAlarmPluginAvailable,
  RankedAlarm,
} from '../../native/rankedAlarm'
import { MorningSleepModal } from './MorningSleepModal'

/**
 * Au 1er passage Accueil le matin (04–12 h) : auto-log + modal ressenti.
 * Aussi après Arrêter AlarmKit (stopIntent → pending flag), cold launch inclus.
 */
export function SleepMorningHost() {
  const [open, setOpen] = useState(false)
  const [night, setNight] = useState<SleepNightEntry | null>(null)

  const openMorningForNight = useCallback((entry: SleepNightEntry) => {
    markMorningPromptShown(entry.dateKey)
    setNight(entry)
    setOpen(true)
  }, [])

  /** Force path after AlarmKit stop — works outside 04–12 (ex. Tester 1 min). */
  const openFromAlarmStop = useCallback(async (): Promise<boolean> => {
    if (!isRankedAlarmPluginAvailable()) return false
    try {
      const pending = await RankedAlarm.consumePendingMorningPrompt()
      if (!pending.pending) return false
      const now = new Date()
      const dateKey = todayDateKey(now)
      const schedule = getSleepSchedule()
      const openHm = minutesToHm(now.getHours() * 60 + now.getMinutes()) ?? '07:00'
      const bedtime = schedule?.bedtime ?? '23:00'
      const waketime = schedule?.waketime ?? openHm
      let entry = getSleepNightByDateKey(dateKey)
      if (!entry) {
        entry = saveSleepNight({
          dateKey,
          bedtime,
          waketime,
          tstHours: null,
          source: 'auto',
        })
      }
      if (!entry) return false
      openMorningForNight(entry)
      return true
    } catch {
      return false
    }
  }, [openMorningForNight])

  const evaluate = useCallback(() => {
    const now = new Date()
    const dateKey = todayDateKey(now)
    const plan = planMorningAutoLog({
      now,
      schedule: getSleepSchedule(),
      nightAlreadyLogged: getSleepNightByDateKey(dateKey) != null,
      morningPromptDateKey: getMorningPromptDateKey(),
    })

    if (!plan.shouldRun || !plan.bedtime || !plan.waketime) return

    const saved = saveSleepNight({
      dateKey: plan.dateKey,
      bedtime: plan.bedtime,
      waketime: plan.waketime,
      tstHours: null,
      source: 'auto',
    })
    if (!saved) return
    openMorningForNight(saved)
  }, [openMorningForNight])

  useEffect(() => {
    void (async () => {
      const fromStop = await openFromAlarmStop()
      if (!fromStop) evaluate()
    })()
    const onFocus = () => {
      void (async () => {
        const fromStop = await openFromAlarmStop()
        if (!fromStop) evaluate()
      })()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener(SLEEP_CHANGED_EVENT, onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(SLEEP_CHANGED_EVENT, onFocus)
    }
  }, [evaluate, openFromAlarmStop])

  // Resume after stopIntent opened / foregrounded the app (no @capacitor/app dep).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void openFromAlarmStop()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [openFromAlarmStop])

  // iOS < 26 : actions Répéter / Arrêter de la notif locale réveil.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return
    let cancelled = false
    let handle: { remove: () => Promise<void> } | null = null
    void (async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        handle = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (event) => {
            const actionId = event.actionId
            const kind = (event.notification.extra as { kind?: string } | undefined)?.kind
            if (kind !== 'sleep-alarm' && kind !== 'sleep-alarm-snooze') return
            void handleSleepAlarmNotificationAction(actionId)
            if (actionId === 'SLEEP_ALARM_STOP') evaluate()
          },
        )
        if (cancelled) await handle.remove()
      } catch {
        // plugin absent — ignore
      }
    })()
    return () => {
      cancelled = true
      void handle?.remove()
    }
  }, [evaluate])

  return (
    <MorningSleepModal
      open={open}
      night={night}
      onClose={() => setOpen(false)}
      onDone={() => {
        setOpen(false)
        setNight(getSleepNightByDateKey(todayDateKey()))
      }}
    />
  )
}
