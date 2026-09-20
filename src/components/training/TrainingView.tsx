import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './trainView.css'
import { BookOpen, CalendarDays, ChevronLeft, Footprints, History, Settings2 } from 'lucide-react'
import type { TrainingState, WorkoutNote } from '../../types/training'
import { getSportById } from '../../data/sports'
import {
  getTrainingState,
  removeSchedule,
  removeWorkoutNote,
  saveTrainingState,
  saveWorkoutNote,
  saveRoutineDraft,
  startRoutineDraft,
  startFreeWorkoutSession,
  setActiveWorkoutPaused,
  ensureActiveWorkoutClock,
  addCustomRoutine,
  setHealthLinked,
  setNotificationsEnabled,
  setPrimarySport,
  setStepsToday,
  todayWorkoutKcal,
  upsertSchedule,
  markVoluntaryLeaveToTrainHub,
  clearLastVoluntaryRoute,
} from '../../services/trainingStorage'
import { saveAndSyncWorkoutSession } from '../../services/trainingSyncService'
import { safeError } from '../../utils/safeLog'
import { connectHealthIntent } from '../../services/healthSteps'
import { startReminderWatcher } from '../../services/reminderService'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { estimateSessionKcal, stepsToKcal } from '../../utils/activityCalories'
import { getNutritionTarget } from '../../services/nutritionActivity'
import { SportPicker } from './SportPicker'
import { StepsCard } from './StepsCard'
import { TrainingAgenda } from './TrainingAgenda'
import { WorkoutNotebook } from './WorkoutNotebook'
import { WorkoutHistory } from './WorkoutHistory'
import { EnduranceSessionCard } from './EnduranceSessionCard'
import { TrainSheet as IosSheet } from './TrainSheet'
import {
  disciplineFromSportCategory,
  getDiscipline,
  getStoredDisciplineId,
  storeDisciplineId,
  type AppDisciplineId,
} from '../../data/disciplines'
import { useAuth } from '../../context/AuthContext'
import {
  subscribeRestLogged,
  useRestTimerContext,
} from '../../context/RestTimerContext'
import { VictoryCamera } from './VictoryCamera'
import type { VictorySessionStats } from '../../types/victory'
import { countSessionPersonalRecords } from '../../utils/sessionPrs'
import { computeStrengthSessionStats } from '../../utils/strength'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import {
  buildEnduranceDetails,
  buildTeamDetails,
  emptyTeamSheetFields,
  manualSessionMeta,
} from '../../utils/sessionMeta'
import type { TeamSessionType } from '../../types/training'
import {
  deriveRecentSessions,
  deriveTodayHubCard,
  deriveWeekStrip,
  deriveWeeklySummary,
  launchableRoutineId,
  trainSessionKindForSport,
  resolveSessionKind,
  type SportSummaryFilter,
} from '../../utils/trainHub'
import { TrainTodayCard } from './TrainTodayCard'
import { TrainWeekStrip } from './TrainWeekStrip'
import { TrainWeeklySummary } from './TrainWeeklySummary'
import { TrainRecentSessions } from './TrainRecentSessions'
import { TrainActivitySheet, type QuickActivityId } from './TrainActivitySheet'
import {
  formatSessionClock,
  liveElapsedMs,
  resolvedDurationMin,
} from '../../utils/sessionClock'
import {
  popSessionHistoryIfNeeded,
  pushSessionHistory,
  replaceHubHistory,
  shouldAutoReopenSession,
} from '../../utils/sessionBackNav'
import { deriveSessionDisplayTitle } from '../../utils/sessionDisplayTitle'

type TrainPanel = 'hub' | 'notebook' | 'endurance' | 'agenda' | 'history' | 'steps'

export function TrainingView({
  launchRoutineId = null,
  onLaunchConsumed,
  onGoToLobby,
}: {
  launchRoutineId?: string | null
  onLaunchConsumed?: () => void
  onGoToLobby?: () => void
}) {
  const { isLoading: isBootLoading, isAuthenticated, requireAuth } = useAuth()
  const [state, setState] = useState<TrainingState>(() => getTrainingState())
  const [profileTick, setProfileTick] = useState(0)
  const [sportOpen, setSportOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dueBanner, setDueBanner] = useState<string | null>(null)
  const [cardioOpen, setCardioOpen] = useState(false)
  const [durationMin, setDurationMin] = useState(40)
  const [teamSessionType, setTeamSessionType] = useState<TeamSessionType>('training')
  const [teamMinutesPlayed, setTeamMinutesPlayed] = useState<number | null>(null)
  const [teamPosition, setTeamPosition] = useState('')
  const [restLogRequest, setRestLogRequest] = useState<{
    exerciseId: string
    setIndex: number
    restSec: number
    addNextSet: boolean
    nonce: number
  } | null>(null)

  const { start: startRestTimer, setReadyBarEnabled, isBarVisible, setChromeHidden } =
    useRestTimerContext()

  const [disciplineTick, setDisciplineTick] = useState(0)
  const [pumpCheckSession, setPumpCheckSession] = useState<VictorySessionStats | null>(null)
  const [panel, setPanel] = useState<TrainPanel>('hub')
  const [notebookLaunchId, setNotebookLaunchId] = useState<string | null>(null)
  const [notebookResume, setNotebookResume] = useState(false)
  const [notebookEditNote, setNotebookEditNote] = useState<WorkoutNote | null>(null)
  /** Séance libre : carnet vide → sélecteur premier exo. */
  const [notebookStartEmpty, setNotebookStartEmpty] = useState(false)
  const [summaryFilter, setSummaryFilter] = useState<SportSummaryFilter>('all')
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [clockTick, setClockTick] = useState(() => Date.now())
  /** Ignore le popstate déclenché par notre propre history.back() après soft-leave flèche. */
  const ignoringPopRef = useRef(false)
  const draftFlushRef = useRef<(() => void) | null>(null)
  const didAutoReopenRef = useRef(false)

  useEffect(() => {
    if (isBootLoading) return
    setState(getTrainingState())
    setProfileTick((n) => n + 1)
    setDisciplineTick((n) => n + 1)
  }, [isBootLoading])

  // Recalcule la journée locale si l’onglet reste ouvert après minuit.
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000)
    const onFocus = () => setNowTick(Date.now())
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Chronomètre séance — tick 1s si brouillon actif non en pause (hub ou notebook).
  useEffect(() => {
    const draft = state.activeWorkoutDraft
    if (!draft || draft.paused) return
    const id = window.setInterval(() => setClockTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [state.activeWorkoutDraft])

  const sessionClockLabel = useMemo(() => {
    const draft = state.activeWorkoutDraft
    if (!draft || notebookEditNote) return null
    return formatSessionClock(liveElapsedMs(draft, clockTick))
  }, [state.activeWorkoutDraft, clockTick, notebookEditNote])

  const sessionDurationMin = useMemo(() => {
    const draft = state.activeWorkoutDraft
    if (!draft || notebookEditNote) return null
    return resolvedDurationMin(draft, clockTick)
  }, [state.activeWorkoutDraft, clockTick, notebookEditNote])

  const profile = useMemo(() => getCalorieProfile(), [
    profileTick,
    state.stepsToday,
    state.completed,
    state.workoutNotes,
  ])
  const nutrition = useMemo(() => getNutritionTarget(profile), [profile])

  const stepsKcal = stepsToKcal(state.stepsToday, profile.weightKg)
  const workoutKcal = todayWorkoutKcal(state)

  const disciplineId = useMemo(() => getStoredDisciplineId(), [disciplineTick, state.primarySportId])
  const discipline = getDiscipline(disciplineId)
  const sport = state.primarySportId ? getSportById(state.primarySportId) : getSportById(discipline.primarySportId)
  const activeSportId = state.primarySportId ?? discipline.primarySportId
  const activeSessionKind = trainSessionKindForSport(activeSportId)
  const showStrengthTools = activeSessionKind === 'strength'
  const showEnduranceTools = activeSessionKind === 'endurance'
  const isTeamSheet = activeSessionKind === 'team'

  const now = useMemo(() => new Date(nowTick), [nowTick])
  const todayCard = useMemo(() => deriveTodayHubCard(state, now), [state, now])
  const weekStrip = useMemo(() => deriveWeekStrip(state.workoutNotes, now), [state.workoutNotes, now])
  const weeklySummary = useMemo(
    () => deriveWeeklySummary(state.workoutNotes, summaryFilter, now),
    [state.workoutNotes, summaryFilter, now],
  )
  const recentSessions = useMemo(
    () => deriveRecentSessions(state.workoutNotes, now, 2),
    [state.workoutNotes, now],
  )

  const resetCardioSheet = useCallback(() => {
    setDurationMin(40)
    const empty = emptyTeamSheetFields()
    setTeamSessionType(empty.sessionType)
    setTeamMinutesPlayed(empty.minutesPlayed)
    setTeamPosition(empty.position)
  }, [])

  const teamDetailsPreview = useMemo(() => {
    if (!isTeamSheet) return null
    return buildTeamDetails({
      sessionType: teamSessionType,
      durationMin,
      minutesPlayed: teamSessionType === 'match' ? teamMinutesPlayed : null,
      position: teamPosition,
    })
  }, [isTeamSheet, teamSessionType, durationMin, teamMinutesPlayed, teamPosition])

  const teamFieldsInvalid =
    isTeamSheet &&
    teamSessionType === 'match' &&
    teamMinutesPlayed != null &&
    teamDetailsPreview == null

  useEffect(() => {
    setReadyBarEnabled(showStrengthTools && panel === 'notebook' && !pumpCheckSession)
    return () => setReadyBarEnabled(false)
  }, [showStrengthTools, setReadyBarEnabled, pumpCheckSession, panel])

  /** Séance muscu live : masque header app + BottomNav (repos inline dans l’écran immersif). */
  const immersiveLiveSession =
    panel === 'notebook' &&
    showStrengthTools &&
    !notebookEditNote &&
    Boolean(state.activeWorkoutDraft)

  useEffect(() => {
    const hide = immersiveLiveSession || Boolean(pumpCheckSession)
    setChromeHidden(hide)
    return () => setChromeHidden(false)
  }, [immersiveLiveSession, pumpCheckSession, setChromeHidden])

  const openNotebook = useCallback((
    routineId?: string | null,
    editNote?: WorkoutNote | null,
    resume = false,
    startEmpty = false,
  ) => {
    if (!editNote) {
      setState(clearLastVoluntaryRoute())
      pushSessionHistory()
    }
    setNotebookLaunchId(routineId ?? editNote?.routineId ?? null)
    setNotebookEditNote(editNote ?? null)
    setNotebookResume(resume)
    setNotebookStartEmpty(startEmpty && !editNote && !resume)
    setPanel('notebook')
  }, [])

  /** Soft-leave : flush + flag volontaire + hub. Ne termine / reset rien. */
  const softLeaveToHub = useCallback((opts?: { viaHistory?: boolean }) => {
    draftFlushRef.current?.()
    const next = markVoluntaryLeaveToTrainHub()
    setState(next)
    setPanel('hub')
    setNotebookLaunchId(null)
    setNotebookEditNote(null)
    setNotebookResume(false)
    setNotebookStartEmpty(false)
    if (opts?.viaHistory) {
      replaceHubHistory()
      return
    }
    if (popSessionHistoryIfNeeded()) {
      ignoringPopRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!launchRoutineId || !showStrengthTools) return
    openNotebook(launchRoutineId)
    onLaunchConsumed?.()
  }, [launchRoutineId, showStrengthTools, onLaunchConsumed, openNotebook])

  /** Cold start / remount OS : rouvrir la séance sauf soft-leave volontaire. */
  useEffect(() => {
    if (isBootLoading || !showStrengthTools) return
    if (didAutoReopenRef.current) return
    const snap = getTrainingState()
    if (
      !shouldAutoReopenSession({
        hasActiveDraft: Boolean(snap.activeWorkoutDraft),
        lastVoluntaryRoute: snap.lastVoluntaryRoute,
      })
    ) {
      return
    }
    if (panel !== 'hub') return
    didAutoReopenRef.current = true
    const id = snap.activeWorkoutDraft!.routineId
    openNotebook(id, null, true)
    // Une fois au montage / restore — pas à chaque tick panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBootLoading, showStrengthTools])

  /** App revient au premier plan sans soft-leave → rouvrir si on est resté sur hub. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      const snap = getTrainingState()
      if (
        !shouldAutoReopenSession({
          hasActiveDraft: Boolean(snap.activeWorkoutDraft),
          lastVoluntaryRoute: snap.lastVoluntaryRoute,
        })
      ) {
        return
      }
      setPanel((current) => {
        if (current !== 'hub') return current
        const id = snap.activeWorkoutDraft!.routineId
        queueMicrotask(() => openNotebook(id, null, true))
        return current
      })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [openNotebook])

  /** Retour système / PWA / Android → même soft-leave que la flèche. */
  useEffect(() => {
    const onPop = () => {
      if (ignoringPopRef.current) {
        ignoringPopRef.current = false
        return
      }
      if (panel !== 'notebook' || notebookEditNote) return
      if (!state.activeWorkoutDraft) return
      softLeaveToHub({ viaHistory: true })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [panel, notebookEditNote, state.activeWorkoutDraft, softLeaveToHub])

  useEffect(() => {
    return subscribeRestLogged(({ target, restSec, skipped }) => {
      setRestLogRequest({
        exerciseId: target.exerciseId,
        setIndex: target.setIndex,
        restSec,
        addNextSet: skipped,
        nonce: Date.now(),
      })
    })
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const persist = (next: TrainingState) => {
    saveTrainingState(next)
    setState(next)
  }

  useEffect(() => {
    const stop = startReminderWatcher(
      () => getTrainingState().schedule,
      (due) => {
        setDueBanner(
          due.minutesLeft === 0
            ? `C’est l’heure : ${due.title} (${due.time})`
            : `${due.title} dans ${due.minutesLeft} min (${due.time})`,
        )
        window.setTimeout(() => setDueBanner(null), 12000)
      },
    )
    return stop
  }, [])

  useEffect(() => {
    const onRestored = () => setState(getTrainingState())
    const onBackupError = (ev: Event) => {
      const detail = (ev as CustomEvent<{ error?: string }>).detail
      const msg = detail?.error || 'Sauvegarde impossible'
      safeError('[Train] backup error', msg)
      showToast('Sauvegarde cloud impossible. Tes données locales sont conservées.')
    }
    const onPersistError = (ev: Event) => {
      const detail = (ev as CustomEvent<{ error?: string }>).detail
      const msg = detail?.error || 'Erreur de sauvegarde locale'
      safeError('[Train] persist error', msg)
      showToast(`Sauvegarde : ${msg}`)
    }
    window.addEventListener('ranked-gym:backup-restored', onRestored)
    window.addEventListener('ranked-gym:backup-error', onBackupError)
    window.addEventListener('ranked-gym:training-persist-error', onPersistError)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', onRestored)
      window.removeEventListener('ranked-gym:backup-error', onBackupError)
      window.removeEventListener('ranked-gym:training-persist-error', onPersistError)
    }
  }, [showToast])

  const persistDraft = useCallback(
    (routineId: string, exercises: TrainingState['routines'][number]['exercises']) => {
      const next = saveRoutineDraft(routineId, exercises, activeSportId)
      setState(next)
    },
    [activeSportId],
  )

  const openPumpCheck = useCallback((note: Parameters<typeof saveWorkoutNote>[0]) => {
    const priorNotes = getTrainingState().workoutNotes
    const prCount = countSessionPersonalRecords(note.exercises, priorNotes, note.id)
    const bodyWeightKg = getCalorieProfile().weightKg
    const liftStats = computeStrengthSessionStats(note.exercises, bodyWeightKg)
    setPumpCheckSession({
      title: deriveSessionDisplayTitle(note),
      volumeKg: note.totalVolumeKg ?? liftStats.volume,
      durationMin: note.durationMin ?? liftStats.durationMin,
      prCount,
    })
  }, [])

  const persistAndSyncNote = useCallback(
    async (note: Parameters<typeof saveWorkoutNote>[0]) => {
      const isNewSession = !note.id

      if (!isAuthenticated) {
        const local = saveWorkoutNote(note)
        setState(local)
        showToast(`${note.title} sauvé en local — connecte-toi pour sauvegarder`)
        if (isNewSession) openPumpCheck(note)
        requireAuth(() => undefined)
        return
      }

      try {
        const result = await saveAndSyncWorkoutSession(note)
        setState(result.state)
        if (result.ok) {
          if (!isNewSession) showToast('Séance mise à jour ✓')
          if (isNewSession) openPumpCheck(note)
        } else {
          safeError('[Train] session sync failed', result.error)
          showToast(result.error ?? 'Erreur de synchro')
          if (isNewSession) openPumpCheck(note)
        }
      } catch (error) {
        safeError('[Train] session save exception', error)
        showToast('Erreur de synchro')
      }
    },
    [isAuthenticated, openPumpCheck, requireAuth, showToast],
  )

  useEffect(() => {
    const syncProfile = () => setProfileTick((t) => t + 1)
    const syncDiscipline = () => {
      setDisciplineTick((t) => t + 1)
      setState(getTrainingState())
    }
    window.addEventListener('ranked-gym:profile-changed', syncProfile)
    window.addEventListener('ranked-gym:backup-restored', syncProfile)
    window.addEventListener('ranked-gym:discipline-changed', syncDiscipline)
    window.addEventListener('focus', syncProfile)
    return () => {
      window.removeEventListener('ranked-gym:profile-changed', syncProfile)
      window.removeEventListener('ranked-gym:backup-restored', syncProfile)
      window.removeEventListener('ranked-gym:discipline-changed', syncDiscipline)
      window.removeEventListener('focus', syncProfile)
    }
  }, [])

  const handleConnectHealth = async () => {
    const result = await connectHealthIntent()
    persist(setHealthLinked(true))
    showToast(result.message)
  }

  const applyDiscipline = (id: AppDisciplineId, sportId?: string) => {
    storeDisciplineId(id)
    const disc = getDiscipline(id)
    persist(setPrimarySport(sportId ?? disc.primarySportId))
    setDisciplineTick((t) => t + 1)
  }

  const applySport = (sportId: string) => {
    const selectedSport = getSportById(sportId)
    const nextDiscipline = selectedSport
      ? disciplineFromSportCategory(selectedSport.category, selectedSport.id)
      : 'fitness'
    applyDiscipline(nextDiscipline, sportId)
  }

  const confirmCardio = async () => {
    const kcalPerHour = sport?.kcalPerHour ?? 500
    const estimated = estimateSessionKcal(durationMin, kcalPerHour, profile.weightKg)
    const meta = manualSessionMeta(activeSportId, activeSessionKind)

    let details =
      activeSessionKind === 'team'
        ? buildTeamDetails({
            sessionType: teamSessionType,
            durationMin,
            minutesPlayed: teamSessionType === 'match' ? teamMinutesPlayed : null,
            position: teamPosition,
          })
        : undefined

    if (activeSessionKind === 'team' && details == null) {
      showToast('Minutes jouées invalides')
      return
    }

    const note = {
      title: sport?.name ?? 'Cardio',
      exercises: [
        {
          id: `cardio-${Date.now()}`,
          name: sport?.name ?? 'Cardio',
          sets: [{ reps: durationMin, weightKg: 0, difficulty: 'ok' as const }],
        },
      ],
      durationMin,
      estimatedKcal: estimated,
      ...meta,
      ...(details ? { details } : {}),
    }

    if (isAuthenticated) {
      const result = await saveAndSyncWorkoutSession(note)
      setState(result.state)
      if (!result.ok) {
        showToast(result.error ?? 'Erreur de synchro')
      }
    } else {
      persist(saveWorkoutNote(note))
    }

    setCardioOpen(false)
    resetCardioSheet()
    setPanel('hub')
    showToast(`${sport?.name ?? 'Séance'} · ~${estimated} kcal → Nutri`)
  }

  const handleTodayPrimary = () => {
    const cta = todayCard.cta
    if (cta === 'resume') {
      const id = launchableRoutineId(todayCard)
      if (!id) {
        showToast('Routine indisponible')
        return
      }
      applySport(todayCard.sportId ?? 'musculation')
      setState(ensureActiveWorkoutClock())
      openNotebook(id, null, cta === 'resume')
      return
    }
    if (cta === 'start') {
      if (!todayCard.sportId || !todayCard.sessionKind) {
        showToast('Sport planifié indisponible')
        return
      }
      applySport(todayCard.sportId)
      if (todayCard.openTarget === 'notebook') {
        const id = launchableRoutineId(todayCard)
        if (id) {
          const withRoutine = startRoutineDraft(id, todayCard.sportId)
          // Routine vide → séance libre (sélecteur premier exo).
          if (!withRoutine.activeWorkoutDraft) {
            setState(startFreeWorkoutSession(todayCard.sportId, id))
            openNotebook(id, null, false, true)
          } else {
            setState(withRoutine)
            openNotebook(id)
          }
        } else {
          setState(startFreeWorkoutSession(todayCard.sportId))
          openNotebook(null, null, false, true)
        }
      } else if (todayCard.openTarget === 'endurance') {
        setPanel('endurance')
      } else {
        setCardioOpen(true)
      }
      return
    }
    if (cta === 'open_train') {
      // Cible dérivée de la séance planifiée — pas du sport global courant.
      if (todayCard.openTarget === 'notebook') {
        applyDiscipline('musculation')
        setState(startFreeWorkoutSession('musculation'))
        openNotebook(null, null, false, true)
      } else {
        setActivityOpen(true)
      }
      return
    }
    setActivityOpen(true)
  }

  const handleQuickActivity = (id: QuickActivityId) => {
    if (id === 'musculation') {
      applyDiscipline('musculation')
      setState(startFreeWorkoutSession('musculation'))
      openNotebook(null, null, false, true)
      return
    }
    if (id === 'course') {
      applyDiscipline('course')
      setPanel('endurance')
      return
    }
    if (id === 'football') {
      applyDiscipline('football')
      setCardioOpen(true)
      return
    }
    setSportOpen(true)
  }

  const goHub = () => {
    if (panel === 'notebook' && state.activeWorkoutDraft && !notebookEditNote) {
      softLeaveToHub()
      return
    }
    setPanel('hub')
    setNotebookLaunchId(null)
  }

  const panelTitle: Record<Exclude<TrainPanel, 'hub'>, string> = {
    notebook: 'Carnet',
    endurance: 'Course / Endurance',
    agenda: 'Programmes',
    history: 'Historique',
    steps: 'Pas',
  }

  return (
    <div
      className={`train-view flex flex-col ${
        immersiveLiveSession ? 'gap-0' : panel === 'history' ? 'gap-2' : 'gap-6'
      }${panel === 'history' ? ' train-view--history' : ''}`}
      style={{
        paddingBottom: immersiveLiveSession ? 0 : 8,
      }}
    >
      {panel === 'hub' ? (
        <header className="relative ios-fade-up">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[34px] font-bold tracking-tight text-white">Train</h1>
            <button
              type="button"
              onClick={() => setPanel('agenda')}
              className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/35"
              aria-label="Programmes"
            >
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>
      ) : immersiveLiveSession ? null : (
        <header className="flex items-center gap-2 ios-fade-up">
          <button
            type="button"
            onClick={goHub}
            className="ios-press flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/35"
            aria-label="Retour à Train"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {panel !== 'history' ? (
            <h1 className="text-[22px] font-bold tracking-tight text-white">{panelTitle[panel]}</h1>
          ) : null}
        </header>
      )}

      {dueBanner && !immersiveLiveSession ? (
        <div className="rounded-2xl border border-[#FF2B2B]/40 bg-[#FF2B2B]/15 px-4 py-3 text-[14px] font-semibold text-white">
          {dueBanner}
        </div>
      ) : null}

      {panel === 'hub' ? (
        <>
          <TrainTodayCard card={todayCard} onPrimary={handleTodayPrimary} />

          <TrainWeekStrip days={weekStrip} />

          <TrainWeeklySummary
            summary={weeklySummary}
            filter={summaryFilter}
            onFilterChange={setSummaryFilter}
          />

          <TrainRecentSessions
            items={recentSessions}
            onOpen={(id) => {
              setFocusNoteId(id)
              setPanel('history')
            }}
            onSeeAll={() => setPanel('history')}
          />

          <nav aria-label="Accès Train" className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'notebook' as const, label: 'Carnet', icon: BookOpen },
                { id: 'agenda' as const, label: 'Programmes', icon: CalendarDays },
                { id: 'history' as const, label: 'Historique', icon: History },
                { id: 'steps' as const, label: 'Pas', icon: Footprints },
              ] as const
            ).map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'notebook') {
                      if (!showStrengthTools) applyDiscipline('musculation')
                      if (!state.activeWorkoutDraft) {
                        setState(startFreeWorkoutSession(activeSportId || 'musculation'))
                        openNotebook(null, null, false, true)
                      } else {
                        setState(ensureActiveWorkoutClock())
                        openNotebook(state.activeWorkoutDraft.routineId, null, true)
                      }
                      return
                    }
                    setPanel(item.id)
                  }}
                  className="ios-press flex min-h-11 items-center gap-2.5 rounded-2xl border border-white/10 bg-[#141416] px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/35"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[#FF6961]" aria-hidden="true" />
                  <span className="text-[14px] font-semibold text-white">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </>
      ) : null}

      {panel === 'notebook' ? (
        showStrengthTools ? (
          <WorkoutNotebook
            key={`notebook-${notebookLaunchId ?? 'boot'}-${notebookEditNote?.id ?? 'live'}-${activeSportId}-${notebookStartEmpty ? 'empty' : 'fill'}`}
            id="workout-notebook"
            bodyWeightKg={profile.weightKg}
            routines={state.routines}
            schedule={state.schedule}
            history={state.workoutNotes}
            initialRoutineId={notebookLaunchId}
            initialEditNote={notebookEditNote}
            resume={notebookResume}
            startEmpty={notebookStartEmpty}
            sportId={activeSportId}
            sessionKind="strength"
            restLogRequest={restLogRequest}
            sessionClockLabel={sessionClockLabel}
            sessionPaused={state.activeWorkoutDraft?.paused === true}
            sessionDurationMin={sessionDurationMin}
            onToggleSessionPause={() => {
              const next = setActiveWorkoutPaused(!(state.activeWorkoutDraft?.paused === true))
              setState(next)
              setClockTick(Date.now())
            }}
            onBack={softLeaveToHub}
            onRegisterDraftFlush={(flush) => {
              draftFlushRef.current = flush
            }}
            onRestStart={(info) => {
              startRestTimer(info.restSec ?? 90, info)
            }}
            onDraftSave={persistDraft}
            onSave={(note) => persistAndSyncNote(note)}
            onDeleteNote={(id) => {
              persist(removeWorkoutNote(id))
            }}
            onAddRoutine={(label) => {
              const next = addCustomRoutine(label)
              persist(next)
              showToast(`Focus « ${label} » créé`)
            }}
          />
        ) : (
          <section className="rounded-3xl border border-white/10 bg-[#141416] p-4">
            <p className="text-[14px] text-[#AEAEB2]">
              Passe en musculation pour ouvrir le carnet, ou choisis une autre activité.
            </p>
            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              className="btn-brand ios-press mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl py-3 text-[15px] font-semibold text-white"
            >
              Choisir une activité
            </button>
          </section>
        )
      ) : null}

      {panel === 'endurance' ? (
        showEnduranceTools ? (
          <EnduranceSessionCard
            disciplineId={disciplineId}
            bodyWeightKg={profile.weightKg}
            onLog={(entry) => {
              const meta = manualSessionMeta(activeSportId, 'endurance')
              const details = buildEnduranceDetails(entry.distanceKm)
              persist(
                saveWorkoutNote({
                  title: entry.title,
                  exercises: [
                    {
                      id: `endurance-${Date.now()}`,
                      name: `${entry.distanceKm} km`,
                      sets: [
                        {
                          reps: entry.durationMin,
                          weightKg: 0,
                          difficulty: 'ok',
                        },
                      ],
                    },
                  ],
                  durationMin: entry.durationMin,
                  estimatedKcal: entry.estimatedKcal,
                  ...meta,
                  ...(details ? { details } : {}),
                }),
              )
              showToast(`${entry.title} · ~${entry.estimatedKcal} kcal → Nutri`)
              setPanel('hub')
            }}
          />
        ) : (
          <section className="rounded-3xl border border-white/10 bg-[#141416] p-4">
            <p className="text-[14px] text-[#AEAEB2]">Active Course / Endurance pour noter une sortie.</p>
            <button
              type="button"
              onClick={() => {
                applyDiscipline('course')
              }}
              className="btn-brand ios-press mt-3 w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
            >
              Mode Course
            </button>
          </section>
        )
      ) : null}

      {panel === 'agenda' ? (
        <TrainingAgenda
          schedule={state.schedule}
          routines={state.routines}
          primarySportId={activeSportId}
          notificationsEnabled={state.notificationsEnabled}
          onSave={(entry) => persist(upsertSchedule(entry))}
          onRemove={(id) => persist(removeSchedule(id))}
          onNotificationsChange={(enabled) => persist(setNotificationsEnabled(enabled))}
          onToast={showToast}
        />
      ) : null}

      {panel === 'history' ? (
        <WorkoutHistory
          notes={state.workoutNotes}
          focusNoteId={focusNoteId}
          onFocusConsumed={() => setFocusNoteId(null)}
          onDelete={(id) => {
            persist(removeWorkoutNote(id))
          }}
          onEdit={(note) => {
            applyDiscipline('musculation')
            openNotebook(note.routineId ?? null, note)
          }}
          canEdit={(note) => resolveSessionKind(note) === 'strength'}
        />
      ) : null}

      {panel === 'steps' ? (
        <StepsCard
          steps={state.stepsToday}
          burnedKcal={stepsKcal + workoutKcal}
          goalLabel={nutrition.goalLabel}
          healthLinked={state.healthLinked}
          onStepsChange={(steps) => persist(setStepsToday(steps))}
          onConnectHealth={() => {
            void handleConnectHealth()
          }}
        />
      ) : null}

      <TrainActivitySheet
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        onSelect={handleQuickActivity}
      />

      <SportPicker
        open={sportOpen}
        selectedId={state.primarySportId}
        onClose={() => setSportOpen(false)}
        onSelect={(s) => {
          const nextDisc = disciplineFromSportCategory(s.category, s.id)
          applySport(s.id)
          showToast(`${s.name} · mode ${getDiscipline(nextDisc).shortLabel}`)

          const kind = trainSessionKindForSport(s.id)
          if (kind === 'strength') {
            setState(startFreeWorkoutSession(s.id))
            openNotebook(null, null, false, true)
          } else if (kind === 'endurance') {
            setPanel('endurance')
          } else {
            setCardioOpen(true)
          }
        }}
      />

      <IosSheet
        open={cardioOpen}
        onClose={() => {
          setCardioOpen(false)
          resetCardioSheet()
        }}
        title={sport?.name ?? 'Séance'}
        subtitle={isTeamSheet ? 'Entraînement ou match' : 'Durée de la séance'}
      >
        <div className="space-y-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {[20, 30, 40, 45, 60, 75, 90].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMin(m)}
                className={`min-h-11 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                  durationMin === m
                    ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-[#FF6961]'
                    : 'border-white/10 text-[#8E8E93]'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>

          {isTeamSheet ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
                  Type de séance
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'training' as const, label: 'Entraînement' },
                      { id: 'match' as const, label: 'Match' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setTeamSessionType(opt.id)
                        if (opt.id !== 'match') setTeamMinutesPlayed(null)
                      }}
                      className={`min-h-11 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                        teamSessionType === opt.id
                          ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-[#FF6961]'
                          : 'border-white/10 text-[#8E8E93]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {teamSessionType === 'match' ? (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
                    Minutes jouées (facultatif)
                  </span>
                  <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
                    <ClearableNumberInput
                      value={teamMinutesPlayed}
                      onChange={setTeamMinutesPlayed}
                      min={1}
                      max={durationMin}
                      step={1}
                      required={false}
                      aria-label="Minutes jouées"
                      className="w-full bg-transparent text-[22px] font-bold text-white outline-none"
                    />
                  </div>
                  {teamFieldsInvalid ? (
                    <p className="mt-1 text-[11px] text-[#FF453A]">
                      Doit être entre 1 et {durationMin} min.
                    </p>
                  ) : null}
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
                  Poste (facultatif)
                </span>
                <input
                  type="text"
                  value={teamPosition}
                  onChange={(e) => setTeamPosition(e.target.value)}
                  placeholder="Ex. milieu, ailier…"
                  className="min-h-11 w-full rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-[15px] text-white outline-none placeholder:text-[#636366]"
                />
              </label>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void confirmCardio()}
            disabled={teamFieldsInvalid}
            className="btn-brand ios-press min-h-11 w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            Valider
          </button>
        </div>
      </IosSheet>

      {toast && (
        <div
          className="pointer-events-none fixed left-1/2 z-[70] max-w-[90%] -translate-x-1/2 rounded-full border border-white/10 bg-[#2C2C2E] px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg"
          style={{
            bottom: isBarVisible
              ? 'calc(var(--rest-bar-bottom) + var(--rest-island-h) + 12px)'
              : 'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 12px)',
          }}
        >
          {toast}
        </div>
      )}

      {pumpCheckSession ? (
        <VictoryCamera
          stats={pumpCheckSession}
          onComplete={() => {
            setPumpCheckSession(null)
            onGoToLobby?.()
          }}
        />
      ) : null}
    </div>
  )
}
