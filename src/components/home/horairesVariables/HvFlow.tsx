import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { IosSheet } from '../../ui/IosSheet'
import { SleepHmWheelSheet } from '../SleepHmWheelSheet'
import { HvLottie } from './HvLottie'
import { HvIosSwitch } from './HvIosSwitch'
import { HvDurationPickerSheet } from './HvDurationPickerSheet'
import { HvStartPickerSheet } from './HvStartPickerSheet'
import {
  HV_FEATURE_NAME,
  HV_FEATURE_SUBTITLE,
  HV_FEATURE_TITLE,
  HV_MAX_ARMED_ALARMS,
  HV_MINOR_ADULT_HELP,
  HV_MINOR_BODY_PHRASE,
  HV_NIGHT_CONFIRM,
  HV_RED,
  HV_REST_SOFT_WAKE_HM,
  HV_SHORT_NIGHT_DRIVE,
  HV_WATER_DAY_PHRASE,
} from '../../../horaires-variables/constants'
import {
  addDaysKey,
  applyCycleModelToWeek,
  buildArmedWakes,
  classifyDayKindFromStart,
  computeWakeHm,
  computeWeekDebt,
  dateKeyOf,
  decompressionCopy,
  debtReferenceHours,
  effectiveWakeForDay,
  effectiveWakeInstant,
  emptyDayPlan,
  formatDurationFr,
  formatHoursMinutesFr,
  hmToMinutes,
  hvStatus,
  isMinorAge,
  isoWeekdayFromKey,
  materializeDaysFromTemplates,
  minutesToHm,
  mondayKeyOf,
  nextArmedWake,
  parseDateKey,
  sanitizeDecompressionMin,
  sanitizeSundayReminderHm,
  shortNightShiftSuggestion,
  slotWakeLabel,
  snapHmToStep,
  suggestedBedtimeHm,
  syncCycleSlots,
  vacationResumeKey,
  weekTemplateForDate,
  HV_WEEKDAY_LABELS_FR,
  type HvCycleLength,
  type HvDayPlan,
  type HvIsoWeekday,
  type HvWeekTemplate,
  type HvWeekdaySlot,
} from '../../../horaires-variables/engine'
import {
  computeWakeInstant,
  exceptionPhrase,
  finishDateKeyIfOvernight,
  formatShortFrDate,
  formatWeekRangeFr,
  isQuickReturnAdult,
  restHoursBetween,
  shouldShowMinorRestCard,
  suggestedBedFromWake,
} from '../../../horaires-variables/rules'
import {
  getHvState,
  saveHvState,
  upsertHvDay,
  HV_CHANGED_EVENT,
} from '../../../services/horairesVariables/storage'
import { syncHvAlarms } from '../../../services/horairesVariables/sync'
import { getCalorieProfile } from '../../../services/nutritionStorage'
import { getRecentSleepNights } from '../../../services/sleepStorage'
import { getSleepAlarmSettings } from '../../../services/sleepAlarmStorage'

const CARD = '#1C1C1E'
const ROW = '#2C2C2E'
const GRAY = '#ACB4BA'

const CYCLE_PILLS: { n: HvCycleLength; label: string }[] = [
  { n: 1, label: 'Chaque semaine' },
  { n: 2, label: '2 semaines' },
  { n: 3, label: '3 semaines' },
  { n: 4, label: '4 semaines' },
]

const CYCLE_NAME_PRESETS = ['Matin', 'Après-midi', 'Nuit'] as const

const WEEK_TAB_LABELS = ['Cette semaine', 'Semaine prochaine', 'Dans 2 semaines'] as const

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

function weekdayLong(dateKey: string): string {
  const wd = isoWeekdayFromKey(dateKey)
  return wd ? HV_WEEKDAY_LABELS_FR[wd] : dateKey
}

function nightExplainFr(
  startDateKey: string,
  startHm: string,
  wakeDateKey: string,
  wakeHm: string,
): string {
  const startWd = weekdayLong(startDateKey)
  const prevKey = addDaysKey(startDateKey, -1) ?? startDateKey
  return `${startWd} ${fmtHm(startHm)}, c'est dans la nuit de ${weekdayLong(prevKey).toLowerCase()} à ${startWd.toLowerCase()}. Réveil ${weekdayLong(wakeDateKey).toLowerCase()} ${fmtHm(wakeHm)}.`
}

function kindTag(
  kind: HvDayPlan['kind'],
  isMinor: boolean,
): string | null {
  if (kind === 'tot') return 'Tôt'
  if (kind === 'journee') return 'Journée'
  if (kind === 'soir') return 'Soir'
  if (kind === 'nuit') return isMinor ? null : 'Nuit'
  if (kind === 'repos') return 'Repos'
  return null
}

function nextCycleName(letter: string, current: string): string {
  if (current === letter) return CYCLE_NAME_PRESETS[0]
  const i = CYCLE_NAME_PRESETS.indexOf(current as (typeof CYCLE_NAME_PRESETS)[number])
  if (i < 0) return CYCLE_NAME_PRESETS[0]
  if (i >= CYCLE_NAME_PRESETS.length - 1) return letter
  return CYCLE_NAME_PRESETS[i + 1]!
}

function refMondayForLetter(
  thisMonday: string,
  letterIndex: number,
): string {
  return addDaysKey(thisMonday, -letterIndex * 7) ?? thisMonday
}

function restBeforeDay(days: HvDayPlan[], day: HvDayPlan): number | null {
  if (!day.startHm) return null
  const prev = [...days]
    .filter((d) => d.dateKey < day.dateKey && d.startHm && d.finishHm)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .at(-1)
  if (!prev?.finishHm || !prev.startHm) return null
  const finKey = finishDateKeyIfOvernight(prev.dateKey, prev.startHm, prev.finishHm)
  return restHoursBetween(
    { dateKey: finKey, hm: prev.finishHm },
    { dateKey: day.dateKey, hm: day.startHm },
  )
}

function showVolantLine(args: {
  day: HvDayPlan
  days: HvDayPlan[]
  minor: boolean
}): boolean {
  if (args.minor) return false
  if (isQuickReturnAdult(restBeforeDay(args.days, args.day))) return true
  const prevKey = addDaysKey(args.day.dateKey, -1)
  const prev = args.days.find((d) => d.dateKey === prevKey)
  return prev?.kind === 'nuit'
}

function dayForWake(
  days: HvDayPlan[],
  wake: { dateKey: string; wakeHm: string },
  trajetMin: number,
  prepMin: number,
): HvDayPlan | undefined {
  return (
    days.find((d) => {
      const w = effectiveWakeInstant(d, trajetMin, prepMin)
      return w != null && w.wakeDateKey === wake.dateKey && w.wakeHm === wake.wakeHm
    }) ?? days.find((d) => d.dateKey === wake.dateKey)
  )
}

function StatusPill({
  kind,
  label,
  onClick,
}: {
  kind: ReturnType<typeof hvStatus>['kind']
  label: string
  onClick: () => void
}) {
  const active = kind === 'active'
  return (
    <button
      type="button"
      onClick={onClick}
      className="ios-press inline-flex min-h-[44px] items-center gap-2 self-start rounded-full px-3 text-[13px] font-semibold"
      style={{
        backgroundColor: active ? '#2C2C2E' : CARD,
        color: active ? '#fff' : GRAY,
      }}
      data-hv-status={kind}
    >
      {active ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: HV_RED }}
          aria-hidden
        />
      ) : null}
      {label}
    </button>
  )
}

function DayRow({
  day,
  trajetMin,
  prepMin,
  age,
  days,
  minor,
  onClick,
  onToggleWork,
  onCancelException,
}: {
  day: HvDayPlan
  trajetMin: number
  prepMin: number
  age: number
  days: HvDayPlan[]
  minor: boolean
  onClick: () => void
  onToggleWork: () => void
  onCancelException: () => void
}) {
  const wake = effectiveWakeForDay(day, trajetMin, prepMin)
  const tag = kindTag(day.kind, minor)
  const isRepos = day.kind === 'repos'
  const bed =
    wake != null
      ? suggestedBedFromWake({
          wakeDateKey: effectiveWakeInstant(day, trajetMin, prepMin)?.wakeDateKey ?? day.dateKey,
          wakeHm: wake,
          age,
          finishDateKey: day.finishHm
            ? finishDateKeyIfOvernight(day.dateKey, day.startHm ?? day.finishHm, day.finishHm)
            : null,
          finishHm: day.finishHm,
          trajetReturnMin: day.trajetMin ?? trajetMin,
        })
      : null
  const restH = restBeforeDay(days, day)
  const minorCard = shouldShowMinorRestCard(age, restH)
  const volant = showVolantLine({ day, days, minor })

  return (
    <div className="space-y-1" data-hv-day={day.dateKey}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={onToggleWork}
          className="ios-press flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-2xl px-2 text-[11px] font-semibold text-white"
          style={{ backgroundColor: CARD }}
          data-hv-work-toggle={isRepos ? 'repos' : 'work'}
        >
          {isRepos ? 'Repos' : 'Travail'}
        </button>
        <button
          type="button"
          onClick={onClick}
          className="ios-press flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2.5 text-left"
          style={{ backgroundColor: CARD }}
        >
          <span className="w-[92px] shrink-0 text-[14px] font-semibold text-white">
            {formatShortFrDate(day.dateKey)}
          </span>
          {tag ? (
            <span className="text-[11px] font-semibold" style={{ color: GRAY }}>
              {tag}
            </span>
          ) : null}
          <span className="ml-auto min-w-0 text-right">
            {isRepos ? (
              <span className="text-[14px] font-semibold text-white">
                {day.softWake ? fmtHm(day.softWakeHm) : 'pas de réveil'}
              </span>
            ) : day.startHm ? (
              <>
                <span className="block text-[13px] text-white">
                  Je commence à {fmtHm(day.startHm)}
                  {wake ? ` · Réveil ${fmtHm(wake)}` : ''}
                </span>
                {bed ? (
                  <span className="block text-[11px]" style={{ color: GRAY }}>
                    Au lit vers {fmtHm(bed.bedHm)}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: GRAY }}>À régler</span>
            )}
          </span>
          <ChevronRight size={16} color={GRAY} />
        </button>
      </div>
      {day.exception ? (
        <div className="flex items-center gap-2 pl-[52px]">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: ROW, color: GRAY }}
          >
            Juste cette fois
          </span>
          <button
            type="button"
            className="min-h-[44px] text-[13px] font-semibold"
            style={{ color: GRAY }}
            onClick={onCancelException}
            data-hv-exception-cancel
          >
            Annuler
          </button>
        </div>
      ) : null}
      {minorCard ? (
        <div
          className="rounded-2xl px-3 py-2"
          style={{ backgroundColor: CARD, marginLeft: 52 }}
          data-hv-minor-rest
        >
          <p className="text-[12px]" style={{ color: GRAY }}>
            {HV_MINOR_BODY_PHRASE}
          </p>
          <p className="mt-1 text-[12px]" style={{ color: GRAY }}>
            {HV_MINOR_ADULT_HELP}
          </p>
        </div>
      ) : null}
      {volant ? (
        <p className="pl-[52px] text-[12px]" style={{ color: GRAY }} data-hv-volant>
          {HV_SHORT_NIGHT_DRIVE}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Emploi du temps variable — sheets for the 17 maquette screens.
 * Shared « Mon planning » (extends classic alarm, does not duplicate).
 */
export function HvFlow({ open, onClose, initialPane = 'activation' }: Props) {
  const [pane, setPane] = useState<HvFlowPane>(initialPane)
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [draftStart, setDraftStart] = useState('08:00')
  const [draftKind, setDraftKind] = useState<HvDayPlan['kind']>('tot')
  const [draftTrajetMin, setDraftTrajetMin] = useState<number | null>(null)
  const [draftPrepMin, setDraftPrepMin] = useState<number | null>(null)
  const [draftWakeOverride, setDraftWakeOverride] = useState<string | null>(null)
  const [draftFinishHm, setDraftFinishHm] = useState<string | null>(null)
  const [applyEveryWeek, setApplyEveryWeek] = useState(false)
  const [applyToKind, setApplyToKind] = useState(false)
  const [decMin, setDecMin] = useState(60)
  const [finishHm, setFinishHm] = useState('23:00')
  const [softWake, setSoftWake] = useState(false)
  const [vacationUntil, setVacationUntil] = useState<string | null>(null)
  const [weekTab, setWeekTab] = useState<0 | 1 | 2>(1)
  const [nightAck, setNightAck] = useState(false)
  const [durationField, setDurationField] = useState<
    null | 'trajet' | 'prep' | 'souffler' | 'dayTrajet' | 'dayPrep'
  >(null)
  const [cycleTab, setCycleTab] = useState<HvWeekTemplate>('A')
  const [slotEdit, setSlotEdit] = useState<{
    week: HvWeekTemplate
    weekday: HvIsoWeekday
  } | null>(null)
  const [wheelField, setWheelField] = useState<null | 'wake' | 'finish' | 'start'>(null)
  const [startPickerOpen, setStartPickerOpen] = useState(false)

  useEffect(() => {
    if (open) {
      const st = getHvState()
      const next =
        initialPane !== 'activation'
          ? initialPane
          : st.settings.enabled
            ? 'planning'
            : 'activation'
      setPane(next)
      setDecMin(st.settings.decompressionMin)
      setNightAck(false)
      setToast(null)
    }
  }, [open, initialPane])

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

  const settings = useMemo(() => syncCycleSlots(state.settings), [state.settings])
  const age = getCalorieProfile().age
  const minor = isMinorAge(age)
  const today = dateKeyOf(new Date())
  const thisMonday = mondayKeyOf(new Date())
  const status = hvStatus(settings, today)

  const showMonday = addDaysKey(thisMonday, weekTab * 7) ?? thisMonday
  const weekLetter = weekTemplateForDate(
    showMonday,
    settings.weekARefMondayKey,
    settings.cycleLength,
  )
  const weekModel =
    settings.cycleWeeks.find((w) => w.letter === weekLetter) ?? settings.cycleWeeks[0]
  const weekModelName = weekModel && weekModel.name !== weekModel.letter ? weekModel.name : weekLetter

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
        trajetMin: settings.trajetMin,
        prepMin: settings.prepMin,
        fromDateKey: today,
        maxArmed: HV_MAX_ARMED_ALARMS,
      }),
    [state.days, settings.trajetMin, settings.prepMin, today],
  )
  const nextWake = nextArmedWake(armed)

  const nights = getRecentSleepNights(7)
  const debt = computeWeekDebt({
    tibHours: nights.map((n) => n.tstHours ?? 0),
    referenceHours: debtReferenceHours(age),
  })
  const napDaySummary = (() => {
    const nightHours = nights.find((n) => n.tstHours != null)?.tstHours ?? null
    if (nightHours == null) return null
    const nightMin = Math.round(nightHours * 60)
    const refMin = Math.round(debtReferenceHours(age) * 60)
    const napMin = Math.max(0, refMin - nightMin)
    return {
      night: formatHoursMinutesFr(nightMin),
      nap: formatHoursMinutesFr(napMin),
      total: formatHoursMinutesFr(nightMin + napMin),
      hasNap: napMin > 0,
    }
  })()

  const editingWeek =
    settings.cycleWeeks.find((w) => w.letter === cycleTab) ?? settings.cycleWeeks[0]
  const editingSlots = editingWeek?.slots ?? settings.weekASlots
  const slotBeingEdited = slotEdit
    ? (settings.cycleWeeks.find((w) => w.letter === slotEdit.week)?.slots ?? []).find(
        (s) => s.weekday === slotEdit.weekday,
      ) ?? null
    : null

  const title =
    pane === 'planning' || pane === 'quick' || pane === 'day' || pane === 'rest' || pane === 'nap'
      ? HV_FEATURE_TITLE
      : pane === 'activation' && settings.enabled
        ? 'Ma semaine'
        : pane === 'debt'
          ? 'Ta semaine'
          : pane === 'armed'
            ? 'Réveils prêts'
            : pane === 'decompression'
              ? 'Pause avant le lit'
              : pane === 'water'
                ? 'Eau'
                : HV_FEATURE_TITLE

  const persistSettings = (nextSettings: typeof settings, days?: HvDayPlan[]) => {
    const synced = syncCycleSlots(nextSettings)
    const nextDays =
      days ??
      materializeDaysFromTemplates({
        settings: synced,
        existingDays: state.days,
        fromDateKey: today,
        isMinor: minor,
      })
    saveHvState({ settings: synced, days: nextDays })
  }

  const activate = async () => {
    const nowIso = new Date().toISOString()
    const todayKey = dateKeyOf(new Date())
    const days = materializeDaysFromTemplates({
      settings,
      existingDays: state.days,
      fromDateKey: todayKey,
      isMinor: minor,
    })
    saveHvState({
      settings: {
        ...settings,
        enabled: true,
        activatedAt: nowIso,
        autoPaused: false,
        lastStartEditAt: nowIso,
      },
      days,
    })
    await syncHvAlarms()
    setToast('Tes réveils sont prêts.')
    setPane(minor ? 'minor' : 'planning')
  }

  const saveTemplate = async () => {
    const days = materializeDaysFromTemplates({
      settings,
      existingDays: state.days,
      fromDateKey: today,
      isMinor: minor,
    })
    saveHvState({ settings, days })
    await syncHvAlarms()
    setPane('planning')
  }

  const updateSlot = (week: HvWeekTemplate, weekday: HvIsoWeekday, next: HvWeekdaySlot) => {
    const cycleWeeks = settings.cycleWeeks.map((w) =>
      w.letter === week
        ? { ...w, slots: w.slots.map((s) => (s.weekday === weekday ? { ...s, ...next } : s)) }
        : w,
    )
    persistSettings({ ...settings, cycleWeeks })
  }

  const toggleSlotWork = (slot: HvWeekdaySlot) => {
    if (slot.kind === 'repos') {
      const startHm = slot.lastStartHm ?? slot.startHm ?? '08:00'
      updateSlot(cycleTab, slot.weekday, {
        ...slot,
        kind: 'work',
        startHm,
        lastStartHm: startHm,
      })
    } else {
      updateSlot(cycleTab, slot.weekday, {
        ...slot,
        kind: 'repos',
        lastStartHm: slot.startHm ?? slot.lastStartHm ?? '08:00',
        startHm: null,
      })
    }
  }

  const openDay = (day: HvDayPlan) => {
    setEditKey(day.dateKey)
    setDraftStart(day.startHm ?? day.lastStartHm ?? '08:00')
    setDraftKind(day.kind === 'unset' ? 'tot' : day.kind)
    setDraftTrajetMin(day.trajetMin)
    setDraftPrepMin(day.prepMin)
    setDraftWakeOverride(day.wakeOverrideHm)
    setDraftFinishHm(day.finishHm)
    setSoftWake(day.softWake)
    setApplyEveryWeek(false)
    setApplyToKind(false)
    if (day.kind === 'repos') setPane('rest')
    else setPane('day')
  }

  const classifiedDraftKind = (): HvDayPlan['kind'] => {
    if (draftKind === 'repos') return 'repos'
    return classifyDayKindFromStart(draftStart, { isMinor: minor })
  }

  const saveDay = async () => {
    if (!editKey) return
    const kind = classifiedDraftKind()
    const prev = state.days.find((d) => d.dateKey === editKey) ?? emptyDayPlan(editKey)
    const asException = !applyEveryWeek
    const next: HvDayPlan = {
      ...prev,
      dateKey: editKey,
      kind,
      startHm: kind === 'repos' ? null : draftStart,
      lastStartHm: kind === 'repos' ? (prev.lastStartHm ?? draftStart) : draftStart,
      finishHm: kind === 'repos' ? null : draftFinishHm,
      trajetMin: kind === 'repos' ? prev.trajetMin : draftTrajetMin,
      prepMin: kind === 'repos' ? prev.prepMin : draftPrepMin,
      wakeOverrideHm: kind === 'repos' ? null : draftWakeOverride,
      softWake: kind === 'repos' ? softWake : false,
      noAlarm: kind === 'repos' && !softWake,
      oneShotOffsetMin: 0,
      exception: asException,
    }

    if (applyEveryWeek) {
      const wd = isoWeekdayFromKey(editKey)
      const letter = weekTemplateForDate(
        editKey,
        settings.weekARefMondayKey,
        settings.cycleLength,
      )
      if (wd) {
        const week = settings.cycleWeeks.find((w) => w.letter === letter)
        const slot = week?.slots.find((s) => s.weekday === wd)
        updateSlot(letter, wd, {
          weekday: wd,
          kind: kind === 'repos' ? 'repos' : 'work',
          startHm: kind === 'repos' ? null : draftStart,
          lastStartHm: kind === 'repos' ? (slot?.lastStartHm ?? draftStart) : draftStart,
        })
      }
      const days = materializeDaysFromTemplates({
        settings: getHvState().settings,
        existingDays: getHvState().days.map((d) =>
          d.dateKey === editKey ? { ...next, exception: false } : d,
        ),
        fromDateKey: today,
        isMinor: minor,
      })
      saveHvState({ days })
    } else {
      upsertHvDay(next)
    }

    if (applyToKind && kind !== 'repos' && kind !== 'unset') {
      const fresh = getHvState()
      const patched = fresh.days.map((d) => {
        if (d.kind !== kind) return d
        return {
          ...d,
          trajetMin: draftTrajetMin,
          prepMin: draftPrepMin,
          wakeOverrideHm: draftWakeOverride,
        }
      })
      saveHvState({ days: patched })
    }

    await syncHvAlarms()
    setPane('planning')
  }

  const cancelException = (day: HvDayPlan) => {
    const days = materializeDaysFromTemplates({
      settings,
      existingDays: state.days.map((d) =>
        d.dateKey === day.dateKey ? { ...d, exception: false } : d,
      ),
      fromDateKey: today,
      isMinor: minor,
    })
    saveHvState({ days })
    void syncHvAlarms()
  }

  const toggleDayWork = (day: HvDayPlan) => {
    if (day.kind === 'repos') {
      const startHm = day.lastStartHm ?? '08:00'
      upsertHvDay({
        ...day,
        kind: classifyDayKindFromStart(startHm, { isMinor: minor }),
        startHm,
        lastStartHm: startHm,
        noAlarm: false,
        exception: true,
      })
    } else {
      upsertHvDay({
        ...day,
        kind: 'repos',
        lastStartHm: day.startHm ?? day.lastStartHm,
        startHm: null,
        finishHm: null,
        noAlarm: !day.softWake,
        exception: true,
      })
    }
    void syncHvAlarms()
  }

  const targetDayForQuick = (): HvDayPlan | null => {
    if (!nextWake) {
      const key = addDaysKey(today, 1)
      return key ? (state.days.find((d) => d.dateKey === key) ?? emptyDayPlan(key)) : null
    }
    return (
      dayForWake(state.days, nextWake, settings.trajetMin, settings.prepMin) ??
      emptyDayPlan(nextWake.dateKey)
    )
  }

  const quickAdjust = async (offsetMin: number | 'off') => {
    const day = targetDayForQuick()
    if (!day) return
    setEditKey(day.dateKey)
    const wd = weekdayLong(day.dateKey)
    if (offsetMin === 'off') {
      upsertHvDay({ ...day, noAlarm: true, oneShotOffsetMin: 0, exception: true })
      setToast('Pas de réveil ce jour-là.')
    } else {
      const nextDay: HvDayPlan = {
        ...day,
        noAlarm: false,
        oneShotOffsetMin: (day.oneShotOffsetMin || 0) + offsetMin,
        exception: true,
      }
      upsertHvDay(nextDay)
      const nextHm =
        effectiveWakeForDay(nextDay, settings.trajetMin, settings.prepMin) ??
        nextWake?.wakeHm ??
        '07:00'
      const offLabel =
        offsetMin === 60 ? '+1 h' : offsetMin === -30 ? '−30 min' : `+${offsetMin} min`
      setToast(`${wd} : réveil à ${fmtHm(nextHm)} (${offLabel}).`)
    }
    await syncHvAlarms()
  }

  const shiftWakeSuggestion = (day: HvDayPlan): string => {
    const later = [...state.days]
      .filter((d) => d.dateKey > day.dateKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    for (const d of later) {
      const w = effectiveWakeForDay(d, settings.trajetMin, settings.prepMin)
      if (w) return w
    }
    const cur =
      effectiveWakeForDay(day, settings.trajetMin, settings.prepMin) ??
      nextWake?.wakeHm ??
      '07:00'
    return shortNightShiftSuggestion(cur) ?? minutesToHm((hmToMinutes(cur) ?? 7 * 60) + 240)
  }

  const applyShiftWake = async (day: HvDayPlan) => {
    const shifted = shiftWakeSuggestion(day)
    upsertHvDay({
      ...day,
      wakeOverrideHm: shifted,
      oneShotOffsetMin: 0,
      noAlarm: false,
      exception: true,
    })
    await syncHvAlarms()
  }

  const setCycleLength = (n: HvCycleLength) => {
    const next = syncCycleSlots({ ...settings, cycleLength: n })
    persistSettings(next)
    if (!next.cycleWeeks.some((w) => w.letter === cycleTab)) setCycleTab('A')
  }

  const setThisWeekLetter = (letter: HvWeekTemplate) => {
    const idx = settings.cycleWeeks.findIndex((w) => w.letter === letter)
    const ref = refMondayForLetter(thisMonday, Math.max(0, idx))
    persistSettings({ ...settings, weekARefMondayKey: ref })
    setToast(
      `Semaine ${settings.cycleWeeks[idx]?.name ?? letter} cette semaine. Tes réveils sont prêts.`,
    )
  }

  const resumeCycleModel = () => {
    const model = weekModel ?? settings.cycleWeeks[0]
    if (!model) return
    const copied = applyCycleModelToWeek(model.slots, showMonday, {
      isMinor: minor,
      existing: state.days,
    })
    const merged = [
      ...state.days.filter((d) => !copied.some((c) => c.dateKey === d.dateKey)),
      ...copied,
    ]
    saveHvState({ days: merged })
    void syncHvAlarms()
    setToast(`Semaine ${weekModelName} : réveils prêts.`)
  }

  const draftOffsets = {
    trajetMin: draftTrajetMin ?? settings.trajetMin,
    prepMin: draftPrepMin ?? settings.prepMin,
  }
  const draftWakeInstant =
    editKey && draftKind !== 'repos'
      ? computeWakeInstant({
          startDateKey: editKey,
          startHm: draftStart,
          trajetMin: draftOffsets.trajetMin,
          prepMin: draftOffsets.prepMin,
          wakeOverrideHm: draftWakeOverride,
        })
      : null
  const wakeTooClose =
    draftKind !== 'repos' &&
    (() => {
      const start = hmToMinutes(draftStart)
      const wake = draftWakeInstant ? hmToMinutes(draftWakeInstant.wakeHm) : null
      if (start == null || wake == null) return false
      const lead = draftOffsets.trajetMin + draftOffsets.prepMin
      return lead < 30 && !draftWakeOverride
    })()

  const editingDay =
    editKey != null
      ? (state.days.find((d) => d.dateKey === editKey) ?? emptyDayPlan(editKey))
      : null
  const editingRestH = editingDay ? restBeforeDay(state.days, editingDay) : null
  const showMinorRest =
    editingDay != null && shouldShowMinorRestCard(age, editingRestH)
  const showVolant =
    editingDay != null && showVolantLine({ day: editingDay, days: state.days, minor })

  const resumeLabel = vacationUntil
    ? (() => {
        const key = vacationResumeKey(vacationUntil)
        const d = key ? parseDateKey(key) : null
        return d
          ? d.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })
          : key
      })()
    : null

  const simpleWakeHm =
    settings.pauseSimpleWakeHm || getSleepAlarmSettings().timeHm || '07:30'

  const onStatusClick = () => {
    if (status.kind === 'draft') {
      setPane('activation')
      return
    }
    if (status.kind === 'auto') {
      saveHvState({
        settings: {
          ...settings,
          autoPaused: false,
          autoPauseCardDismissed: true,
          lastStartEditAt: new Date().toISOString(),
        },
      })
      setPane('planning')
      return
    }
    if (status.kind === 'vacation') {
      setPane('vacation')
      return
    }
    setPane('planning')
  }

  const sheetNight = pane === 'night'

  const primaryFooter =
    pane === 'activation' ? (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void (settings.enabled ? saveTemplate() : activate())}
          className="ios-press w-full rounded-2xl py-3.5 text-center text-[17px] font-semibold text-white"
          style={{ backgroundColor: HV_RED }}
          data-hv-activate
        >
          {settings.enabled ? 'Enregistrer' : 'Activer mon planning'}
        </button>
        <p className="text-center text-[12px]" style={{ color: GRAY }}>
          Ton planning reste sur ton téléphone.
        </p>
      </div>
    ) : pane === 'day' && editKey ? (
      <button
        type="button"
        onClick={() => void saveDay()}
        className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
        style={{ backgroundColor: HV_RED }}
      >
        C&apos;est bon
      </button>
    ) : pane === 'rest' && editKey ? (
      <button
        type="button"
        onClick={() => {
          setDraftKind('repos')
          void saveDay()
        }}
        className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
        style={{ backgroundColor: HV_RED }}
      >
        C&apos;est bon
      </button>
    ) : pane === 'vacation' ? (
      <button
        type="button"
        className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
        style={{ backgroundColor: HV_RED }}
        onClick={() => {
          if (!vacationUntil) return
          saveHvState({
            settings: {
              ...settings,
              vacationPauseUntilKey: vacationUntil,
              autoPaused: false,
              pauseSimpleWakeHm: simpleWakeHm,
            },
          })
          void syncHvAlarms()
          onClose()
        }}
      >
        Mettre en pause
      </button>
    ) : pane === 'minor' ? (
      <button
        type="button"
        className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
        style={{ backgroundColor: HV_RED }}
        onClick={() => setPane('planning')}
      >
        Continuer
      </button>
    ) : pane === 'decompression' ? (
      <button
        type="button"
        className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
        style={{ backgroundColor: HV_RED }}
        onClick={() => {
          saveHvState({
            settings: {
              ...settings,
              decompressionMin: sanitizeDecompressionMin(decMin),
            },
          })
          setPane(settings.enabled ? 'planning' : 'activation')
        }}
      >
        C&apos;est bon
      </button>
    ) : undefined

  return (
    <>
      <IosSheet
        open={open}
        onClose={onClose}
        title={title}
        footer={sheetNight ? undefined : primaryFooter}
      >
        <div
          className="relative flex flex-col gap-3 px-1 pb-8 pt-3"
          data-hv-flow={pane}
          style={
            sheetNight
              ? { background: '#000', color: '#3a3a3c', filter: 'brightness(0.55)', paddingTop: 12 }
              : undefined
          }
        >
          <div
            aria-hidden
            className="pointer-events-none sticky -top-1 z-10 -mx-6 h-4"
            style={{
              background: 'linear-gradient(to bottom, var(--color-card), transparent)',
              marginBottom: -8,
            }}
          />

          {!sheetNight ? (
            <StatusPill kind={status.kind} label={status.label} onClick={onStatusClick} />
          ) : null}

          {toast && pane !== 'night' ? (
            <p className="text-[14px] text-white" data-hv-toast>
              {toast}
            </p>
          ) : null}

          {pane === 'activation' ? (
            <>
              <HvLottie id="02" className="mx-auto h-24 w-full max-w-[240px]" />
              <p className="text-[15px] leading-snug text-white">
                Tes heures changent ? Ton réveil suit.
              </p>
              <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
                À régler une fois
              </p>
              <div
                className="overflow-hidden rounded-2xl"
                style={{ backgroundColor: CARD }}
                data-hv-activation-settings
              >
                {(
                  [
                    {
                      key: 'trajet' as const,
                      label: 'Trajet',
                      value: formatDurationFr(settings.trajetMin),
                      hint: "Aller à l'école ou au travail",
                    },
                    {
                      key: 'prep' as const,
                      label: 'Me préparer',
                      value: formatDurationFr(settings.prepMin),
                      hint: 'Avant de partir',
                    },
                    {
                      key: 'souffler' as const,
                      label: 'Pause avant le lit',
                      value: formatDurationFr(settings.decompressionMin),
                      hint: 'Après la fin, avant le lit',
                    },
                  ] as const
                ).map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setDurationField(row.key)}
                    className="ios-press flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    data-hv-duration-row={row.key}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-white">{row.label}</span>
                      <span className="block text-[12px]" style={{ color: GRAY }}>
                        {row.hint}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] tabular-nums" style={{ color: GRAY }}>
                      {row.value}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: GRAY }} aria-hidden />
                  </button>
                ))}
              </div>

              <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
                Ma semaine se répète
              </p>
              <div className="grid grid-cols-2 gap-2" data-hv-cycle-pills>
                {CYCLE_PILLS.map((p) => (
                  <button
                    key={p.n}
                    type="button"
                    onClick={() => setCycleLength(p.n)}
                    className="ios-press min-h-[44px] rounded-2xl px-2 text-[13px] font-semibold"
                    style={{
                      backgroundColor: settings.cycleLength === p.n ? ROW : CARD,
                      color: settings.cycleLength === p.n ? '#fff' : GRAY,
                    }}
                    data-hv-cycle-length={p.n}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {settings.cycleLength > 1 ? (
                <>
                  <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
                    Cette semaine, je suis du…
                  </p>
                  <div className="flex gap-2" data-hv-this-week-letter>
                    {settings.cycleWeeks.map((w) => (
                      <button
                        key={w.letter}
                        type="button"
                        onClick={() => setThisWeekLetter(w.letter)}
                        className="ios-press min-h-[44px] flex-1 rounded-2xl text-[14px] font-semibold"
                        style={{
                          backgroundColor:
                            weekTemplateForDate(
                              thisMonday,
                              settings.weekARefMondayKey,
                              settings.cycleLength,
                            ) === w.letter
                              ? ROW
                              : CARD,
                          color: '#fff',
                        }}
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
                {settings.cycleLength > 1 ? 'Tes semaines' : 'Ta semaine'}
              </p>
              {settings.cycleLength > 1 ? (
                <div className="flex rounded-xl p-1" style={{ backgroundColor: CARD }} data-hv-ab-tabs>
                  {settings.cycleWeeks.map((w) => (
                    <button
                      key={w.letter}
                      type="button"
                      className="flex-1 rounded-lg py-2.5 text-[14px] font-semibold"
                      style={{
                        backgroundColor: cycleTab === w.letter ? ROW : 'transparent',
                        color: cycleTab === w.letter ? '#fff' : GRAY,
                      }}
                      onClick={() => setCycleTab(w.letter)}
                      onDoubleClick={() => {
                        const cycleWeeks = settings.cycleWeeks.map((x) =>
                          x.letter === w.letter
                            ? { ...x, name: nextCycleName(w.letter, w.name) }
                            : x,
                        )
                        persistSettings({ ...settings, cycleWeeks })
                      }}
                    >
                      Semaine {w.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                className="text-left text-[13px]"
                style={{ color: GRAY }}
                onClick={() => {
                  const w = editingWeek
                  if (!w) return
                  const cycleWeeks = settings.cycleWeeks.map((x) =>
                    x.letter === w.letter ? { ...x, name: nextCycleName(w.letter, w.name) } : x,
                  )
                  persistSettings({ ...settings, cycleWeeks })
                }}
                data-hv-rename-model
              >
                Renommer la semaine {editingWeek?.name ?? 'A'}
              </button>

              <div
                className="overflow-hidden rounded-2xl"
                style={{ backgroundColor: CARD }}
                data-hv-week-slots
              >
                {editingSlots.map((slot, i) => {
                  const wake = slotWakeLabel(slot, settings.trajetMin, settings.prepMin)
                  return (
                    <div
                      key={`${cycleTab}-${slot.weekday}`}
                      className="flex min-h-[44px] items-center gap-2 px-3 py-2"
                      style={{
                        borderBottom:
                          i < editingSlots.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                      }}
                      data-hv-slot-day={slot.weekday}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSlotWork(slot)}
                        className="ios-press min-h-[44px] min-w-[44px] rounded-xl px-2 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: ROW }}
                      >
                        {slot.kind === 'repos' ? 'Repos' : 'Travail'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlotEdit({ week: cycleTab, weekday: slot.weekday })}
                        className="ios-press flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="w-[88px] text-[15px] font-semibold text-white">
                          {HV_WEEKDAY_LABELS_FR[slot.weekday]}
                        </span>
                        <span className="min-w-0 flex-1">
                          {slot.kind === 'repos' || !slot.startHm ? (
                            <span className="text-[14px]" style={{ color: GRAY }}>
                              Repos
                            </span>
                          ) : (
                            <>
                              <span className="block text-[14px] text-white">
                                Je commence à {fmtHm(slot.startHm)}
                              </span>
                              <span className="block text-[12px]" style={{ color: GRAY }}>
                                {wake ? `Réveil ${fmtHm(wake)}` : 'Réveil : à régler'}
                              </span>
                            </>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: GRAY }} aria-hidden />
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}

          {pane === 'planning' ? (
            <>
              <HvLottie id="03" className="mx-auto h-24 w-24" />
              <p className="text-[16px] font-semibold leading-snug text-white">
                Pas encore ton planning ? Règle juste demain.
              </p>
              <button
                type="button"
                onClick={() => setPane('debt')}
                className="ios-press w-full rounded-2xl px-4 py-3 text-left"
                style={{ backgroundColor: CARD }}
                data-hv-week-card
              >
                <b className="block text-[15px] text-white">Ta semaine</b>
                <small className="text-[12px]" style={{ color: GRAY }}>
                  En retard : {debt.manqueDisplayHours} h · rattrapé : {debt.recupereDisplayHours}{' '}
                  h
                  {nights.length >= 3 && nights.length < 7 ? ' · pas fini' : ''}
                </small>
              </button>
              <div className="flex rounded-xl p-1" style={{ backgroundColor: CARD }} data-hv-week-tabs>
                {([0, 1, 2] as const).map((t) => {
                  const mon = addDaysKey(thisMonday, t * 7) ?? thisMonday
                  const letter = weekTemplateForDate(
                    mon,
                    settings.weekARefMondayKey,
                    settings.cycleLength,
                  )
                  return (
                    <button
                      key={t}
                      type="button"
                      className="flex-1 rounded-lg px-1 py-2 text-[11px] font-semibold leading-tight"
                      style={{
                        backgroundColor: weekTab === t ? ROW : 'transparent',
                        color: weekTab === t ? '#fff' : GRAY,
                      }}
                      onClick={() => setWeekTab(t)}
                    >
                      {WEEK_TAB_LABELS[t]}
                      <span className="mt-0.5 block text-[10px]" style={{ color: GRAY }}>
                        {formatWeekRangeFr(mon)} · {letter}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="space-y-1.5">
                {weekDays.map((d) => (
                  <DayRow
                    key={d.dateKey}
                    day={d}
                    trajetMin={settings.trajetMin}
                    prepMin={settings.prepMin}
                    age={age}
                    days={state.days}
                    minor={minor}
                    onClick={() => openDay(d)}
                    onToggleWork={() => toggleDayWork(d)}
                    onCancelException={() => cancelException(d)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="ios-press flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                style={{ backgroundColor: CARD }}
                onClick={resumeCycleModel}
                data-hv-resume-model
              >
                <div>
                  <b className="block text-[15px] text-white">
                    Reprendre ma semaine {weekModelName}
                  </b>
                </div>
                <ChevronRight className="ml-auto" size={16} color={GRAY} />
              </button>
              <div
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: CARD }}
                data-hv-reminder
              >
                <b className="block text-[15px] text-white">Rappel du dimanche</b>
                <small className="text-[12px]" style={{ color: GRAY }}>
                  Le dimanche soir, on te demande ton planning.
                </small>
                <div className="mt-2 flex gap-1">
                  {([1, 2, 3, 4, 5, 6, 7] as const).map((wd) => (
                    <button
                      key={wd}
                      type="button"
                      className="ios-press min-h-[44px] flex-1 rounded-xl text-[11px] font-semibold text-white"
                      style={{
                        backgroundColor: settings.reminderWeekday === wd ? ROW : '#00000040',
                      }}
                      onClick={() =>
                        saveHvState({
                          settings: { ...settings, reminderWeekday: wd },
                        })
                      }
                    >
                      {HV_WEEKDAY_LABELS_FR[wd].slice(0, 3)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 min-h-[44px] text-[15px] font-semibold text-white"
                  onClick={() => {
                    const cur = settings.sundayReminderHm
                    const next =
                      cur === '18:00'
                        ? '19:00'
                        : cur === '19:00'
                          ? '20:00'
                          : cur === '20:00'
                            ? '21:00'
                            : '18:00'
                    saveHvState({
                      settings: {
                        ...settings,
                        sundayReminderHm: sanitizeSundayReminderHm(next),
                      },
                    })
                  }}
                >
                  {settings.sundayReminderHm}
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
                  Réveils prêts
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="ios-press flex-1 rounded-2xl py-3 text-[14px] font-semibold"
                  style={{ backgroundColor: CARD, color: GRAY }}
                  onClick={() => setPane('activation')}
                >
                  Ma semaine
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
                  Pause
                </button>
              </div>
            </>
          ) : null}

          {pane === 'day' && editKey ? (
            <>
              <HvLottie id="05" className="mx-auto h-24 w-56" />
              <p className="text-center text-[14px]" style={{ color: GRAY }}>
                {formatShortFrDate(editKey)}
              </p>
              {kindTag(classifiedDraftKind(), minor) ? (
                <p className="text-center text-[12px] font-semibold" style={{ color: GRAY }}>
                  {kindTag(classifiedDraftKind(), minor)}
                </p>
              ) : null}
              <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
                <button
                  type="button"
                  className="ios-press flex min-h-[44px] w-full items-center justify-between px-4 py-3"
                  onClick={() => setStartPickerOpen(true)}
                >
                  <span className="text-white">Je commence à</span>
                  <span className="flex items-center gap-1 text-white">
                    {fmtHm(draftStart)}
                    <ChevronRight size={16} color={GRAY} />
                  </span>
                </button>
                <button
                  type="button"
                  className="ios-press flex min-h-[44px] w-full items-center justify-between border-t border-white/5 px-4 py-3"
                  onClick={() => setDurationField('dayTrajet')}
                >
                  <span>
                    <span className="block text-white">Trajet</span>
                    {draftTrajetMin == null ? (
                      <span className="text-[12px]" style={{ color: GRAY }}>
                        comme d&apos;habitude
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1" style={{ color: GRAY }}>
                    {formatDurationFr(draftOffsets.trajetMin)}
                    <ChevronRight size={16} color={GRAY} />
                  </span>
                </button>
                <button
                  type="button"
                  className="ios-press flex min-h-[44px] w-full items-center justify-between border-t border-white/5 px-4 py-3"
                  onClick={() => setDurationField('dayPrep')}
                >
                  <span>
                    <span className="block text-white">Me préparer</span>
                    {draftPrepMin == null ? (
                      <span className="text-[12px]" style={{ color: GRAY }}>
                        comme d&apos;habitude
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1" style={{ color: GRAY }}>
                    {formatDurationFr(draftOffsets.prepMin)}
                    <ChevronRight size={16} color={GRAY} />
                  </span>
                </button>
                <button
                  type="button"
                  className="ios-press flex min-h-[44px] w-full items-center justify-between border-t border-white/5 px-4 py-3"
                  onClick={() => setWheelField('wake')}
                >
                  <span>
                    <span className="block text-white">Réveil</span>
                    {draftWakeOverride == null ? (
                      <span className="text-[12px]" style={{ color: GRAY }}>
                        comme d&apos;habitude
                      </span>
                    ) : (
                      <span className="text-[12px]" style={{ color: GRAY }}>
                        Réveil à…
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-white">
                    {fmtHm(draftWakeInstant?.wakeHm ?? computeWakeHm(draftStart, draftOffsets.trajetMin, draftOffsets.prepMin) ?? '--:--')}
                    <ChevronRight size={16} color={GRAY} />
                  </span>
                </button>
                <button
                  type="button"
                  className="ios-press flex min-h-[44px] w-full items-center justify-between border-t border-white/5 px-4 py-3"
                  onClick={() => setWheelField('finish')}
                >
                  <span>
                    <span className="block text-white">Je finis à</span>
                    <span className="text-[12px]" style={{ color: GRAY }}>
                      facultatif
                    </span>
                  </span>
                  <span className="flex items-center gap-1" style={{ color: GRAY }}>
                    {draftFinishHm ? fmtHm(draftFinishHm) : '—'}
                    <ChevronRight size={16} color={GRAY} />
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="text-[13px]"
                style={{ color: GRAY }}
                onClick={() => {
                  const start = hmToMinutes(draftStart)
                  if (start == null) return
                  setDraftFinishHm(minutesToHm(start + 7 * 60))
                }}
              >
                Je finis 7 h après
              </button>
              {draftWakeInstant?.crossesMidnight ? (
                <>
                  <p className="text-[13px] text-white" data-hv-night-explain>
                    {nightExplainFr(
                      editKey,
                      draftStart,
                      draftWakeInstant.wakeDateKey,
                      draftWakeInstant.wakeHm,
                    )}
                  </p>
                  <button
                    type="button"
                    className="text-left text-[13px]"
                    style={{ color: GRAY }}
                    onClick={() => {
                      const next = addDaysKey(editKey, 1)
                      if (!next) return
                      setEditKey(next)
                    }}
                  >
                    Je voulais dire {weekdayLong(addDaysKey(editKey, 1) ?? editKey).toLowerCase()}{' '}
                    {fmtHm(draftStart)}
                  </button>
                </>
              ) : null}
              <p className="text-center text-[14px]" style={{ color: GRAY }}>
                Je commence à {fmtHm(draftStart)} → réveil à{' '}
                {fmtHm(draftWakeInstant?.wakeHm ?? '?')}
              </p>
              {wakeTooClose ? (
                <p className="text-[13px]" style={{ color: GRAY }}>
                  Réveil trop près du début. On te propose{' '}
                  {fmtHm(minutesToHm((hmToMinutes(draftStart) ?? 0) - 30))}.
                </p>
              ) : null}
              {draftFinishHm ? (
                <p className="text-[13px]" style={{ color: GRAY }}>
                  {decompressionCopy(draftFinishHm, settings.decompressionMin)}
                </p>
              ) : null}
              <div
                className="flex min-h-[44px] items-center justify-between rounded-2xl px-4 py-3"
                style={{ backgroundColor: CARD }}
              >
                <span className="text-[15px] text-white">Tous mes jours « Tôt »</span>
                <HvIosSwitch
                  checked={applyToKind}
                  aria-label="Pour tous mes jours Tôt"
                  onChange={setApplyToKind}
                />
              </div>
              <div
                className="flex min-h-[44px] items-center justify-between rounded-2xl px-4 py-3"
                style={{ backgroundColor: CARD }}
              >
                <div>
                  <span className="block text-[15px] text-white">Chaque semaine</span>
                  {editingDay && draftWakeInstant ? (
                    <small className="text-[12px]" style={{ color: GRAY }}>
                      {exceptionPhrase(
                        editKey,
                        draftWakeInstant.wakeHm,
                        slotWakeLabel(
                          {
                            weekday: (isoWeekdayFromKey(editKey) ?? 1) as HvIsoWeekday,
                            kind: 'work',
                            startHm:
                              weekModel?.slots.find(
                                (s) => s.weekday === isoWeekdayFromKey(editKey),
                              )?.startHm ?? '07:30',
                          },
                          settings.trajetMin,
                          settings.prepMin,
                        ) ?? '07:30',
                      )}
                    </small>
                  ) : null}
                </div>
                <HvIosSwitch
                  checked={applyEveryWeek}
                  aria-label="Chaque semaine"
                  onChange={setApplyEveryWeek}
                />
              </div>
              {showVolant ? (
                <>
                  <p className="text-[13px]" style={{ color: GRAY }} data-hv-volant>
                    {HV_SHORT_NIGHT_DRIVE}
                  </p>
                  <button
                    type="button"
                    className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
                    style={{ backgroundColor: CARD }}
                    onClick={() => {
                      if (editingDay) void applyShiftWake(editingDay)
                    }}
                    data-hv-shift-alarm
                  >
                    Décaler mon réveil
                    <span className="ml-1 text-[13px] opacity-80">
                      · {fmtHm(editingDay ? shiftWakeSuggestion(editingDay) : '11:00')}
                    </span>
                  </button>
                </>
              ) : null}
              {showMinorRest ? (
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: CARD }}
                  data-hv-minor-rest
                >
                  <p className="text-[14px]" style={{ color: GRAY }}>
                    {HV_MINOR_BODY_PHRASE}
                  </p>
                  <p className="mt-2 text-[14px]" style={{ color: GRAY }}>
                    {HV_MINOR_ADULT_HELP}
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                className="text-[14px]"
                style={{ color: GRAY }}
                onClick={() => setPane('nap')}
              >
                + Sieste
              </button>
            </>
          ) : null}

          {pane === 'quick' ? (
            <>
              <HvLottie id="04" className="mx-auto h-16 w-16" />
              <p className="text-[12px] font-semibold" style={{ color: GRAY }}>
                Prochain réveil
              </p>
              <p className="text-[22px] font-extrabold text-white">
                {nextWake
                  ? `${formatShortFrDate(nextWake.dateKey)} · ${fmtHm(nextWake.wakeHm)}`
                  : 'À régler'}
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
                    className="ios-press min-h-[44px] rounded-2xl py-4 text-[16px] font-bold text-white"
                    style={{ backgroundColor: CARD }}
                    onClick={() => void quickAdjust(off)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className="ios-press min-h-[44px] rounded-2xl py-4 text-[16px] font-bold"
                  style={{ backgroundColor: CARD, color: GRAY }}
                  onClick={() => void quickAdjust('off')}
                >
                  Pas de réveil
                </button>
              </div>
              {toast ? (
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: CARD }}>
                  <b className="block text-[14px] text-white">{toast}</b>
                </div>
              ) : null}
              <button
                type="button"
                className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
                style={{ border: `1px solid ${HV_RED}`, color: HV_RED }}
                onClick={() => {
                  const day = targetDayForQuick()
                  if (day) openDay(day)
                  else {
                    setEditKey(addDaysKey(today, 1))
                    setPane('day')
                  }
                }}
              >
                Demain, ça change ?
              </button>
              <button
                type="button"
                className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
                style={{ backgroundColor: CARD }}
                onClick={() => {
                  const day = targetDayForQuick()
                  if (day) void applyShiftWake(day)
                }}
                data-hv-shift-alarm
              >
                Décaler mon réveil
                <span className="ml-1 text-[13px] opacity-80">
                  ·{' '}
                  {fmtHm(
                    targetDayForQuick()
                      ? shiftWakeSuggestion(targetDayForQuick()!)
                      : shortNightShiftSuggestion(nextWake?.wakeHm ?? '07:00') ?? '11:00',
                  )}
                </span>
              </button>
              {(() => {
                const day = targetDayForQuick()
                if (!day || !showVolantLine({ day, days: state.days, minor })) return null
                return (
                  <p className="text-[13px]" style={{ color: GRAY }} data-hv-volant>
                    {HV_SHORT_NIGHT_DRIVE}
                  </p>
                )
              })()}
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
                  Je commence à
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
                Repos ! Pas de réveil, sauf si tu en veux un.
              </p>
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{ backgroundColor: CARD }}
              >
                <div>
                  <b className="text-white">Réveil doux</b>
                  <small className="block text-[12px]" style={{ color: GRAY }}>
                    À {HV_REST_SOFT_WAKE_HM}, les jours de repos
                  </small>
                </div>
                <HvIosSwitch
                  checked={softWake}
                  aria-label="Réveil doux"
                  onChange={setSoftWake}
                />
              </div>
            </>
          ) : null}

          {pane === 'decompression' ? (
            <>
              <HvLottie id="11" className="mx-auto h-36 w-36" />
              <p className="text-center text-[40px] font-extrabold text-white">
                {decMin < 60
                  ? `${decMin} min`
                  : decMin % 60 === 0
                    ? `${decMin / 60} h`
                    : `${Math.floor(decMin / 60)} h ${decMin % 60}`}
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
              <p className="text-center text-[12px]" style={{ color: GRAY }}>
                Au lit vers {fmtHm(suggestedBedtimeHm(finishHm, decMin) ?? '?')}
              </p>
            </>
          ) : null}

          {pane === 'debt' ? (
            <>
              <HvLottie id="12" className="mx-auto h-28 w-28" />
              <p className="text-center text-[15px] leading-snug text-white">
                Semaine courte : {debt.manqueDisplayHours} h en retard. On rattrape un peu chaque
                jour.
              </p>
              <div className="rounded-2xl p-4" style={{ backgroundColor: CARD }}>
                <div className="mb-3 flex justify-between">
                  <div>
                    <small style={{ color: GRAY }}>En retard</small>
                    <b className="block text-white">environ {debt.manqueDisplayHours} h</b>
                  </div>
                  <div>
                    <small style={{ color: GRAY }}>Rattrapé</small>
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
                  Nuit + siestes
                  {nights.length >= 3 && nights.length < 7 ? ' · pas fini' : ''}
                </p>
              </div>
            </>
          ) : null}

          {pane === 'minor' ? (
            <>
              <HvLottie id="13" className="mx-auto h-44 w-44" />
              <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: CARD }}>
                <div className="px-4 py-3 text-[15px]" style={{ color: GRAY }}>
                  {HV_MINOR_BODY_PHRASE}
                </div>
                <div className="border-t border-white/5 px-4 py-3">
                  <p className="text-[15px]" style={{ color: GRAY }}>
                    {HV_MINOR_ADULT_HELP}
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {pane === 'vacation' ? (
            <>
              <HvLottie id="14" className="mx-auto h-36 w-36" />
              <h2 className="text-center text-[22px] font-bold text-white">
                Planning en pause.
              </h2>
              <p className="text-center text-[14px]" style={{ color: GRAY }}>
                En attendant, réveil à {fmtHm(simpleWakeHm)}.
                {resumeLabel ? ` Retour ${resumeLabel}.` : ''}
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
                      className="flex min-h-[44px] flex-1 flex-col items-center rounded-xl py-2"
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
              <button
                type="button"
                className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold"
                style={{ border: `1px solid ${HV_RED}`, color: HV_RED }}
                onClick={() => {
                  saveHvState({
                    settings: {
                      ...settings,
                      vacationPauseUntilKey: null,
                      autoPaused: false,
                    },
                  })
                  void syncHvAlarms()
                  setPane('planning')
                }}
              >
                Reprendre
              </button>
            </>
          ) : null}

          {pane === 'armed' ? (
            <>
              <HvLottie id="16" className="mx-auto h-20 w-20" />
              <p className="text-[17px] font-semibold text-white">
                Semaine {weekModelName} : réveils prêts.
              </p>
              <p className="text-[14px]" style={{ color: GRAY }}>
                {armed.length} réveils prêts pour les 2 semaines.
              </p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {armed.map((a) => (
                  <div
                    key={`${a.dateKey}-${a.wakeHm}`}
                    className="flex justify-between rounded-xl px-3 py-2"
                    style={{ backgroundColor: CARD }}
                  >
                    <span className="text-[14px] text-white">{formatShortFrDate(a.dateKey)}</span>
                    <span className="text-[14px] font-semibold text-white">{fmtHm(a.wakeHm)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[13px]" style={{ color: GRAY }}>
                Ils sonnent même app fermée.
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
                  const day = targetDayForQuick()
                  if (day) void applyShiftWake(day)
                  onClose()
                }}
                data-hv-shift-alarm
              >
                Décaler mon réveil
                <span className="ml-1 text-[14px] font-medium opacity-90">
                  ·{' '}
                  {fmtHm(
                    targetDayForQuick()
                      ? shiftWakeSuggestion(targetDayForQuick()!)
                      : shortNightShiftSuggestion(nextWake?.wakeHm ?? '07:00') ?? '11:00',
                  )}
                </span>
              </button>
              <button
                type="button"
                className="ios-press w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
                style={{ backgroundColor: CARD }}
                onClick={onClose}
              >
                Garder {fmtHm(nextWake?.wakeHm ?? '07:00')}
              </button>
              {!minor ? (
                <p className="text-[13px]" style={{ color: GRAY }}>
                  {HV_SHORT_NIGHT_DRIVE}
                </p>
              ) : (
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: CARD }}>
                  <p className="text-[13px]" style={{ color: GRAY }}>
                    {HV_MINOR_BODY_PHRASE}
                  </p>
                  <p className="mt-1 text-[13px]" style={{ color: GRAY }}>
                    {HV_MINOR_ADULT_HELP}
                  </p>
                </div>
              )}
              <p className="text-[13px]" style={{ color: GRAY }}>
                Sinon, il reste à {fmtHm(nextWake?.wakeHm ?? '07:00')}.
              </p>
            </>
          ) : null}

          {pane === 'freeMorning' ? (
            <>
              <HvLottie id="06" className="mx-auto h-48 w-48" />
              <h2 className="text-center text-[26px] font-bold text-white">Matinée libre !</h2>
              <p className="text-center text-[15px]" style={{ color: GRAY }}>
                Rendors-toi, je te réveille à 10 h 30.
              </p>
              <button
                type="button"
                className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
                style={{ backgroundColor: HV_RED }}
                onClick={() => {
                  const key = today
                  const day = state.days.find((d) => d.dateKey === key) ?? emptyDayPlan(key)
                  upsertHvDay({ ...day, wakeOverrideHm: '10:30', noAlarm: false, exception: true })
                  void syncHvAlarms()
                  onClose()
                }}
              >
                Dodo jusqu&apos;à 10 h 30
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
                {nextWake ? fmtHm(nextWake.wakeHm) : '—'}
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
                    className="min-h-[44px] rounded-2xl py-4 text-[14px] font-bold"
                    style={{ backgroundColor: '#1a1a1a', color: '#777' }}
                    onClick={() => {
                      void quickAdjust(off)
                      setNightAck(true)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {nightAck ? (
                <p className="text-center text-[14px]" style={{ color: '#666' }} data-hv-night-confirm>
                  {HV_NIGHT_CONFIRM}
                </p>
              ) : null}
            </>
          ) : null}

          {pane === 'nap' ? (
            <>
              <HvLottie id="07" className="mx-auto h-28 w-40" />
              <p className="text-[13px] font-semibold" style={{ color: GRAY }}>
                Nuit + sieste
              </p>
              {napDaySummary ? (
                <p className="text-[15px] text-white">
                  {napDaySummary.hasNap
                    ? `${napDaySummary.night} + ${napDaySummary.nap} = ${napDaySummary.total} sur ta journée. C'est bien compté.`
                    : `${napDaySummary.night} sur ta journée. C'est bien compté.`}
                </p>
              ) : null}
              <p className="text-[13px]" style={{ color: GRAY }}>
                Ta sieste compte aussi.
              </p>
              <button
                type="button"
                className="ios-press w-full rounded-2xl py-3.5 text-[17px] font-semibold text-white"
                style={{ backgroundColor: HV_RED }}
                onClick={() => setPane('planning')}
              >
                C&apos;est bon
              </button>
            </>
          ) : null}

          {pane === 'water' ? (
            <>
              <HvLottie id="17" className="mx-auto h-32 w-32" />
              <p className="text-[15px] text-white">{HV_WATER_DAY_PHRASE}</p>
              <p className="text-[13px]" style={{ color: GRAY }}>
                Rappels 2 h, 5 h et 8 h après ton réveil. Jamais la nuit.
              </p>
            </>
          ) : null}

          <span className="sr-only" data-hv-feature-name>
            {HV_FEATURE_NAME}
          </span>
          <span className="sr-only">{HV_FEATURE_SUBTITLE}</span>
        </div>
      </IosSheet>

      <HvDurationPickerSheet
        open={durationField != null}
        onClose={() => setDurationField(null)}
        title={
          durationField === 'trajet' || durationField === 'dayTrajet'
            ? 'Trajet'
            : durationField === 'prep' || durationField === 'dayPrep'
              ? 'Me préparer'
              : 'Pause avant le lit'
        }
        valueMin={
          durationField === 'trajet'
            ? settings.trajetMin
            : durationField === 'prep'
              ? settings.prepMin
              : durationField === 'dayTrajet'
                ? draftOffsets.trajetMin
                : durationField === 'dayPrep'
                  ? draftOffsets.prepMin
                  : settings.decompressionMin
        }
        onSave={(min) => {
          if (durationField === 'dayTrajet') {
            setDraftTrajetMin(min)
            return
          }
          if (durationField === 'dayPrep') {
            setDraftPrepMin(min)
            return
          }
          const next = {
            ...settings,
            ...(durationField === 'trajet'
              ? { trajetMin: min }
              : durationField === 'prep'
                ? { prepMin: min }
                : { decompressionMin: min }),
          }
          persistSettings(next)
        }}
      />

      <HvStartPickerSheet
        open={(slotEdit != null && slotBeingEdited != null) || startPickerOpen}
        onClose={() => {
          setSlotEdit(null)
          setStartPickerOpen(false)
        }}
        title={
          startPickerOpen
            ? editKey
              ? formatShortFrDate(editKey)
              : 'Je commence à'
            : slotEdit
              ? `${HV_WEEKDAY_LABELS_FR[slotEdit.weekday]}${
                  settings.cycleLength > 1 ? ` · Semaine ${slotEdit.week}` : ''
                }`
              : 'Je commence à'
        }
        mode={
          startPickerOpen
            ? draftKind === 'repos'
              ? 'repos'
              : 'work'
            : (slotBeingEdited?.kind ?? 'work')
        }
        startHm={startPickerOpen ? draftStart : (slotBeingEdited?.startHm ?? '08:00')}
        onSave={(next) => {
          if (startPickerOpen) {
            if (next.kind === 'repos') {
              setDraftKind('repos')
              setPane('rest')
            } else {
              setDraftStart(next.startHm ?? '08:00')
              setDraftKind(classifyDayKindFromStart(next.startHm ?? '08:00', { isMinor: minor }))
            }
            return
          }
          if (!slotEdit) return
          updateSlot(slotEdit.week, slotEdit.weekday, {
            weekday: slotEdit.weekday,
            kind: next.kind,
            startHm: next.startHm,
            lastStartHm:
              next.kind === 'repos'
                ? (slotBeingEdited?.startHm ?? slotBeingEdited?.lastStartHm ?? '08:00')
                : (next.startHm ?? '08:00'),
          })
        }}
      />

      <SleepHmWheelSheet
        open={wheelField != null}
        onClose={() => setWheelField(null)}
        title={
          wheelField === 'wake'
            ? 'Réveil à…'
            : wheelField === 'finish'
              ? 'Je finis à'
              : 'Je commence à'
        }
        valueHm={
          wheelField === 'wake'
            ? draftWakeOverride ??
              draftWakeInstant?.wakeHm ??
              computeWakeHm(draftStart, draftOffsets.trajetMin, draftOffsets.prepMin) ??
              '06:30'
            : wheelField === 'finish'
              ? draftFinishHm ?? '23:00'
              : draftStart
        }
        onSave={(hm) => {
          if (wheelField === 'wake') setDraftWakeOverride(hm)
          else if (wheelField === 'finish') setDraftFinishHm(snapHmToStep(hm) ?? hm)
          else setDraftStart(snapHmToStep(hm) ?? hm)
        }}
      />
    </>
  )
}
