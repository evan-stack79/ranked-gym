import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { useSleepPageActive } from '../../hooks/useSleepPageActive'
import { SleepAlarmDiagBlock } from './SleepAlarmDiagBlock'
import { SleepAlarmSheet, type SleepAlarmSheetPane } from './SleepAlarmSheet'
import { SleepAlarmStatusBanner } from './SleepAlarmStatusBanner'
import { SleepClockDial } from './SleepClockDial'
import { SleepHmWheelSheet } from './SleepHmWheelSheet'
import { SleepLottie } from './sleepLottie/SleepLottie'

const RED = '#ff0702'
const CARD = '#1C1C1E'
const GRAY = '#ACB4BA'

/**
 * Page Sommeil v11 — tient en un écran sur iPhone 17 (scroll seulement si trop petit).
 * Pas de padding safe-area ici : AppLayout (data-app-content-pad=sleep) le gère.
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
  const [dialSize, setDialSize] = useState(320)
  const [sleepNowAnim, setSleepNowAnim] = useState(false)
  const [bedIconPlay, setBedIconPlay] = useState(false)
  const [wakeIconPlay, setWakeIconPlay] = useState(false)
  const showAlarm = isSleepAlarmPlatformSupported()
  const pageActive = useSleepPageActive()
  const titleTaps = useRef({ count: 0, last: 0 })
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const compute = () => {
      // ≈ largeur écran − 2×40 pt (Evan) — iPhone 17 ≈ 320 ; SE un peu moins.
      const vw = window.visualViewport?.width ?? window.innerWidth
      const byWidth = Math.round(vw - 80)
      setDialSize(Math.max(260, Math.min(340, byWidth)))
    }
    compute()
    window.addEventListener('resize', compute)
    window.visualViewport?.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('resize', compute)
      window.visualViewport?.removeEventListener('resize', compute)
    }
  }, [])

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
    const cur = getSleepAlarmSettings()
    if (cur.timeHm !== nextWake) {
      saveSleepAlarmSettings({ timeHm: nextWake })
    }
  }

  /** Reschedule AlarmKit when the réveil window changes and an alarm is armed. */
  const rescheduleAlarmIfNeeded = (nextWake: string) => {
    if (!showAlarm) return
    const cur = getSleepAlarmSettings()
    if (!cur.enabled) return
    void syncSleepAlarm({ ...cur, timeHm: nextWake, enabled: true }).then((result) => {
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
      const timeHm = result.timeHm ?? nextWake
      setStatus({
        kind: 'scheduled',
        timeHm,
        summary: formatRepeatSummary(getSleepAlarmSettings().days),
      })
      setTick((n) => n + 1)
    })
  }

  const onDialChange = (next: { bedtime: string; waketime: string }) => {
    persistWindow(next.bedtime, next.waketime)
  }

  const onDialCommit = (next: { bedtime: string; waketime: string }) => {
    persistWindow(next.bedtime, next.waketime)
    rescheduleAlarmIfNeeded(next.waketime)
  }

  const onWheelSave = (hm: string) => {
    if (wheelTarget === 'bed') {
      persistWindow(hm, waketime)
      rescheduleAlarmIfNeeded(waketime)
    } else if (wheelTarget === 'wake') {
      persistWindow(bedtime, hm)
      rescheduleAlarmIfNeeded(hm)
    }
  }

  const onSleepNow = async () => {
    setSleepNowAnim(true)
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
      ref={rootRef}
      className="flex min-h-0 w-full flex-col"
      data-sleep-page
      data-sleep-route="sommeil"
    >
      <header className="shrink-0 pb-1">
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
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white">
            Sommeil
          </h1>
        </button>
        <p className="mt-0.5 text-[14px]" style={{ color: GRAY }} data-sleep-page-date>
          {dateLabel}
        </p>
      </header>

      <div className="relative shrink-0 py-1">
        {/* Only looping Lottie on this page — paused when hidden / background. */}
        <SleepLottie
          name="its-sleeptime"
          loop
          playing={pageActive && !sleepNowAnim}
          className="pointer-events-none absolute inset-0 z-0 mx-auto opacity-[0.22]"
          style={{ width: dialSize + 48, height: dialSize + 48, left: '50%', transform: 'translateX(-50%)' }}
          aria-hidden
          data-testid="sleep-lottie-dial-bg"
        />
        <div className="relative z-[1]">
          <SleepClockDial
            bedtime={bedtime}
            waketime={waketime}
            onChange={onDialChange}
            onCommit={onDialCommit}
            size={dialSize}
          />
        </div>
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setBedIconPlay(true)
            setWheelTarget('bed')
          }}
          className="ios-press rounded-2xl px-3 py-2.5 text-left"
          style={{ backgroundColor: CARD }}
          data-sleep-card-bed
        >
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: GRAY }}>
              <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden>
                <SleepLottie
                  name="moon"
                  playing={bedIconPlay}
                  loop={false}
                  className="h-5 w-5"
                  onComplete={() => setBedIconPlay(false)}
                />
              </span>
              Coucher
            </span>
            <Pencil className="h-3.5 w-3.5" style={{ color: GRAY }} aria-hidden />
          </span>
          <span className="mt-0.5 block text-[20px] font-bold tabular-nums text-white">
            {formatClockHm(bedtime)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setWakeIconPlay(true)
            setWheelTarget('wake')
          }}
          className="ios-press rounded-2xl px-3 py-2.5 text-left"
          style={{ backgroundColor: CARD }}
          data-sleep-card-wake
        >
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: GRAY }}>
              <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden>
                <SleepLottie
                  name="sunrise"
                  playing={wakeIconPlay}
                  loop={false}
                  className="h-5 w-5"
                  onComplete={() => setWakeIconPlay(false)}
                />
              </span>
              Réveil
            </span>
            <Pencil className="h-3.5 w-3.5" style={{ color: GRAY }} aria-hidden />
          </span>
          <span className="mt-0.5 block text-[20px] font-bold tabular-nums text-white">
            {formatClockHm(waketime)}
          </span>
        </button>
      </div>

      <div
        className="mt-2.5 shrink-0 overflow-hidden rounded-2xl"
        style={{ backgroundColor: CARD }}
      >
        <button
          type="button"
          onClick={() => setAlarmPane('sound')}
          className="ios-press flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          data-sleep-row-sound
        >
          <span className="text-[15px] text-white">Sonnerie</span>
          <span className="flex min-w-0 items-center gap-1 text-[14px]" style={{ color: GRAY }}>
            <span className="truncate">{soundLabel}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </span>
        </button>
        <div className="mx-4 h-px bg-white/10" />
        <button
          type="button"
          onClick={() => setAlarmPane('days')}
          className="ios-press flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          data-sleep-row-repeat
        >
          <span className="text-[15px] text-white">Répétition</span>
          <span className="flex min-w-0 items-center gap-1 text-[14px]" style={{ color: GRAY }}>
            <span className="truncate">{repeatLabel}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => void onSleepNow()}
        disabled={saving}
        className="ios-press mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: RED }}
        data-sleep-now
      >
        {(sleepNowAnim || saving) && (
          <SleepLottie
            name="sleepy-moon"
            playing
            loop={false}
            className="h-7 w-7 shrink-0"
            aria-hidden
            onComplete={() => setSleepNowAnim(false)}
          />
        )}
        {saving ? 'Enregistrement…' : 'Dormir maintenant'}
      </button>

      <div className="mt-2 shrink-0 space-y-1">
        {confirmMsg ? (
          <div className="flex items-center gap-2" data-sleep-alarm-confirm>
            <SleepLottie name="alarm" playing loop={false} className="h-8 w-8 shrink-0" aria-hidden />
            <p className="text-[13px] font-medium text-white">{confirmMsg}</p>
          </div>
        ) : (
          <SleepAlarmStatusBanner status={status} />
        )}
        {error && status.kind !== 'permission' ? (
          <p className="text-[12px] text-[#FF907F]">{error}</p>
        ) : null}
      </div>

      <div className="mt-1 shrink-0">
        <SleepAlarmDiagBlock open expanded={diagExpanded} />
      </div>

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
