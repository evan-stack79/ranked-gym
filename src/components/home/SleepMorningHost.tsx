import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { planMorningAutoLog } from '../../utils/sleepAutoLog'
import { todayDateKey } from '../../utils/sleepTimeFormat'
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
import { MorningSleepModal } from './MorningSleepModal'

/**
 * Au 1er passage Accueil le matin (04–12 h) : auto-log + modal ressenti.
 * Une fois par jour max. Données locales.
 */
export function SleepMorningHost() {
  const [open, setOpen] = useState(false)
  const [night, setNight] = useState<SleepNightEntry | null>(null)

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
    markMorningPromptShown(plan.dateKey)
    if (!saved) return
    setNight(saved)
    setOpen(true)
  }, [])

  useEffect(() => {
    evaluate()
    const onFocus = () => evaluate()
    window.addEventListener('focus', onFocus)
    window.addEventListener(SLEEP_CHANGED_EVENT, onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(SLEEP_CHANGED_EVENT, onFocus)
    }
  }, [evaluate])

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
            // Arrêter → la modal « Tu as bien dormi ? » s’affiche via evaluate() au focus.
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
