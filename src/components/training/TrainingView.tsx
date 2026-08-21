import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Dumbbell, Flame } from 'lucide-react'
import type { TrainingState } from '../../types/training'
import { getSportById } from '../../data/sports'
import {
  getTrainingState,
  removeSchedule,
  removeWorkoutNote,
  saveTrainingState,
  saveWorkoutNote,
  addCustomRoutine,
  setHealthLinked,
  setNotificationsEnabled,
  setPrimarySport,
  setStepsToday,
  todayWorkoutKcal,
  upsertSchedule,
} from '../../services/trainingStorage'
import { connectHealthIntent } from '../../services/healthSteps'
import { startReminderWatcher } from '../../services/reminderService'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { computeCaloriePlan, GOAL_LABELS } from '../../utils/calories'
import {
  applyActivityToTarget,
  estimateSessionKcal,
  stepsToKcal,
} from '../../utils/activityCalories'
import { SportPicker, SportChip } from './SportPicker'
import { StepsCard } from './StepsCard'
import { TrainingAgenda } from './TrainingAgenda'
import { WorkoutNotebook } from './WorkoutNotebook'
import { OverloadCalculator } from './OverloadCalculator'
import { EnduranceSessionCard } from './EnduranceSessionCard'
import { RestTimerOverlay, REST_BAR_CONTENT_PAD } from './RestTimerOverlay'
import { IconBadge } from '../ui/IconBadge'
import { IosSheet } from '../ui/IosSheet'
import {
  disciplineFromSportCategory,
  getDiscipline,
  getStoredDisciplineId,
  isEnduranceFamily,
  isStrengthFamily,
  storeDisciplineId,
} from '../../data/disciplines'
import { useAuth } from '../../context/AuthContext'
import { useRestTimer, type RestPresetSec } from '../../hooks/useRestTimer'

export function TrainingView() {
  const { isLoading: isBootLoading } = useAuth()
  const [state, setState] = useState<TrainingState>(() => getTrainingState())
  const [profileTick, setProfileTick] = useState(0)
  const [sportOpen, setSportOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dueBanner, setDueBanner] = useState<string | null>(null)
  const [cardioOpen, setCardioOpen] = useState(false)
  const [durationMin, setDurationMin] = useState(40)
  const [restLogRequest, setRestLogRequest] = useState<{
    exerciseId: string
    setIndex: number
    restSec: number
    addNextSet: boolean
    nonce: number
  } | null>(null)

  const restTimer = useRestTimer({
    onRestLogged: ({ target, restSec, skipped }) => {
      setRestLogRequest({
        exerciseId: target.exerciseId,
        setIndex: target.setIndex,
        restSec,
        addNextSet: skipped,
        nonce: Date.now(),
      })
    },
  })

  const [disciplineTick, setDisciplineTick] = useState(0)

  useEffect(() => {
    if (isBootLoading) return
    setState(getTrainingState())
    setProfileTick((n) => n + 1)
    setDisciplineTick((n) => n + 1)
  }, [isBootLoading])

  const profile = useMemo(() => getCalorieProfile(), [
    profileTick,
    state.stepsToday,
    state.completed,
    state.workoutNotes,
  ])
  const plan = useMemo(() => computeCaloriePlan(profile), [profile])

  const stepsKcal = stepsToKcal(state.stepsToday, profile.weightKg)
  const workoutKcal = todayWorkoutKcal(state)
  const adjusted = applyActivityToTarget(
    plan.targetCalories,
    plan.goal,
    stepsKcal + workoutKcal,
  )

  const disciplineId = useMemo(() => getStoredDisciplineId(), [disciplineTick, state.primarySportId])
  const discipline = getDiscipline(disciplineId)
  const sport = state.primarySportId ? getSportById(state.primarySportId) : getSportById(discipline.primarySportId)
  const showStrengthTools = isStrengthFamily(disciplineId)
  const showEnduranceTools = isEnduranceFamily(disciplineId)

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
    window.addEventListener('ranked-gym:backup-restored', onRestored)
    return () => window.removeEventListener('ranked-gym:backup-restored', onRestored)
  }, [])

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

  const confirmCardio = () => {
    const kcalPerHour = sport?.kcalPerHour ?? 500
    const estimated = estimateSessionKcal(durationMin, kcalPerHour, profile.weightKg)
    persist(
      saveWorkoutNote({
        title: sport?.name ?? 'Cardio',
        exercises: [
          {
            id: `cardio-${Date.now()}`,
            name: sport?.name ?? 'Cardio',
            sets: [{ reps: durationMin, weightKg: 0, difficulty: 'ok' }],
          },
        ],
        durationMin,
        estimatedKcal: estimated,
      }),
    )
    setCardioOpen(false)
    showToast(`${sport?.name ?? 'Séance'} · ~${estimated} kcal → Nutri`)
  }

  return (
    <div
      className="flex flex-col gap-8"
      style={{
        // Nav (AppLayout) + îlot repos sticky — dernier élément scrollable au-dessus
        paddingBottom: showStrengthTools
          ? `calc(${REST_BAR_CONTENT_PAD} + 0.5rem)`
          : '1rem',
      }}
    >
      <header className="relative ios-fade-up">
        <div
          className="pointer-events-none absolute -right-6 -top-4 h-28 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #FF2B2B44 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <IconBadge icon={Dumbbell} variant="crimson" size="sm" />
            <span className="rounded-full border border-[#FF2B2B]/30 bg-[#FF2B2B]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF6961]">
              Train
            </span>
          </div>
          <h1 className="text-[34px] font-bold tracking-tight text-white">Entraînement</h1>
          <p className="mt-2 text-[17px] text-[#8E8E93]">
            Mode {discipline.shortLabel} — carnet, rappels, énergie.
          </p>
        </div>
      </header>

      {dueBanner && (
        <div className="rounded-2xl border border-[#FF2B2B]/40 bg-[#FF2B2B]/15 px-4 py-3 text-[14px] font-semibold text-white">
          {dueBanner}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSportOpen(true)}
        className="ios-press glass-card flex w-full items-center gap-3 rounded-3xl p-4 text-left"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF2B2B]/15 text-[#FF6961]">
          <Flame className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#8E8E93]">Mon sport principal</p>
          <p className="truncate text-[18px] font-bold text-white">
            <SportChip sportId={state.primarySportId} />
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-[#636366]" />
      </button>

      <StepsCard
        steps={state.stepsToday}
        burnedKcal={stepsKcal + workoutKcal}
        bonusKcal={adjusted.activityBonus}
        goalLabel={GOAL_LABELS[plan.goal]}
        healthLinked={state.healthLinked}
        onStepsChange={(steps) => persist(setStepsToday(steps))}
        onConnectHealth={() => {
          void handleConnectHealth()
        }}
      />

      {showStrengthTools && (
        <OverloadCalculator bodyWeightKg={profile.weightKg} goalLabel={GOAL_LABELS[plan.goal]} />
      )}

      {showEnduranceTools && (
        <EnduranceSessionCard
          disciplineId={disciplineId}
          bodyWeightKg={profile.weightKg}
          onLog={(entry) => {
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
              }),
            )
            showToast(`${entry.title} · ~${entry.estimatedKcal} kcal → Nutri`)
          }}
        />
      )}

      {showStrengthTools ? (
        <WorkoutNotebook
          bodyWeightKg={profile.weightKg}
          routines={state.routines}
          history={state.workoutNotes}
          restLogRequest={restLogRequest}
          onRestStart={(info) => {
            restTimer.start(90, info)
          }}
          onSave={(note) => {
            persist(saveWorkoutNote(note))
            showToast(`${note.title} sauvegardé · prochaines fois on le recharge`)
          }}
          onDeleteNote={(id) => {
            persist(removeWorkoutNote(id))
          }}
          onAddRoutine={(label) => {
            const next = addCustomRoutine(label)
            persist(next)
            showToast(`Focus « ${label} » créé`)
          }}
        />
      ) : !showEnduranceTools ? (
        <section className="glass-card rounded-3xl p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            {sport?.name ?? discipline.label}
          </p>
          <h2 className="mt-1 text-[18px] font-bold text-white">Noter la séance</h2>
          <p className="mt-1 text-[12px] text-[#AEAEB2]">
            Valide la durée pour recalculer Nutri selon ton sport.
          </p>
          <button
            type="button"
            onClick={() => setCardioOpen(true)}
            className="btn-brand ios-press mt-3 w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
          >
            Noter {sport?.name ?? discipline.shortLabel}
          </button>
        </section>
      ) : null}

      <TrainingAgenda
        schedule={state.schedule}
        notificationsEnabled={state.notificationsEnabled}
        onSave={(entry) => persist(upsertSchedule(entry))}
        onRemove={(id) => persist(removeSchedule(id))}
        onNotificationsChange={(enabled) => persist(setNotificationsEnabled(enabled))}
        onToast={showToast}
      />

      <SportPicker
        open={sportOpen}
        selectedId={state.primarySportId}
        onClose={() => setSportOpen(false)}
        onSelect={(s) => {
          const nextDisc = disciplineFromSportCategory(s.category, s.id)
          storeDisciplineId(nextDisc)
          persist(setPrimarySport(s.id))
          setDisciplineTick((t) => t + 1)
          showToast(`${s.name} · mode ${getDiscipline(nextDisc).shortLabel}`)
        }}
      />

      <IosSheet
        open={cardioOpen}
        onClose={() => setCardioOpen(false)}
        title={sport?.name ?? 'Séance'}
        subtitle="Durée → calories Nutri"
      >
        <div className="space-y-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {[20, 30, 40, 45, 60, 75, 90].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMin(m)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                  durationMin === m
                    ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/20 text-[#FF6961]'
                    : 'border-white/10 text-[#8E8E93]'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={confirmCardio}
            className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
          >
            Valider
          </button>
        </div>
      </IosSheet>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 max-w-[90%] -translate-x-1/2 rounded-full border border-white/10 bg-[#2C2C2E] px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <RestTimerOverlay
        alwaysVisible={showStrengthTools}
        state={restTimer.state}
        onPreset={(sec: RestPresetSec) => {
          const target = restTimer.state.target ?? {
            exerciseId: 'quick-rest',
            setIndex: 0,
            exerciseName: 'Repos libre',
            setLabel: `${sec}s`,
          }
          restTimer.start(sec, {
            ...target,
            setLabel: target.exerciseId === 'quick-rest' ? `${sec}s` : target.setLabel,
          })
        }}
        onSkip={restTimer.skip}
        onDismiss={restTimer.dismiss}
      />
    </div>
  )
}
