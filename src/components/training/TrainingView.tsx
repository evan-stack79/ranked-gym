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
import { IconBadge } from '../ui/IconBadge'
import { IosSheet } from '../ui/IosSheet'

export function TrainingView() {
  const [state, setState] = useState<TrainingState>(() => getTrainingState())
  const [sportOpen, setSportOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dueBanner, setDueBanner] = useState<string | null>(null)
  const [cardioOpen, setCardioOpen] = useState(false)
  const [durationMin, setDurationMin] = useState(40)

  const profile = useMemo(
    () => getCalorieProfile(),
    [state.stepsToday, state.completed, state.workoutNotes],
  )
  const plan = useMemo(() => computeCaloriePlan(profile), [profile])

  const stepsKcal = stepsToKcal(state.stepsToday, profile.weightKg)
  const workoutKcal = todayWorkoutKcal(state)
  const adjusted = applyActivityToTarget(
    plan.targetCalories,
    plan.goal,
    stepsKcal + workoutKcal,
  )

  const sport = state.primarySportId ? getSportById(state.primarySportId) : null
  const isStrength =
    !sport ||
    sport.category === 'strength' ||
    sport.id === 'crossfit' ||
    sport.id === 'fitness'

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
        estimatedKcal: estimated,
      }),
    )
    setCardioOpen(false)
    showToast(`${sport?.name ?? 'Séance'} · ~${estimated} kcal → Nutri`)
  }

  return (
    <div className="flex flex-col gap-8 pb-4">
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
            Carnet, rappels, pas — Nutri suit tout seul.
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

      {isStrength ? (
        <WorkoutNotebook
          bodyWeightKg={profile.weightKg}
          history={state.workoutNotes}
          onSave={(note) => {
            persist(saveWorkoutNote(note))
            showToast(`Séance sauvée · ~${note.estimatedKcal} kcal → Nutri`)
          }}
          onDeleteNote={(id) => {
            persist(removeWorkoutNote(id))
          }}
        />
      ) : (
        <section className="glass-card rounded-3xl p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            {sport?.name}
          </p>
          <h2 className="mt-1 text-[18px] font-bold text-white">Noter la séance</h2>
          <p className="mt-1 text-[12px] text-[#AEAEB2]">
            Entre tes pas, puis valide la durée pour recalculer Nutri.
          </p>
          <button
            type="button"
            onClick={() => setCardioOpen(true)}
            className="btn-brand ios-press mt-3 w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
          >
            Noter {sport?.name}
          </button>
        </section>
      )}

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
          persist(setPrimarySport(s.id))
          showToast(`${s.name} sélectionné`)
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
    </div>
  )
}
