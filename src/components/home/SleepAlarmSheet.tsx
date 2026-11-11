import { useEffect, useMemo, useState } from 'react'
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
  isSleepAlarmPlatformSupported,
  resolveAlarmBackend,
  sleepAlarmFallbackHint,
  syncSleepAlarm,
} from '../../services/sleepAlarmService'
import { formatRepeatSummary } from '../../utils/sleepAlarmSchedule'
import { IosSheet } from '../ui/IosSheet'
import type { AlarmBackend } from '../../utils/sleepAlarmSchedule'

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

interface SleepAlarmSheetProps {
  open: boolean
  onClose: () => void
}

function WheelColumn({
  values,
  value,
  onChange,
  ariaLabel,
}: {
  values: number[]
  value: number
  onChange: (n: number) => void
  ariaLabel: string
}) {
  return (
    <div
      className="relative h-[180px] w-[72px] overflow-y-auto snap-y snap-mandatory"
      style={{ scrollbarWidth: 'none' }}
      aria-label={ariaLabel}
      role="listbox"
    >
      <div className="h-[68px]" aria-hidden />
      {values.map((n) => {
        const selected = n === value
        return (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(n)}
            className="flex h-[44px] w-full snap-center items-center justify-center tabular-nums"
            style={{
              color: selected ? '#FFFFFF' : GRAY,
              fontSize: selected ? 28 : 22,
              fontWeight: selected ? 600 : 400,
              opacity: selected ? 1 : 0.45,
            }}
          >
            {String(n).padStart(2, '0')}
          </button>
        )
      })}
      <div className="h-[68px]" aria-hidden />
    </div>
  )
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
      <WheelColumn
        values={hours}
        value={hour}
        onChange={(h) => onChange(h, minute)}
        ariaLabel="Heures"
      />
      <span className="relative z-[1] text-[28px] font-semibold text-white">:</span>
      <WheelColumn
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
export function SleepAlarmSheet({ open, onClose }: SleepAlarmSheetProps) {
  const [draft, setDraft] = useState<SleepAlarmSettings>(() => getSleepAlarmSettings())
  const [pane, setPane] = useState<'main' | 'days' | 'sound'>('main')
  const [backend, setBackend] = useState<AlarmBackend>('unavailable')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labelEditing, setLabelEditing] = useState(false)

  useEffect(() => {
    if (!open) {
      setPane('main')
      setError(null)
      setLabelEditing(false)
      return
    }
    setDraft(getSleepAlarmSettings())
    void resolveAlarmBackend().then(setBackend)
  }, [open])

  useEffect(() => {
    const sync = () => setDraft(getSleepAlarmSettings())
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
    const result = await syncSleepAlarm({ ...draft, enabled: true })
    setSaving(false)
    if (!result.ok) {
      setError(
        result.reason === 'PERMISSION_DENIED'
          ? 'Autorise le réveil dans Réglages pour qu’il sonne.'
          : 'Impossible d’enregistrer le réveil.',
      )
      return
    }
    onClose()
  }

  const onCancel = () => onClose()

  const sheetTitle =
    pane === 'main' ? 'Réveil' : pane === 'days' ? 'Répétition' : 'Sonnerie'

  return (
    <IosSheet
      open={open}
      onClose={onCancel}
      title={sheetTitle}
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
            {error ? <p className="px-1 text-[13px] text-[#FF907F]">{error}</p> : null}
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
