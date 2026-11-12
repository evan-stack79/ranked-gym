import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Pencil } from 'lucide-react'
import {
  getSleepSchedule,
  saveSleepSchedule,
  SLEEP_CHANGED_EVENT,
} from '../../services/sleepStorage'
import {
  SLEEP_ALARM_CHANGED_EVENT,
  SLEEP_ALARM_SOUND_LABEL,
  getSleepAlarmSettings,
  saveSleepAlarmSettings,
} from '../../services/sleepAlarmStorage'
import {
  formatAlarmScheduledMessage,
  isSleepAlarmPlatformSupported,
  syncFailureMessage,
  syncSleepAlarm,
  type SleepAlarmUiStatus,
  readSleepAlarmUiStatus,
} from '../../services/sleepAlarmService'
import { formatRepeatSummary } from '../../utils/sleepAlarmSchedule'
import {
  formatClockHm,
  formatFrenchLongDate,
} from '../../utils/sleepTimeFormat'
import { SleepAlarmDiagBlock } from './SleepAlarmDiagBlock'
import { SleepAlarmSheet, type SleepAlarmSheetPane } from './SleepAlarmSheet'
import { SleepAlarmStatusBanner } from './SleepAlarmStatusBanner'
import { SleepClockDial } from './SleepClockDial'
import { SleepHmWheelSheet } from './SleepHmWheelSheet'

const RED = '#ff0702'
const CARD = '#1C1C1E'
const GRAY = '#ACB4BA'

/**
 * Page Sommeil v11 — onglet navbar (plein écran).
 * Cadran + cartes Coucher/Réveil + Sonnerie/Répétition + Dormir maintenant.
 */
export function SleepView() {
  const [tick, setTick] = useState(0)
  const [bedtime, setBedtime] = useState('23:00')
  const [waketime, setWaketime] = useState('07:00')
  const [wheelTarget, setWheelTarget] = useState<'bed' | 'wake' | null>(null)
  const [alarmPane, setAlarmPane] = useState<SleepAlarmSheetPane | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SleepAlarmUiStatus>({ kind: 'off' })
  const [diagExpanded, setDiagExpanded] = useState(false)
  const showAlarm = isSleepAlarmPlatformSupported()
  const titleTaps = useRef({ count: 0, last: 0 })

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener(SLEEP_CHANGED_EVENT, sync)
    window.addEventListener(SLEEP_ALARM_CHANGED_EVENT, sync)
    window.addEventListener('ranked-gym:backup-restored', sync)
    return () => {
      window.removeEventListener(SLEEP_CHANGED_EVENT, sync)
      window.removeEventListener(SLEEP_ALARM_CHANGED_EVENT, sync)
      window.removeEventListener('ranked-gym:backup-restored', sync)
    }
  }, [])

  useEffect(() => {
    const schedule = getSleepSchedule()
    const alarm = getSleepAlarmSettings()
    setBedtime(schedule?.bedtime ?? '23:00')
    setWaketime(schedule?.waketime ?? alarm.timeHm ?? '07:00')
  }, [tick])

  useEffect(() => {
    if (!showAlarm) return
    let cancelled = false
    void readSleepAlarmUiStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [showAlarm, tick, confirmMsg])

  const alarm = useMemo(() => getSleepAlarmSettings(), [tick])
  const dateLabel = useMemo(() => formatFrenchLongDate(), [tick])
  const soundLabel =
    alarm.soundId === 'none' ? 'Aucune' : SLEEP_ALARM_SOUND_LABEL
  const repeatLabel = formatRepeatSummary(alarm.days)

  const persistWindow = (nextBed: string, nextWake: string) => {
    setBedtime(nextBed)
    setWaketime(nextWake)
    saveSleepSchedule({ bedtime: nextBed, waketime: nextWake })
    // Keep alarm time aligned with réveil handle (without enabling).
    const cur = getSleepAlarmSettings()
    if (cur.timeHm !== nextWake) {
      saveSleepAlarmSettings({ timeHm: nextWake })
    }
  }

  const onDialChange = (next: { bedtime: string; waketime: string }) => {
    persistWindow(next.bedtime, next.waketime)
  }

  const onWheelSave = (hm: string) => {
    if (wheelTarget === 'bed') persistWindow(hm, waketime)
    else if (wheelTarget === 'wake') persistWindow(bedtime, hm)
  }

  const onSleepNow = async () => {
    setSaving(true)
    setError(null)
    setConfirmMsg(null)
    persistWindow(bedtime, waketime)
    const result = await syncSleepAlarm({
      ...getSleepAlarmSettings(),
      timeHm: waketime,
      enabled: true,
    })
    setSaving(false)
    if (!result.ok) {
      const msg = syncFailureMessage(result.reason)
      setError(msg)
      if (result.reason === 'PERMISSION_DENIED') {
        setStatus({ kind: 'permission' })
      } else {
        setStatus({ kind: 'error', message: msg })
      }
      return
    }
    const timeHm = result.timeHm ?? waketime
    setConfirmMsg(formatAlarmScheduledMessage(timeHm))
    setStatus({
      kind: 'scheduled',
      timeHm,
      summary: formatRepeatSummary(getSleepAlarmSettings().days),
    })
    setTick((n) => n + 1)
  }

  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-lg flex-col px-5 pb-8"
      style={{
        paddingTop: 'max(1.25rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))',
        backgroundColor: '#000000',
      }}
      data-sleep-page
      data-sleep-route="sommeil"
    >
      <header className="mb-3">
        <button
          type="button"
          className="text-left"
          onClick={() => {
            const now = Date.now()
            if (now - titleTaps.current.last > 1200) titleTaps.current.count = 0
            titleTaps.current.last = now
            titleTaps.current.count += 1
            if (titleTaps.current.count >= 5) {
              titleTaps.current.count = 0
              setDiagExpanded((v) => !v)
            }
          }}
        >
          <h1 className="text-[28px] font-bold tracking-tight text-white">Sommeil</h1>
        </button>
        <p className="mt-0.5 text-[15px]" style={{ color: GRAY }} data-sleep-page-date>
          {dateLabel}
        </p>
      </header>

      <SleepClockDial bedtime={bedtime} waketime={waketime} onChange={onDialChange} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setWheelTarget('bed')}
          className="ios-press rounded-2xl px-3.5 py-3 text-left"
          style={{ backgroundColor: CARD }}
          data-sleep-card-bed
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[13px]" style={{ color: GRAY }}>
              Coucher
            </span>
            <Pencil className="h-3.5 w-3.5" style={{ color: GRAY }} aria-hidden />
          </span>
          <span className="mt-1 block text-[22px] font-bold tabular-nums text-white">
            {formatClockHm(bedtime)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setWheelTarget('wake')}
          className="ios-press rounded-2xl px-3.5 py-3 text-left"
          style={{ backgroundColor: CARD }}
          data-sleep-card-wake
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[13px]" style={{ color: GRAY }}>
              Réveil
            </span>
            <Pencil className="h-3.5 w-3.5" style={{ color: GRAY }} aria-hidden />
          </span>
          <span className="mt-1 block text-[22px] font-bold tabular-nums text-white">
            {formatClockHm(waketime)}
          </span>
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
        <button
          type="button"
          onClick={() => setAlarmPane('sound')}
          className="ios-press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          data-sleep-row-sound
        >
          <span className="text-[16px] text-white">Sonnerie</span>
          <span className="flex min-w-0 items-center gap-1 text-[15px]" style={{ color: GRAY }}>
            <span className="truncate">{soundLabel}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </span>
        </button>
        <div className="mx-4 h-px bg-white/10" />
        <button
          type="button"
          onClick={() => setAlarmPane('days')}
          className="ios-press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          data-sleep-row-repeat
        >
          <span className="text-[16px] text-white">Répétition</span>
          <span className="flex min-w-0 items-center gap-1 text-[15px]" style={{ color: GRAY }}>
            <span className="truncate">{repeatLabel}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => void onSleepNow()}
        disabled={saving}
        className="ios-press mt-5 w-full rounded-2xl py-4 text-[17px] font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: RED }}
        data-sleep-now
      >
        {saving ? 'Enregistrement…' : 'Dormir maintenant'}
      </button>

      <div className="mt-3 space-y-2">
        {confirmMsg ? (
          <p className="text-[14px] font-medium text-white" data-sleep-alarm-confirm>
            {confirmMsg}
          </p>
        ) : (
          <SleepAlarmStatusBanner status={status} />
        )}
        {error && status.kind !== 'permission' ? (
          <p className="text-[13px] text-[#FF907F]">{error}</p>
        ) : null}
      </div>

      {/* Diag beta always visible on page (iOS native gets live AlarmKit fields). */}
      <SleepAlarmDiagBlock open expanded={diagExpanded} />

      <SleepHmWheelSheet
        open={wheelTarget != null}
        onClose={() => setWheelTarget(null)}
        title={wheelTarget === 'bed' ? 'Coucher' : 'Réveil'}
        valueHm={wheelTarget === 'bed' ? bedtime : waketime}
        onSave={onWheelSave}
      />

      <SleepAlarmSheet
        open={alarmPane != null}
        onClose={() => {
          setAlarmPane(null)
          setTick((n) => n + 1)
        }}
        initialPane={alarmPane ?? 'main'}
      />
    </div>
  )
}
