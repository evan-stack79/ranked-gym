import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  SLEEP_ALARM_CHANGED_EVENT,
  SLEEP_ALARM_SOUND_LABEL,
  SLEEP_ALARM_SNOOZE_MINUTES,
  getSleepAlarmSettings,
  type SleepAlarmSettings,
  type SleepAlarmWeekday,
} from '../../services/sleepAlarmStorage'
import {
  formatAlarmScheduledMessage,
  isSleepAlarmPlatformSupported,
  readSleepAlarmUiStatus,
  resolveAlarmBackend,
  sleepAlarmFallbackHint,
  syncFailureMessage,
  syncSleepAlarm,
  type SleepAlarmUiStatus,
} from '../../services/sleepAlarmService'
import { RankedAlarm, isRankedAlarmPluginAvailable } from '../../native/rankedAlarm'
import { formatRepeatSummary } from '../../utils/sleepAlarmSchedule'
import { IosSheet } from '../ui/IosSheet'
import type { AlarmBackend } from '../../utils/sleepAlarmSchedule'
import { SleepAlarmDiagBlock } from './SleepAlarmDiagBlock'
import { SleepAlarmStatusBanner } from './SleepAlarmStatusBanner'
import { SleepTimeWheelColumn } from './SleepTimeWheelColumn'

const BG = '#000000'
const CARD = '#1C1C1E'
const ROW = '#2C2C2E'
const GRAY = '#ACB4BA'
const RED = '#ff0702'

const DAY_ROWS: { day: SleepAlarmWeekday; label: string }[] = [
  { day: 1, label: 'Chaque lundi' },
  { day: 2, label: 'Chaque mardi' },
  { day: 3, label: 'Chaque mercredi' },
  { day: 4, label: 'Chaque jeudi' },
  { day: 5, label: 'Chaque vendredi' },
  { day: 6, label: 'Chaque samedi' },
  { day: 7, label: 'Chaque dimanche' },
]

export type SleepAlarmSheetPane = 'main' | 'days' | 'sound'

interface SleepAlarmSheetProps {
  open: boolean
  onClose: () => void
  /** Open directly on Sonnerie / Répétition (page Sommeil v11). */
  initialPane?: SleepAlarmSheetPane
}

function TimeWheels({
  hour,
  minute,
  onChange,
}: {
  hour: number
  minute: number
  onChange: (h: number, m: number) => void
}) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])
  return (
    <div className="relative flex items-center justify-center gap-2 py-2" data-sleep-alarm-wheels>
      <div
        className="pointer-events-none absolute left-4 right-4 top-1/2 h-[44px] -translate-y-1/2 rounded-xl"
        style={{ backgroundColor: ROW }}
        aria-hidden
      />
      <SleepTimeWheelColumn
        values={hours}
        value={hour}
        onChange={(h) => onChange(h, minute)}
        ariaLabel="Heures"
      />
      <span className="relative z-[1] text-[28px] font-semibold text-white">:</span>
      <SleepTimeWheelColumn
        values={minutes}
        value={minute}
        onChange={(m) => onChange(hour, m)}
        ariaLabel="Minutes"
      />
    </div>
  )
}

/**
 * Réglage réveil façon Alarme iPhone — iOS only.
 * Rouge rare (actions Annuler / Enregistrer / check). Fond presque noir + gris.
 */
export function SleepAlarmSheet({
  open,
  onClose,
  initialPane = 'main',
}: SleepAlarmSheetProps) {
  const [draft, setDraft] = useState<SleepAlarmSettings>(() => getSleepAlarmSettings())
  const [pane, setPane] = useState<SleepAlarmSheetPane>('main')
  const [backend, setBackend] = useState<AlarmBackend | 'plugin-missing'>('unavailable')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SleepAlarmUiStatus>({ kind: 'off' })
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const [labelEditing, setLabelEditing] = useState(false)
  const [diagExpanded, setDiagExpanded] = useState(false)
  const titleTaps = useRef({ count: 0, last: 0 })

  useEffect(() => {
    if (!open) {
      setPane('main')
      setError(null)
      setConfirmMsg(null)
      setLabelEditing(false)
      setDiagExpanded(false)
      titleTaps.current = { count: 0, last: 0 }
      return
    }
    setPane(initialPane)
    setDraft(getSleepAlarmSettings())
    void (async () => {
      const b = await resolveAlarmBackend()
      setBackend(b)
      // Premier réglage : demander AlarmKit dès l’ouverture si encore « prompt ».
      if (b === 'alarmkit' && isRankedAlarmPluginAvailable()) {
        try {
          const perm = await RankedAlarm.requestPermissions()
          if (perm.alarms === 'denied') setStatus({ kind: 'permission' })
        } catch (err) {
          console.error('[sleep-alarm] requestPermissions on open', err)
        }
      }
      setStatus(await readSleepAlarmUiStatus())
    })()
  }, [open, initialPane])

  const onTitleClick = () => {
    const now = Date.now()
    if (now - titleTaps.current.last > 1200) titleTaps.current.count = 0
    titleTaps.current.last = now
    titleTaps.current.count += 1
    if (titleTaps.current.count >= 5) {
      titleTaps.current.count = 0
      setDiagExpanded((v) => !v)
    }
  }

  useEffect(() => {
    const sync = () => {
      setDraft(getSleepAlarmSettings())
      void readSleepAlarmUiStatus().then(setStatus)
    }
    window.addEventListener(SLEEP_ALARM_CHANGED_EVENT, sync)
    return () => window.removeEventListener(SLEEP_ALARM_CHANGED_EVENT, sync)
  }, [])

  if (!isSleepAlarmPlatformSupported() && open) {
    // Safety: never show on web/android even if parent mis-wires.
    return null
  }

  const [hour, minute] = draft.timeHm.split(':').map(Number)
  const hint = sleepAlarmFallbackHint(backend)

  const onSave = async () => {
    setSaving(true)
    setError(null)
    setConfirmMsg(null)
    // Auth is requested inside syncSleepAlarm → scheduleAlarmKit (before schedule).
    const result = await syncSleepAlarm({ ...draft, enabled: true })
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
    const timeHm = result.timeHm ?? draft.timeHm
    const msg = formatAlarmScheduledMessage(timeHm)
    setConfirmMsg(msg)
    setStatus({
      kind: 'scheduled',
      timeHm,
      summary: formatRepeatSummary(draft.days),
    })
    // Keep sheet open briefly so Evan sees the confirmation, then close.
    window.setTimeout(() => onClose(), 700)
  }

  const onCancel = () => onClose()

  const sheetTitle =
    pane === 'main' ? 'Réveil' : pane === 'days' ? 'Répétition' : 'Sonnerie'

  return (
    <IosSheet
      open={open}
      onClose={onCancel}
      title={sheetTitle}
      onTitleClick={pane === 'main' ? onTitleClick : undefined}
      leading={
        pane === 'main' ? (
          <button
            type="button"
            onClick={onCancel}
            className="ios-press text-[17px]"
            style={{ color: RED }}
          >
            Annuler
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPane('main')}
            className="ios-press text-[17px]"
            style={{ color: RED }}
          >
            ‹ Retour
          </button>
        )
      }
    >
      <div className="space-y-3 pb-4" style={{ backgroundColor: BG }} data-sleep-alarm-sheet>
        {pane === 'main' ? (
          <>
            <div className="-mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="ios-press min-h-11 px-1 text-[17px] font-semibold disabled:opacity-50"
                style={{ color: RED }}
                data-sleep-alarm-save
              >
                Enregistrer
              </button>
            </div>
            <TimeWheels
              hour={hour || 0}
              minute={minute || 0}
              onChange={(h, m) =>
                setDraft((d) => ({
                  ...d,
                  timeHm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                }))
              }
            />

            <p className="flex items-center gap-1.5 px-1 text-[13px]" style={{ color: GRAY }}>
              <span aria-hidden>☼</span>
              Suit ton heure de lever (cadran Sommeil)
            </p>

            <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
              <button
                type="button"
                onClick={() => setPane('days')}
                className="ios-press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-[16px] text-white">Répétition</span>
                <span className="flex items-center gap-1 text-[15px]" style={{ color: GRAY }}>
                  {formatRepeatSummary(draft.days)}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
              <div className="mx-4 h-px bg-white/10" />
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-[16px] text-white">Libellé</span>
                {labelEditing ? (
                  <input
                    autoFocus
                    value={draft.label}
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    onBlur={() => setLabelEditing(false)}
                    className="max-w-[55%] rounded-lg bg-black/40 px-2 py-1 text-right text-[15px] text-white outline-none"
                    maxLength={40}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setLabelEditing(true)}
                    className="text-[15px]"
                    style={{ color: GRAY }}
                  >
                    {draft.label}
                  </button>
                )}
              </div>
              <div className="mx-4 h-px bg-white/10" />
              <button
                type="button"
                onClick={() => setPane('sound')}
                className="ios-press flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-[16px] text-white">Sonnerie</span>
                <span className="flex min-w-0 items-center gap-1 text-[15px]" style={{ color: GRAY }}>
                  <span className="truncate">
                    {draft.soundId === 'none' ? 'Aucune' : SLEEP_ALARM_SOUND_LABEL}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </span>
              </button>
              <div className="mx-4 h-px bg-white/10" />
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-[16px] text-white">Répéter</p>
                  <p className="text-[13px]" style={{ color: GRAY }}>
                    {SLEEP_ALARM_SNOOZE_MINUTES} min
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.snoozeEnabled}
                  onClick={() =>
                    setDraft((d) => ({ ...d, snoozeEnabled: !d.snoozeEnabled }))
                  }
                  className="relative h-[31px] w-[51px] shrink-0 rounded-full"
                  style={{ backgroundColor: draft.snoozeEnabled ? RED : '#39393D' }}
                  data-sleep-alarm-snooze={draft.snoozeEnabled ? 'on' : 'off'}
                >
                  <span
                    className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow"
                    style={{ left: draft.snoozeEnabled ? 22 : 2 }}
                  />
                </button>
              </div>
            </div>

            <p className="px-1 text-[12px]" style={{ color: GRAY }}>
              La sonnerie monte doucement.
            </p>
            {hint ? (
              <p className="px-1 text-[12px]" style={{ color: GRAY }} data-sleep-alarm-fallback-hint>
                {hint}
              </p>
            ) : null}
            {confirmMsg ? (
              <p className="px-1 text-[14px] font-medium text-white" data-sleep-alarm-confirm>
                {confirmMsg}
              </p>
            ) : (
              <SleepAlarmStatusBanner status={status} />
            )}
            {error && status.kind !== 'permission' ? (
              <p className="px-1 text-[13px] text-[#FF907F]">{error}</p>
            ) : null}

            <SleepAlarmDiagBlock open={open} expanded={diagExpanded} />
          </>
        ) : null}

        {pane === 'days' ? (
          <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
            {DAY_ROWS.map((row, i) => {
              const on = draft.days.includes(row.day)
              return (
                <div key={row.day}>
                  {i > 0 ? <div className="mx-4 h-px bg-white/10" /> : null}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => {
                        const set = new Set(d.days)
                        if (set.has(row.day)) set.delete(row.day)
                        else set.add(row.day)
                        return {
                          ...d,
                          days: [...set].sort((a, b) => a - b) as SleepAlarmWeekday[],
                        }
                      })
                    }
                    className="ios-press flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <span className="text-[16px] text-white">{row.label}</span>
                    {on ? (
                      <span className="text-[18px] font-semibold" style={{ color: RED }}>
                        ✓
                      </span>
                    ) : null}
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        {pane === 'sound' ? (
          <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, soundId: 'rugissement_ranked_gym' }))}
              className="ios-press flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span>
                <span className="block text-[16px] text-white">{SLEEP_ALARM_SOUND_LABEL}</span>
                <span className="mt-0.5 block text-[13px]" style={{ color: GRAY }}>
                  Monte doucement
                </span>
              </span>
              {draft.soundId !== 'none' ? (
                <span className="text-[18px] font-semibold" style={{ color: RED }}>
                  ✓
                </span>
              ) : null}
            </button>
            <div className="mx-4 h-px bg-white/10" />
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, soundId: 'none' }))}
              className="ios-press flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="text-[16px] text-white">Aucune</span>
              {draft.soundId === 'none' ? (
                <span className="text-[18px] font-semibold" style={{ color: RED }}>
                  ✓
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>
    </IosSheet>
  )
}
