import { useCallback, useEffect, useState } from 'react'
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
