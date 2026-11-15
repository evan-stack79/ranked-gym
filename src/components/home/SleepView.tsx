import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Pencil } from 'lucide-react'
import {
  getRecentSleepNights,
  getSleepSchedule,
  saveSleepSchedule,
  SLEEP_CHANGED_EVENT,
} from '../../services/sleepStorage'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { SleepWeekBlock } from './sleepWeek/SleepWeekBlock'
import {
  SLEEP_ALARM_CHANGED_EVENT,
  SLEEP_ALARM_SOUND_LABEL,
  getSleepAlarmSettings,
  saveSleepAlarmSettings,
} from '../../services/sleepAlarmStorage'
import {
  cancelSleepAlarm,
  isSleepAlarmPlatformSupported,
  readBatteryWarning,
  syncFailureMessage,
  syncSleepAlarm,
  type SleepAlarmUiStatus,
  readSleepAlarmUiStatus,
} from '../../services/sleepAlarmService'
import { RankedAlarm, isRankedAlarmPluginAvailable } from '../../native/rankedAlarm'
import { formatRepeatSummary } from '../../utils/sleepAlarmSchedule'
import {
  formatClockHm,
  formatFrenchLongDate,
} from '../../utils/sleepTimeFormat'
import { useSleepPageActive } from '../../hooks/useSleepPageActive'
import { SleepAlarmDiagBlock } from './SleepAlarmDiagBlock'
import {
  isSleepAlarmDiagEnabled,
  setSleepAlarmDiagEnabled,
} from '../../utils/sleepAlarmDiagGate'
import { SleepAlarmSheet, type SleepAlarmSheetPane } from './SleepAlarmSheet'
import { SleepAlarmStatusBanner } from './SleepAlarmStatusBanner'
import { SleepClockDial } from './SleepClockDial'
import { SleepHmWheelSheet } from './SleepHmWheelSheet'
import { SleepLottie } from './sleepLottie/SleepLottie'
import { HvFlow, type HvFlowPane } from './horairesVariables/HvFlow'
import { HvLottie } from './horairesVariables/HvLottie'
import {
  HV_CHANGED_EVENT,
  getHvState,
  saveHvState,
} from '../../services/horairesVariables/storage'
import { syncHvAlarms } from '../../services/horairesVariables/sync'
import {
  HV_FEATURE_NAME,
  HV_FEATURE_TITLE,
  HV_RED,
} from '../../horaires-variables/constants'
import {
  buildArmedWakes,
  canUseNightMode,
  dateKeyOf,
  hmToMinutes,
  hvStatus,
  isHvPaused,
  nextArmedWake,
  shouldAutoPause,
} from '../../horaires-variables/engine'
import {
  isInPlannedNight,
  shouldShowNextAlarmFirst,
  suggestedBedFromWake,
} from '../../horaires-variables/rules'

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
  const [diagGateTick, setDiagGateTick] = useState(0)
  const diagOpen = useMemo(() => {
    void diagGateTick
    return isSleepAlarmDiagEnabled()
  }, [diagGateTick])
  const [dialSize, setDialSize] = useState(320)
  const [sleepNowAnim, setSleepNowAnim] = useState(false)
  const [bedIconPlay, setBedIconPlay] = useState(false)
  const [wakeIconPlay, setWakeIconPlay] = useState(false)
  const [batteryWarn, setBatteryWarn] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [hvOpen, setHvOpen] = useState(false)
  const [hvPane, setHvPane] = useState<HvFlowPane>('activation')
  const [hvTick, setHvTick] = useState(0)
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
    const hvSync = () => setHvTick((n) => n + 1)
    window.addEventListener(SLEEP_CHANGED_EVENT, sync)
    window.addEventListener(SLEEP_ALARM_CHANGED_EVENT, sync)
    window.addEventListener(HV_CHANGED_EVENT, hvSync)
    window.addEventListener('ranked-gym:backup-restored', sync)
    return () => {
      window.removeEventListener(SLEEP_CHANGED_EVENT, sync)
      window.removeEventListener(SLEEP_ALARM_CHANGED_EVENT, sync)
      window.removeEventListener(HV_CHANGED_EVENT, hvSync)
      window.removeEventListener('ranked-gym:backup-restored', sync)
    }
  }, [])

  useEffect(() => {
    const hv = getHvState()
    if (!hv.settings.enabled) return
    const hasAnyStart = hv.days.some((d) => Boolean(d.startHm))
    if (shouldAutoPause({ settings: hv.settings, hasAnyStart })) {
      saveHvState({
        settings: { ...hv.settings, autoPaused: true, autoPauseCardDismissed: false },
      })
      void syncHvAlarms()
    } else {
      void syncHvAlarms()
    }
  }, [hvTick, tick])

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

  useEffect(() => {
    if (!showAlarm) return
    const refresh = () => setTick((n) => n + 1)
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', refresh)
    let handle: { remove: () => void } | undefined
    if (isRankedAlarmPluginAvailable() && typeof RankedAlarm.addListener === 'function') {
      void RankedAlarm.addListener('alarmUpdates', refresh).then((h) => {
        handle = h
      })
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', refresh)
      handle?.remove()
    }
  }, [showAlarm])

  const alarm = useMemo(() => getSleepAlarmSettings(), [tick])
  const hvState = useMemo(() => {
    void hvTick
    return getHvState()
  }, [hvTick, tick])
  const hvPause = isHvPaused(hvState.settings, dateKeyOf(new Date()))
  const hvToday = dateKeyOf(new Date())
  const hvStatusNow = hvStatus(hvState.settings, hvToday)
  const showAutoPauseCard =
    hvState.settings.enabled &&
    hvState.settings.autoPaused &&
    !hvState.settings.autoPauseCardDismissed

  const resolveHvOpenPane = (ageForPane: number): HvFlowPane => {
    if (!hvState.settings.enabled) return 'activation'
    if (hvPause.paused) return 'vacation'
    const armed = buildArmedWakes({
      days: hvState.days,
      trajetMin: hvState.settings.trajetMin,
      prepMin: hvState.settings.prepMin,
      fromDateKey: hvToday,
    })
    const next = nextArmedWake(armed)
    if (next && canUseNightMode(ageForPane)) {
      const bed = suggestedBedFromWake({
        wakeDateKey: next.dateKey,
        wakeHm: next.wakeHm,
        age: ageForPane,
      })
      if (bed) {
        const windowArgs = {
          now: new Date(),
          bedDateKey: bed.bedDateKey,
          bedHm: bed.bedHm,
          wakeDateKey: next.dateKey,
          wakeHm: next.wakeHm,
        }
        if (isInPlannedNight(windowArgs)) return 'night'
        if (shouldShowNextAlarmFirst(windowArgs)) return 'quick'
      }
    }
    return 'planning'
  }
  const dateLabel = useMemo(() => formatFrenchLongDate(), [tick])
  const soundLabel =
    alarm.soundId === 'none' ? 'Aucune' : SLEEP_ALARM_SOUND_LABEL
  const repeatLabel = formatRepeatSummary(alarm.days)
  const alarmArmed = alarm.enabled || status.kind === 'scheduled' || status.kind === 'mismatch'

  const persistWindow = (nextBed: string, nextWake: string) => {
    setBedtime(nextBed)
    setWaketime(nextWake)
    saveSleepSchedule({ bedtime: nextBed, waketime: nextWake })
    const cur = getSleepAlarmSettings()
    if (cur.timeHm !== nextWake) {
      saveSleepAlarmSettings({ timeHm: nextWake })
    }
  }

  const applySyncResult = (
    result: Awaited<ReturnType<typeof syncSleepAlarm>>,
    fallbackHm: string,
  ) => {
    if (result.superseded) return
    if (!result.ok) {
      const msg = syncFailureMessage(result.reason)
      setError(msg)
      if (result.reason === 'PERMISSION_DENIED') {
        setStatus({ kind: 'permission' })
      } else {
        setStatus({ kind: 'error', message: msg, openSettings: true })
      }
      return
    }
    const timeHm = result.timeHm ?? fallbackHm
    setConfirmMsg(result.readback ?? null)
    setStatus({
      kind: 'scheduled',
      timeHm,
      summary: formatRepeatSummary(getSleepAlarmSettings().days),
      readback: result.readback ?? timeHm,
      fireAtIso: result.fireAtIso,
    })
    setTick((n) => n + 1)
  }

  /** Reschedule AlarmKit when the réveil window changes and an alarm is armed. */
  const rescheduleAlarmIfNeeded = (nextWake: string) => {
    if (!showAlarm) return
    const cur = getSleepAlarmSettings()
    if (!cur.enabled) return
    void syncSleepAlarm({ ...cur, timeHm: nextWake, enabled: true }).then((result) => {
      applySyncResult(result, nextWake)
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
    setBatteryWarn(false)
    persistWindow(bedtime, waketime)

    // Nuit très courte (écran 08) : réveil dans ≤ 90 min → décalage proposé (état 15).
    const now = new Date()
    const age = getCalorieProfile().age
    const wakeMin = hmToMinutes(waketime)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (wakeMin != null) {
      let delta = wakeMin - nowMin
      if (delta < 0) delta += 24 * 60
      if (delta > 0 && delta <= 90) {
        setSaving(false)
        setSleepNowAnim(false)
        setHvPane('shortNight')
        setHvOpen(true)
        return
      }
    }

    // Écran nuit / Prochain réveil — planned HV window (point 8). Age optional.
    if (canUseNightMode(age) && hvState.settings.enabled && !hvPause.paused) {
      const preferred = resolveHvOpenPane(age)
      if (preferred === 'night' || preferred === 'quick') {
        setSaving(false)
        setSleepNowAnim(false)
        setHvPane(preferred)
        setHvOpen(true)
        return
      }
    }

    const bedMin = hmToMinutes(bedtime)
    if (canUseNightMode(age) && bedMin != null && wakeMin != null) {
      const inNight =
        bedMin < wakeMin
          ? nowMin >= bedMin && nowMin < wakeMin
          : nowMin >= bedMin || nowMin < wakeMin
      if (inNight) {
        setSaving(false)
        setSleepNowAnim(false)
        setHvPane('night')
        setHvOpen(true)
        return
      }
    }

    const lowBat = await readBatteryWarning()
    if (lowBat) setBatteryWarn(true)
    // One-shot next wake — never reuse Mon–Fri weekday list for « Dormir maintenant ».
    const result = await syncSleepAlarm({
      timeHm: waketime,
      days: [],
      enabled: true,
    })
    setSaving(false)
    applySyncResult(result, waketime)
  }

  const onDisableAlarm = async () => {
    setDisabling(true)
    setError(null)
    setConfirmMsg(null)
    const { remaining } = await cancelSleepAlarm()
    setDisabling(false)
    if (remaining !== 0) {
      setStatus({
        kind: 'mismatch',
        expected: 0,
        actual: remaining,
        message: 'Un réveil sonne encore. Réessaie.',
      })
      setTick((n) => n + 1)
      return
    }
    setStatus({ kind: 'off' })
    setTick((n) => n + 1)
  }

  const onRearm = () => {
    void onSleepNow()
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
              // Hidden unlock for release IPA / expand in DEV.
              if (!isSleepAlarmDiagEnabled()) {
                setSleepAlarmDiagEnabled(true)
                setDiagExpanded(true)
              } else {
                setDiagExpanded((v) => !v)
              }
              setDiagGateTick((n) => n + 1)
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
          <span className="text-[15px] text-white">Jours</span>
          <span className="flex min-w-0 items-center gap-1 text-[14px]" style={{ color: GRAY }}>
            <span className="truncate">{repeatLabel}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </span>
        </button>
      </div>

      {showAutoPauseCard ? (
        <div className="mt-3 shrink-0 rounded-2xl p-3" style={{ backgroundColor: CARD }} data-hv-auto-pause>
          <div className="flex gap-2">
            <HvLottie id="15" className="h-14 w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <small className="text-[11px] font-medium" style={{ color: GRAY }}>
                {HV_FEATURE_TITLE}
              </small>
              <b className="block text-[15px] text-white">Mon planning en pause</b>
              <p className="mt-0.5 text-[13px]" style={{ color: GRAY }}>
                Planning vide : on garde tes heures habituelles.
              </p>
              <small className="mt-1 block text-[11px]" style={{ color: GRAY }}>
                Rien de noté depuis 7 jours.
              </small>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="ios-press flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              onClick={() => {
                saveHvState({
                  settings: {
                    ...hvState.settings,
                    autoPaused: false,
                    autoPauseCardDismissed: true,
                    lastStartEditAt: new Date().toISOString(),
                  },
                })
                setHvPane('planning')
                setHvOpen(true)
              }}
            >
              Remplir mon planning
            </button>
            <button
              type="button"
              className="ios-press flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white"
              style={{ backgroundColor: '#2C2C2E' }}
              onClick={() =>
                saveHvState({
                  settings: { ...hvState.settings, autoPauseCardDismissed: true },
                })
              }
            >
              D&apos;accord
            </button>
          </div>
        </div>
      ) : null}

      {hvPause.paused && hvPause.reason === 'vacation' && !showAutoPauseCard ? (
        <p className="mt-2 text-center text-[12px]" style={{ color: GRAY }} data-hv-vacation-pause>
          Planning en pause.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void onSleepNow()}
        disabled={saving || disabling}
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
        {saving ? 'Je note…' : 'Je vais dormir'}
      </button>

      {showAlarm ? (
        <button
          type="button"
          onClick={() => setAlarmPane('main')}
          className="ios-press mt-2 flex w-full shrink-0 items-center justify-center gap-2 py-2.5 text-[15px] font-semibold"
          style={{ color: GRAY }}
          data-sleep-program-alarm
        >
          Régler mon réveil
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setHvPane(resolveHvOpenPane(getCalorieProfile().age))
          setHvOpen(true)
        }}
        className="ios-press mt-1 flex w-full shrink-0 items-center gap-3 rounded-2xl px-3 py-3 text-left"
        style={{ backgroundColor: CARD }}
        data-hv-entry
      >
        <HvLottie id="01" className="h-11 w-11 shrink-0" />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] text-white">{HV_FEATURE_TITLE}</b>
          <small className="block text-[12px]" style={{ color: GRAY }}>
            {HV_FEATURE_NAME}
          </small>
          <small
            className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: hvStatusNow.kind === 'active' ? '#fff' : GRAY }}
            data-hv-status={hvStatusNow.kind}
          >
            {hvStatusNow.kind === 'active' ? (
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: HV_RED }}
                aria-hidden
              />
            ) : null}
            {hvStatusNow.label}
          </small>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: GRAY }} />
      </button>

      {showAlarm && alarmArmed ? (
        <button
          type="button"
          onClick={() => void onDisableAlarm()}
          disabled={disabling || saving}
          className="ios-press mt-2 w-full shrink-0 py-2 text-center text-[14px] font-medium disabled:opacity-50"
          style={{ color: GRAY }}
          data-sleep-alarm-disable
        >
          {disabling ? 'Je coupe…' : 'Couper mon réveil'}
        </button>
      ) : null}

      <div className="mt-2 shrink-0 space-y-1">
        {batteryWarn ? (
          <p className="text-[13px] font-medium text-[#FF907F]" data-sleep-battery-warn>
            Batterie faible : branche ton tél.
          </p>
        ) : null}
        {confirmMsg ? (
          <div className="flex items-center gap-2" data-sleep-alarm-confirm>
            <SleepLottie name="alarm" playing loop={false} className="h-8 w-8 shrink-0" aria-hidden />
            <p className="text-[13px] font-medium text-white">{confirmMsg}</p>
          </div>
        ) : (
          <SleepAlarmStatusBanner status={status} onRearm={onRearm} />
        )}
        {error && status.kind !== 'permission' && status.kind !== 'error' ? (
          <p className="text-[12px] text-[#FF907F]">{error}</p>
        ) : null}
      </div>

      {diagOpen ? (
        <div className="mt-1 shrink-0" data-sleep-alarm-diag-host>
          <SleepAlarmDiagBlock open expanded={diagExpanded} />
        </div>
      ) : null}

      <SleepWeekBlock
        key={`sleep-week-${tick}`}
        nights={getRecentSleepNights(14)}
        age={getCalorieProfile().age}
      />

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
        onOpenHorairesVariables={() => {
          setAlarmPane(null)
          setHvPane(resolveHvOpenPane(getCalorieProfile().age))
          setHvOpen(true)
        }}
      />

      <HvFlow
        open={hvOpen}
        onClose={() => {
          setHvOpen(false)
          setTick((n) => n + 1)
          setHvTick((n) => n + 1)
        }}
        initialPane={hvPane}
      />
    </div>
  )
}
