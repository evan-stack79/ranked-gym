import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { IosSheet } from '../../ui/IosSheet'
import { HvLottie } from './HvLottie'
import {
  HV_FEATURE_NAME,
  HV_FEATURE_SUBTITLE,
  HV_MAX_ARMED_ALARMS,
  HV_MINOR_ADULT_HELP,
  HV_MINOR_BODY_PHRASE,
  HV_MINOR_NO_NIGHT_MODE,
  HV_RED,
  HV_REST_SOFT_WAKE_HM,
  HV_SHORT_NIGHT_DRIVE,
  HV_WATER_DAY_PHRASE,
} from '../../../horaires-variables/constants'
import {
  addDaysKey,
  buildArmedWakes,
  computeWakeHm,
  computeWeekDebt,
  copyWeekTemplate,
  dateKeyOf,
  decompressionCopy,
  effectiveWakeForDay,
  emptyDayPlan,
  isMinorAge,
  canUseNightMode,
  mondayKeyOf,
  sanitizeDecompressionMin,
  sanitizeSundayReminderHm,
  shortNightShiftSuggestion,
  suggestedBedtimeHm,
  vacationResumeKey,
  weekTemplateForDate,
  type HvDayPlan,
} from '../../../horaires-variables/engine'
import {
  getHvState,
  saveHvState,
  upsertHvDay,
  HV_CHANGED_EVENT,
} from '../../../services/horairesVariables/storage'
import { syncHvAlarms } from '../../../services/horairesVariables/sync'
import { getCalorieProfile } from '../../../services/nutritionStorage'
import { getRecentSleepNights } from '../../../services/sleepStorage'

const CARD = '#1C1C1E'
const ROW = '#2C2C2E'
const GRAY = '#ACB4BA'

export type HvFlowPane =
  | 'activation'
  | 'planning'
  | 'day'
  | 'quick'
  | 'freeMorning'
  | 'shortNight'
  | 'night'
  | 'rest'
  | 'decompression'
  | 'debt'
  | 'minor'
  | 'vacation'
  | 'armed'
  | 'nap'
  | 'water'

type Props = {
  open: boolean
  onClose: () => void
  initialPane?: HvFlowPane
}

function fmtHm(hm: string): string {
  return hm.replace(/^0/, '')
}

function DayRow({
  day,
  trajetMin,
  prepMin,
  selected,
  onClick,
}: {
  day: HvDayPlan
  trajetMin: number
  prepMin: number
  selected?: boolean
  onClick: () => void
}) {
  const wake = effectiveWakeForDay(day, trajetMin, prepMin)
  const label =
    day.kind === 'repos'
      ? day.softWake
        ? fmtHm(day.softWakeHm)
        : 'Repos · pas de réveil'
      : day.startHm
        ? wake
          ? fmtHm(wake)
          : 'À régler'
        : 'À régler'
  const wd = new Date(day.dateKey + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
  })
  return (
    <button
      type="button"
      onClick={onClick}
      className="ios-press flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left"
      style={{ backgroundColor: selected ? '#2C2C2E' : CARD }}
      data-hv-day={day.dateKey}
    >
      <span className="w-[72px] text-[15px] font-semibold text-white">{wd}</span>
      {day.kind !== 'unset' && day.kind !== 'repos' ? (
        <span className="text-[12px] font-semibold" style={{ color: GRAY }}>
          {day.kind === 'tot' ? 'Tôt' : day.kind === 'soir' ? 'Soir' : 'Nuit'}
        </span>
      ) : null}
      {day.startHm ? (
        <span className="text-[12px]" style={{ color: GRAY }}>
          Début {fmtHm(day.startHm)}
        </span>
      ) : null}
      <span className="ml-auto text-[15px] font-semibold text-white">
        {!day.startHm && day.kind !== 'repos' ? (
          <span style={{ color: GRAY }}>À régler</span>
        ) : (
          <>
            <span className="mr-1 text-[11px] font-medium" style={{ color: GRAY }}>
              Réveil
            </span>
            {label}
          </>
        )}
      </span>
      <ChevronRight size={16} color={GRAY} />
    </button>
  )
}

/**
 * Emploi du temps variable — sheets for the 17 maquette screens.
 * Shared « Mes réveils » planning (extends classic alarm, does not duplicate).
 */
export function HvFlow({ open, onClose, initialPane = 'activation' }: Props) {
  const [pane, setPane] = useState<HvFlowPane>(initialPane)
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [draftStart, setDraftStart] = useState('08:00')
  const [draftKind, setDraftKind] = useState<HvDayPlan['kind']>('tot')
  const [decMin, setDecMin] = useState(60)
  const [finishHm, setFinishHm] = useState('23:00')
  const [softWake, setSoftWake] = useState(false)
  const [vacationUntil, setVacationUntil] = useState<string | null>(null)
  const [weekTab, setWeekTab] = useState<'this' | 'next'>('next')
  const [nightAck, setNightAck] = useState(false)

  useEffect(() => {
    if (open) {
      setPane(initialPane)
      const st = getHvState()
      setPane(st.settings.enabled ? (initialPane === 'activation' ? 'planning' : initialPane) : 'activation')
      setDecMin(st.settings.decompressionMin)
    }
  }, [open, initialPane])

  // Écran nuit : barre du bas TRÈS FONCÉE (pas cachée) — NOTES Q3 → 28% opacity.
  useEffect(() => {
    if (!open) {
      document.documentElement.removeAttribute('data-hv-night')
      return
    }
    if (pane === 'night') {
      document.documentElement.setAttribute('data-hv-night', '1')
    } else {
      document.documentElement.removeAttribute('data-hv-night')
    }
    return () => document.documentElement.removeAttribute('data-hv-night')
  }, [open, pane])

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener(HV_CHANGED_EVENT, sync)
    return () => window.removeEventListener(HV_CHANGED_EVENT, sync)
  }, [])

  const state = useMemo(() => {
    void tick
    return getHvState()
  }, [tick])

  const age = getCalorieProfile().age
  const minor = isMinorAge(age)
  const today = dateKeyOf(new Date())
  const thisMonday = mondayKeyOf(new Date())
  const nextMonday = addDaysKey(thisMonday, 7) ?? thisMonday
  const showMonday = weekTab === 'this' ? thisMonday : nextMonday
  const weekLetter = weekTemplateForDate(showMonday, state.settings.weekARefMondayKey)

  const weekDays: HvDayPlan[] = useMemo(() => {
    const byKey = new Map(state.days.map((d) => [d.dateKey, d]))
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDaysKey(showMonday, i) ?? today
      return byKey.get(key) ?? emptyDayPlan(key)
    })
  }, [state.days, showMonday, today])

  const armed = useMemo(
    () =>
      buildArmedWakes({
        days: state.days,
        trajetMin: state.settings.trajetMin,
        prepMin: state.settings.prepMin,
        fromDateKey: today,
        maxArmed: HV_MAX_ARMED_ALARMS,
      }),
    [state, today],
  )

  const nights = getRecentSleepNights(7)
  const debt = computeWeekDebt({
    tibHours: nights.map((n) => n.tstHours ?? 0),
    referenceHours: minor ? 9 : 7,
  })

  const title =
    pane === 'planning' || pane === 'quick' || pane === 'day' || pane === 'rest' || pane === 'nap'
      ? 'Mes réveils'
      : pane === 'debt'
        ? 'Ta semaine'
        : pane === 'armed'
          ? 'Réveils prêts'
          : pane === 'decompression'
            ? 'Temps pour souffler'
            : pane === 'water'
              ? 'Nutrition'
              : HV_FEATURE_NAME

  const activate = async () => {
    const now = new Date().toISOString()
    saveHvState({
      settings: {
        ...state.settings,
        enabled: true,
        activatedAt: now,
        autoPaused: false,
        lastStartEditAt: now,
      },
    })
    await syncHvAlarms()
    setPane(minor ? 'minor' : 'planning')
  }

  const openDay = (day: HvDayPlan) => {
    setEditKey(day.dateKey)
    setDraftStart(day.startHm ?? '08:00')
    setDraftKind(day.kind === 'unset' ? 'tot' : day.kind)
    setSoftWake(day.softWake)
    if (day.kind === 'repos') setPane('rest')
    else setPane('day')
  }

  const saveDay = async () => {
    if (!editKey) return
    const next: HvDayPlan = {
      ...(state.days.find((d) => d.dateKey === editKey) ?? emptyDayPlan(editKey)),
      kind: draftKind,
      startHm: draftKind === 'repos' ? null : draftStart,
      softWake: draftKind === 'repos' ? softWake : false,
      noAlarm: draftKind === 'repos' && !softWake,
      oneShotOffsetMin: 0,
      wakeOverrideHm: null,
    }
    upsertHvDay(next)
    await syncHvAlarms()
    setPane('planning')
  }

  const quickAdjust = async (offsetMin: number | 'off') => {
    const targetKey = editKey ?? addDaysKey(today, 1)
    if (!targetKey) return
    const day = state.days.find((d) => d.dateKey === targetKey) ?? emptyDayPlan(targetKey)
    if (offsetMin === 'off') {
      upsertHvDay({ ...day, noAlarm: true, oneShotOffsetMin: 0 })
      setToast('Pas de réveil, juste pour ce jour.')
    } else {
      const base =
        effectiveWakeForDay({ ...day, oneShotOffsetMin: 0, noAlarm: false }, state.settings.trajetMin, state.settings.prepMin) ??
        '07:00'
      upsertHvDay({
        ...day,
        noAlarm: false,
        oneShotOffsetMin: (day.oneShotOffsetMin || 0) + offsetMin,
      })
      const nextWake = effectiveWakeForDay(
        { ...day, noAlarm: false, oneShotOffsetMin: (day.oneShotOffsetMin || 0) + offsetMin },
        state.settings.trajetMin,
        state.settings.prepMin,
      )
      setToast(
        `Demain : réveil à ${fmtHm(nextWake ?? base)} (${offsetMin > 0 ? '+' : ''}${offsetMin === 60 ? '1 h' : `${offsetMin} min`}). ${fmtHm(nextWake ?? base)}, juste pour demain.`,
      )
    }
    await syncHvAlarms()
  }

  const sheetNight = pane === 'night'

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={title}
      leading={
        <button type="button" onClick={onClose} className="ios-press text-[17px]" style={{ color: HV_RED }}>
          Fermer
        </button>
      }
    >
      <div
        className="flex flex-col gap-3 px-1 pb-8"
        data-hv-flow={pane}
        style={
          sheetNight
            ? { background: '#000', color: '#3a3a3c', filter: 'brightness(0.55)' }
            : undefined
        }
      >
        {pane === 'activation' ? (
          <>
            <HvLottie id="02" className="mx-auto h-36 w-full max-w-[240px]" />
            <p className="text-[15px] leading-snug text-white">
              Tes horaires changent, ton app aussi. On ne te demande pas de te lever à la même heure
              chaque jour.
            </p>
            <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
              À régler une seule fois
            </p>
            <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
              {(
                [
                  ['Trajet', `${Math.floor(state.settings.trajetMin / 60)} h ${state.settings.trajetMin % 60 || ''}`.trim()],
                  ['Me préparer', `${state.settings.prepMin} min`],
                  ['Temps pour souffler', `${Math.round(state.settings.decompressionMin / 60) || state.settings.decompressionMin} h`],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-white/5 px-4 py-3"
                >
                  <span className="text-[15px] text-white">{k}</span>
                  <button
                    type="button"
                    className="text-[15px]"
                    style={{ color: GRAY }}
                    onClick={() => {
                      if (k === 'Trajet') {
                        saveHvState({
                          settings: {
                            ...state.settings,
                            trajetMin: state.settings.trajetMin === 75 ? 60 : 75,
                          },
                        })
                      } else if (k === 'Me préparer') {
                        saveHvState({
                          settings: {
                            ...state.settings,
                            prepMin: state.settings.prepMin === 30 ? 20 : 30,
                          },
                        })
                      } else {
                        setPane('decompression')
                      }
                    }}
                  >
                    {v}
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[15px] text-white">Semaines A / B</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state.settings.weeksAb}
                  className="h-7 w-12 rounded-full"
                  style={{ backgroundColor: state.settings.weeksAb ? HV_RED : ROW }}
                  onClick={() =>
                    saveHvState({
                      settings: { ...state.settings, weeksAb: !state.settings.weeksAb },
                    })
                  }
                />
              </div>
            </div>
            <p className="text-[13px]" style={{ color: GRAY }}>
              Un seul planning, un seul réveil. Il remplace « Mes réveils », il ne fait pas de
              doublon.
            </p>
            <p className="text-[13px]" style={{ color: GRAY }}>
              Tes données restent sur ton téléphone.
            </p>
            <button
              type="button"
              onClick={() => void activate()}
              className="ios-press mt-2 w-full rounded-2xl py-3.5 text-center text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              data-hv-activate
            >
              Activer
            </button>
          </>
        ) : null}

        {pane === 'planning' ? (
          <>
            <HvLottie id="03" className="mx-auto h-24 w-24" />
            <p className="text-[16px] font-semibold leading-snug text-white">
              Tu n&apos;as pas encore ton planning ? Règle juste demain, le reste attendra.
            </p>
            <div className="flex rounded-xl p-1" style={{ backgroundColor: CARD }}>
              {(['this', 'next'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="flex-1 rounded-lg py-2 text-[13px] font-semibold"
                  style={{
                    backgroundColor: weekTab === t ? ROW : 'transparent',
                    color: weekTab === t ? '#fff' : GRAY,
                  }}
                  onClick={() => setWeekTab(t)}
                >
                  {t === 'this' ? 'Cette semaine' : 'Semaine prochaine'}
                  <span className="ml-1 text-[11px]" style={{ color: GRAY }}>
                    {weekLetter}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {weekDays.map((d) => (
                <DayRow
                  key={d.dateKey}
                  day={d}
                  trajetMin={state.settings.trajetMin}
                  prepMin={state.settings.prepMin}
                  onClick={() => openDay(d)}
                />
              ))}
            </div>
            <button
              type="button"
              className="ios-press flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
              style={{ backgroundColor: CARD }}
              onClick={() => {
                const srcMonday =
                  weekLetter === 'B' ? addDaysKey(thisMonday, -14) : addDaysKey(thisMonday, -7)
                if (!srcMonday) return
                const src = state.days.filter((d) => d.dateKey >= srcMonday && d.dateKey < (addDaysKey(srcMonday, 7) ?? ''))
                const copied = copyWeekTemplate(src, nextMonday)
                const merged = [
                  ...state.days.filter((d) => !copied.some((c) => c.dateKey === d.dateKey)),
                  ...copied,
                ]
                saveHvState({ days: merged })
                void syncHvAlarms()
              }}
            >
              <div>
                <b className="block text-[15px] text-white">Reprendre ma semaine B</b>
                <small className="text-[12px]" style={{ color: GRAY }}>
                  Les heures de la dernière semaine B
                </small>
              </div>
              <ChevronRight className="ml-auto" size={16} color={GRAY} />
            </button>
            <div
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ backgroundColor: CARD }}
            >
              <div>
                <b className="block text-[15px] text-white">Rappel du dimanche</b>
                <small className="text-[12px]" style={{ color: GRAY }}>
                  De 18:00 à 21:00 au plus tard
                </small>
              </div>
              <button
                type="button"
                className="text-[15px] font-semibold text-white"
                onClick={() => {
                  const cur = state.settings.sundayReminderHm
                  const next = cur === '18:00' ? '19:00' : cur === '19:00' ? '20:00' : cur === '20:00' ? '21:00' : '18:00'
                  saveHvState({
                    settings: {
                      ...state.settings,
                      sundayReminderHm: sanitizeSundayReminderHm(next),
                    },
                  })
                }}
              >
                {state.settings.sundayReminderHm}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="ios-press flex-1 rounded-2xl py-3 text-[14px] font-semibold text-white"
                style={{ backgroundColor: CARD }}
                onClick={() => setPane('quick')}
              >
                Prochain réveil
              </button>
              <button
                type="button"
                className="ios-press flex-1 rounded-2xl py-3 text-[14px] font-semibold text-white"
                style={{ backgroundColor: CARD }}
                onClick={() => setPane('armed')}
              >
                Réveils armés
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="ios-press flex-1 rounded-2xl py-3 text-[14px] font-semibold"
                style={{ backgroundColor: CARD, color: GRAY }}
                onClick={() => setPane('debt')}
              >
                Ta semaine
              </button>
              <button
                type="button"
                className="ios-press flex-1 rounded-2xl py-3 text-[14px] font-semibold"
                style={{ backgroundColor: CARD, color: GRAY }}
                onClick={() => setPane('vacation')}
              >
                Pause
              </button>
              <button
                type="button"
                className="ios-press flex-1 rounded-2xl py-3 text-[14px] font-semibold"
                style={{ backgroundColor: CARD, color: GRAY }}
                onClick={() => setPane('decompression')}
              >
                Souffler
              </button>
            </div>
            {canUseNightMode(age) ? (
              <button
                type="button"
                className="text-[12px]"
                style={{ color: '#444' }}
                onClick={() => {
                  setNightAck(false)
                  setPane('night')
                }}
              >
                Écran nuit
              </button>
            ) : null}
          </>
        ) : null}

        {pane === 'day' && editKey ? (
          <>
            <HvLottie id="05" className="mx-auto h-24 w-56" />
            <p className="text-center text-[14px]" style={{ color: GRAY }}>
              {editKey}
            </p>
            <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
              <label className="flex items-center justify-between px-4 py-3">
                <span className="text-white">Début</span>
                <input
                  className="w-24 rounded-lg bg-black/40 px-2 py-1 text-right text-white"
                  value={draftStart}
                  onChange={(e) => setDraftStart(e.target.value)}
                />
              </label>
              <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
                <span className="text-white">Trajet</span>
                <span style={{ color: GRAY }}>
                  {Math.floor(state.settings.trajetMin / 60)} h {state.settings.trajetMin % 60 || ''}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
                <span className="text-white">Me préparer</span>
                <span style={{ color: GRAY }}>{state.settings.prepMin} min</span>
              </div>
            </div>
            <p className="text-center text-[14px]" style={{ color: GRAY }}>
              Début {fmtHm(draftStart)}, trajet{' '}
              {Math.floor(state.settings.trajetMin / 60)} h {state.settings.trajetMin % 60 || ''}
              , préparation {state.settings.prepMin} min : réveil à{' '}
              {fmtHm(computeWakeHm(draftStart, state.settings.trajetMin, state.settings.prepMin) ?? '?')}
              .
            </p>
            <div
              className="flex items-center justify-between rounded-2xl px-4 py-4"
              style={{ backgroundColor: CARD }}
            >
              <span style={{ color: GRAY }}>Réveil</span>
              <b className="text-[28px] text-white">
                {fmtHm(
                  computeWakeHm(draftStart, state.settings.trajetMin, state.settings.prepMin) ??
                    '--:--',
                )}
              </b>
            </div>
            <div className="flex gap-2">
              {(['tot', 'soir', 'nuit'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="flex-1 rounded-xl py-2 text-[13px] font-semibold"
                  style={{
                    backgroundColor: draftKind === k ? HV_RED : CARD,
                    color: '#fff',
                  }}
                  onClick={() => setDraftKind(k)}
                >
                  {k === 'tot' ? 'Tôt' : k === 'soir' ? 'Soir' : 'Nuit'}
                </button>
              ))}
              <button
                type="button"
                className="flex-1 rounded-xl py-2 text-[13px] font-semibold text-white"
                style={{ backgroundColor: draftKind === 'repos' ? HV_RED : CARD }}
                onClick={() => {
                  setDraftKind('repos')
                  setPane('rest')
                }}
              >
                Repos
              </button>
            </div>
            <button
              type="button"
              onClick={() => void saveDay()}
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
            >
              Valider
            </button>
            <button
              type="button"
              className="text-[14px]"
              style={{ color: GRAY }}
              onClick={() => setPane('nap')}
            >
              + Sieste prévue
            </button>
          </>
        ) : null}

        {pane === 'quick' ? (
          <>
            <HvLottie id="04" className="mx-auto h-16 w-16" />
            <p className="text-[12px] font-semibold" style={{ color: GRAY }}>
              Prochain réveil · demain
            </p>
            <p className="text-[22px] font-extrabold text-white">
              {armed[0] ? `${armed[0].dateKey.slice(8)} · ${fmtHm(armed[0].wakeHm)}` : 'À régler'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['+30 min', 30],
                  ['+1 h', 60],
                  ['−30 min', -30],
                ] as const
              ).map(([label, off]) => (
                <button
                  key={label}
                  type="button"
                  className="ios-press rounded-2xl py-4 text-[16px] font-bold text-white"
                  style={{ backgroundColor: CARD }}
                  onClick={() => {
                    setEditKey(addDaysKey(today, 1))
                    void quickAdjust(off)
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="ios-press rounded-2xl py-4 text-[16px] font-bold"
                style={{ backgroundColor: CARD, color: GRAY }}
                onClick={() => {
                  setEditKey(addDaysKey(today, 1))
                  void quickAdjust('off')
                }}
              >
                Pas de réveil
              </button>
            </div>
            {toast ? (
              <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: CARD }}>
                <b className="block text-[14px] text-white">{toast.split('.')[0]}.</b>
                <small className="text-[12px]" style={{ color: GRAY }}>
                  {toast.slice(toast.indexOf('.') + 1).trim()}
                </small>
              </div>
            ) : null}
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
              style={{ border: `1px solid ${HV_RED}`, color: HV_RED }}
              onClick={() => {
                setEditKey(addDaysKey(today, 1))
                setPane('day')
              }}
            >
              Demain change
            </button>
          </>
        ) : null}

        {pane === 'rest' && editKey ? (
          <>
            <HvLottie id="10" className="mx-auto h-32 w-56" />
            <div className="flex rounded-xl p-1" style={{ backgroundColor: CARD }}>
              <button
                type="button"
                className="flex-1 rounded-lg py-2 text-[14px] font-semibold"
                style={{ color: GRAY }}
                onClick={() => {
                  setDraftKind('tot')
                  setPane('day')
                }}
              >
                Début
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg py-2 text-[14px] font-semibold text-white"
                style={{ backgroundColor: ROW }}
              >
                Repos
              </button>
            </div>
            <p className="text-center text-[15px] text-white">
              Repos ! Pas d&apos;heure de début, pas de réveil, sauf si tu en veux un.
            </p>
            <div
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ backgroundColor: CARD }}
            >
              <div>
                <b className="text-white">Réveil doux</b>
                <small className="block text-[12px]" style={{ color: GRAY }}>
                  À {HV_REST_SOFT_WAKE_HM}, ton lever des jours de repos
                </small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={softWake}
                className="h-7 w-12 rounded-full"
                style={{ backgroundColor: softWake ? HV_RED : ROW }}
                onClick={() => setSoftWake((v) => !v)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftKind('repos')
                void saveDay()
              }}
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
            >
              Valider
            </button>
          </>
        ) : null}

        {pane === 'decompression' ? (
          <>
            <HvLottie id="11" className="mx-auto h-36 w-36" />
            <p className="text-center text-[40px] font-extrabold text-white">
              {decMin < 60 ? `${decMin} min` : decMin % 60 === 0 ? `${decMin / 60} h` : `${Math.floor(decMin / 60)} h ${decMin % 60}`}
            </p>
            <input
              type="range"
              min={0}
              max={120}
              step={15}
              value={decMin}
              onChange={(e) => setDecMin(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: HV_RED }}
            />
            <p className="text-center text-[15px] font-semibold text-white">
              {decompressionCopy(finishHm, decMin)}
            </p>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold"
              style={{ border: `1px solid ${HV_RED}`, color: HV_RED }}
              onClick={() => {
                const next = finishHm === '23:00' ? '22:00' : '23:00'
                setFinishHm(next)
              }}
            >
              J&apos;ai fini à… {fmtHm(finishHm)}
            </button>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              onClick={() => {
                saveHvState({
                  settings: {
                    ...state.settings,
                    decompressionMin: sanitizeDecompressionMin(decMin),
                  },
                })
                setPane(state.settings.enabled ? 'planning' : 'activation')
              }}
            >
              Valider
            </button>
            <p className="text-center text-[12px]" style={{ color: GRAY }}>
              Coucher conseillé vers {fmtHm(suggestedBedtimeHm(finishHm, decMin) ?? '?')}
            </p>
          </>
        ) : null}

        {pane === 'debt' ? (
          <>
            <HvLottie id="12" className="mx-auto h-28 w-28" />
            <p className="text-center text-[15px] leading-snug text-white">
              Ta semaine a été courte : il te manque environ {debt.manqueDisplayHours} h. On en
              reprend un peu chaque jour, sans forcer.
            </p>
            <div className="rounded-2xl p-4" style={{ backgroundColor: CARD }}>
              <div className="mb-3 flex justify-between">
                <div>
                  <small style={{ color: GRAY }}>Manque</small>
                  <b className="block text-white">environ {debt.manqueDisplayHours} h</b>
                </div>
                <div>
                  <small style={{ color: GRAY }}>Déjà récupéré</small>
                  <b className="block text-white">{debt.recupereDisplayHours} h</b>
                </div>
              </div>
              <div className="flex h-28 items-end justify-between gap-1">
                {(nights.length
                  ? nights
                  : Array.from({ length: 7 }, () => ({ tstHours: 7 as number | null }))
                ).map((n, i) => {
                  const h = n.tstHours ?? 0
                  const px = Math.max(4, Math.min(92, (h / 10) * 92))
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <i
                        className="block w-full rounded-sm"
                        style={{ height: px, backgroundColor: '#8e8e93' }}
                      />
                      <span className="text-[10px]" style={{ color: GRAY }}>
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'][i]}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[12px]" style={{ color: GRAY }}>
                Nuit (au lit) + siestes notées · - - - Ton repère : {minor ? '8 à 10' : '7'} h
              </p>
            </div>
          </>
        ) : null}

        {pane === 'minor' ? (
          <>
            <HvLottie id="13" className="mx-auto h-44 w-44" />
            <p className="text-[17px] font-semibold text-white">{HV_MINOR_BODY_PHRASE}</p>
            <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
              <div className="px-4 py-3 text-[15px] text-white">Ton repère : 8 à 10 h</div>
              <div className="border-t border-white/5 px-4 py-3">
                <b className="block text-[15px] text-white">Une question sur tes horaires ?</b>
                <small className="text-[13px]" style={{ color: GRAY }}>
                  {HV_MINOR_ADULT_HELP.replace('Une question sur tes horaires ? ', '')}
                </small>
              </div>
            </div>
            <p className="text-[13px]" style={{ color: GRAY }}>
              {HV_MINOR_NO_NIGHT_MODE}
            </p>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              onClick={() => setPane('planning')}
            >
              Continuer
            </button>
          </>
        ) : null}

        {pane === 'vacation' ? (
          <>
            <HvLottie id="14" className="mx-auto h-36 w-36" />
            <h2 className="text-center text-[22px] font-bold text-white">
              Mode en pause. Ton planning t&apos;attend.
            </h2>
            <p className="text-center text-[14px]" style={{ color: GRAY }}>
              Tes repères habituels reviennent pendant la pause.
            </p>
            <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
              Fin de la pause
            </p>
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => {
                const key = addDaysKey(today, i + 1)
                if (!key) return null
                const on = vacationUntil === key
                const d = new Date(key + 'T12:00:00')
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVacationUntil(key)}
                    className="flex flex-1 flex-col items-center rounded-xl py-2"
                    style={{
                      backgroundColor: on ? HV_RED : CARD,
                      border: `1px solid ${on ? HV_RED : ROW}`,
                    }}
                  >
                    <span className="text-[11px] font-semibold text-white">
                      {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </span>
                    <b className="text-[17px] text-white">{d.getDate()}</b>
                  </button>
                )
              })}
            </div>
            {vacationUntil ? (
              <p className="text-[13px]" style={{ color: GRAY }}>
                Le mode reprend tout seul le {vacationResumeKey(vacationUntil)}. Une carte te le dira
                dans l&apos;app.
              </p>
            ) : null}
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              onClick={() => {
                if (!vacationUntil) return
                saveHvState({
                  settings: {
                    ...state.settings,
                    vacationPauseUntilKey: vacationUntil,
                    autoPaused: false,
                  },
                })
                void syncHvAlarms()
                onClose()
              }}
            >
              Mettre en pause
            </button>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold"
              style={{ border: `1px solid ${HV_RED}`, color: HV_RED }}
              onClick={() => {
                saveHvState({
                  settings: {
                    ...state.settings,
                    vacationPauseUntilKey: null,
                    autoPaused: false,
                  },
                })
                void syncHvAlarms()
                setPane('planning')
              }}
            >
              Reprendre maintenant
            </button>
          </>
        ) : null}

        {pane === 'armed' ? (
          <>
            <HvLottie id="16" className="mx-auto h-20 w-20" />
            <p className="text-[17px] font-semibold text-white">
              Semaine {weekTemplateForDate(today, state.settings.weekARefMondayKey)} cette semaine.
              Tes réveils sont prêts.
            </p>
            <p className="text-[14px]" style={{ color: GRAY }}>
              {armed.length} réveils armés sur les 14 prochains jours (max {HV_MAX_ARMED_ALARMS}).
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {armed.map((a) => (
                <div
                  key={a.dateKey}
                  className="flex justify-between rounded-xl px-3 py-2"
                  style={{ backgroundColor: CARD }}
                >
                  <span className="text-[14px] text-white">{a.dateKey}</span>
                  <span className="text-[14px] font-semibold text-white">{fmtHm(a.wakeHm)}</span>
                </div>
              ))}
            </div>
            <p className="text-[13px]" style={{ color: GRAY }}>
              Ils sonnent même si l&apos;app reste fermée. À chaque ouverture, l&apos;app les remet à
              jour.
            </p>
          </>
        ) : null}

        {pane === 'shortNight' ? (
          <>
            <HvLottie id="08" className="mx-auto h-32 w-32" />
            <p className="text-center text-[22px] font-bold text-white">
              Ton réveil sonne dans 30 min. On le décale ?
            </p>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              onClick={() => {
                const cur = armed[0]?.wakeHm ?? '07:00'
                const shifted = shortNightShiftSuggestion(cur) ?? '11:00'
                const key = armed[0]?.dateKey ?? today
                const day = state.days.find((d) => d.dateKey === key) ?? emptyDayPlan(key)
                upsertHvDay({ ...day, wakeOverrideHm: shifted, oneShotOffsetMin: 0, noAlarm: false })
                void syncHvAlarms()
                onClose()
              }}
              data-hv-shift-alarm
            >
              Décaler mon réveil
              <span className="ml-1 text-[14px] font-medium opacity-90">
                ·{' '}
                {fmtHm(
                  shortNightShiftSuggestion(armed[0]?.wakeHm ?? '07:00') ?? '11:00',
                )}
              </span>
            </button>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
              style={{ backgroundColor: CARD }}
              onClick={onClose}
            >
              Garder {fmtHm(armed[0]?.wakeHm ?? '07:00')}
            </button>
            <p className="text-[13px]" style={{ color: GRAY }}>
              {HV_SHORT_NIGHT_DRIVE}
            </p>
            <p className="text-[13px]" style={{ color: GRAY }}>
              Sans réponse, ton réveil reste à {fmtHm(armed[0]?.wakeHm ?? '07:00')}.
            </p>
          </>
        ) : null}

        {pane === 'freeMorning' ? (
          <>
            <HvLottie id="06" className="mx-auto h-48 w-48" />
            <h2 className="text-center text-[26px] font-bold text-white">Matinée libre !</h2>
            <p className="text-center text-[15px]" style={{ color: GRAY }}>
              Tu as un peu de sommeil à récupérer : rendors-toi, je te réveille à 10:30.
            </p>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              onClick={() => {
                const key = today
                const day = state.days.find((d) => d.dateKey === key) ?? emptyDayPlan(key)
                upsertHvDay({ ...day, wakeOverrideHm: '10:30', noAlarm: false })
                void syncHvAlarms()
                onClose()
              }}
            >
              Je me rendors jusqu&apos;à 10:30
            </button>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
              style={{ border: `1px solid ${ROW}` }}
              onClick={onClose}
            >
              Je me lève
            </button>
          </>
        ) : null}

        {pane === 'night' ? (
          <>
            <HvLottie id="09" className="mx-auto h-16 w-16" />
            <p className="text-center text-[12px] font-semibold" style={{ color: '#555' }}>
              Réveil
            </p>
            <p className="text-center text-[48px] font-bold" style={{ color: '#666' }}>
              {armed[0] ? fmtHm(armed[0].wakeHm) : '—'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['+30 min', 30],
                  ['−30 min', -30],
                  ['Pas de réveil', 'off'],
                ] as const
              ).map(([label, off]) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-2xl py-4 text-[14px] font-bold"
                  style={{ backgroundColor: '#1a1a1a', color: '#777' }}
                  onClick={() => {
                    setEditKey(armed[0]?.dateKey ?? today)
                    void quickAdjust(off)
                    setNightAck(true)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {nightAck ? (
              <p className="text-center text-[14px]" style={{ color: '#666' }}>
                C&apos;est noté. Rendors-toi tranquille.
              </p>
            ) : null}
          </>
        ) : null}

        {pane === 'nap' ? (
          <>
            <HvLottie id="07" className="mx-auto h-28 w-40" />
            <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
              Nuit + sieste prévue
            </p>
            <p className="text-[15px] text-white">
              4 h 30 + 2 h 30 = 7 h sur ta journée. C&apos;est bien compté.
            </p>
            <p className="text-[13px]" style={{ color: GRAY }}>
              Une sieste prévue dans ton planning n&apos;est jamais jugée.
            </p>
            <button
              type="button"
              className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
              style={{ backgroundColor: HV_RED }}
              onClick={() => setPane('planning')}
            >
              Valider
            </button>
          </>
        ) : null}

        {pane === 'water' ? (
          <>
            <HvLottie id="17" className="mx-auto h-32 w-32" />
            <p className="text-[15px] text-white">{HV_WATER_DAY_PHRASE}</p>
            <p className="text-[13px]" style={{ color: GRAY }}>
              Rappels à lever +2 h, +5 h et +8 h — jamais la nuit.
            </p>
          </>
        ) : null}

        {/* Hidden feature name for rename audits / tests */}
        <span className="sr-only" data-hv-feature-name>
          {HV_FEATURE_NAME}
        </span>
        <span className="sr-only">{HV_FEATURE_SUBTITLE}</span>
      </div>
    </IosSheet>
  )
}
