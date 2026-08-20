import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Dumbbell, Flame } from 'lucide-react'
import type { SessionTemplate, TrainingState } from '../../types/training'
import { getSportById } from '../../data/sports'
import {
  addCustomTemplate,
  getTrainingState,
  logCompletedSession,
  removeSchedule,
  saveTrainingState,
  setHealthLinked,
  setPrimarySport,
  setStepsToday,
  todayWorkoutKcal,
  upsertSchedule,
} from '../../services/trainingStorage'
import { connectHealthIntent, checkUpcomingReminders } from '../../services/healthSteps'
import { getCalorieProfile } from '../../services/nutritionStorage'
import { computeCaloriePlan, GOAL_LABELS } from '../../utils/calories'
import {
  applyActivityToTarget,
  estimateSessionKcal,
  stepsToKcal,
} from '../../utils/activityCalories'
import { SportPicker, SportChip } from './SportPicker'
import { StepsCard } from './StepsCard'
import { SessionBoard } from './SessionBoard'
import { TrainingAgenda } from './TrainingAgenda'
import { IconBadge } from '../ui/IconBadge'
import { IosSheet } from '../ui/IosSheet'

export function TrainingView() {
  const [state, setState] = useState<TrainingState>(() => getTrainingState())
  const [sportOpen, setSportOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<SessionTemplate | null>(null)
  const [durationMin, setDurationMin] = useState(60)

  const profile = useMemo(() => getCalorieProfile(), [state.stepsToday, state.completed])
  const plan = useMemo(() => computeCaloriePlan(profile), [profile])

  const stepsKcal = stepsToKcal(state.stepsToday, profile.weightKg)
  const workoutKcal = todayWorkoutKcal(state)
  const adjusted = applyActivityToTarget(
    plan.targetCalories,
    plan.goal,
    stepsKcal + workoutKcal,
  )

  const sport = state.primarySportId ? getSportById(state.primarySportId) : null

  useEffect(() => {
    checkUpcomingReminders(state.schedule)
  }, [state.schedule])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const persist = (next: TrainingState) => {
    saveTrainingState(next)
    setState(next)
  }

  const handleConnectHealth = async () => {
    const result = await connectHealthIntent()
    persist(setHealthLinked(true))
    showToast(result.message)
  }

  const handleStartSession = (tpl: SessionTemplate) => {
    setActiveSession(tpl)
    setDurationMin(sport?.id === 'course-a-pied' ? 40 : 60)
  }

  const confirmSession = () => {
    if (!activeSession) return
    const kcalPerHour = sport?.kcalPerHour ?? 400
    const estimated = estimateSessionKcal(durationMin, kcalPerHour, profile.weightKg)
    const next = logCompletedSession({
      templateId: activeSession.id,
      title: activeSession.title,
      durationMin,
      estimatedKcal: estimated,
    })
    persist(next)
    setActiveSession(null)
    showToast(`${activeSession.title} notée · ~${estimated} kcal · Nutri mis à jour`)
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
            Sport, séances, pas — et Nutri suit automatiquement.
          </p>
        </div>
      </header>

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

      {!state.primarySportId || sport?.category === 'strength' || sport?.id === 'crossfit' ? (
        <SessionBoard
          templates={state.templates}
          onStart={handleStartSession}
          onAddCustom={(title, muscles) => {
            persist(addCustomTemplate({ title, muscles }))
            showToast('Séance ajoutée')
          }}
        />
      ) : (
        <section className="glass-card rounded-3xl p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Séance {sport?.name}
          </p>
          <h2 className="mt-1 text-[18px] font-bold text-white">Noter l’effort du jour</h2>
          <p className="mt-1 text-[12px] text-[#AEAEB2]">
            Entre tes pas ci-dessus, puis lance une séance type pour recalculer Nutri.
          </p>
          <button
            type="button"
            onClick={() =>
              handleStartSession({
                id: `sport-${sport?.id ?? 'run'}`,
                kind: 'custom',
                title: sport?.name ?? 'Séance',
                subtitle: 'Session',
                muscles: [sport?.name ?? 'Cardio'],
                accent: '#00B4FF',
              })
            }
            className="btn-brand ios-press mt-3 w-full rounded-2xl py-3 text-[15px] font-semibold text-white"
          >
            Noter une séance {sport?.name}
          </button>
        </section>
      )}

      <TrainingAgenda
        schedule={state.schedule}
        templates={state.templates}
        onSave={(entry) => persist(upsertSchedule(entry))}
        onRemove={(id) => persist(removeSchedule(id))}
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
        open={activeSession != null}
        onClose={() => setActiveSession(null)}
        title={activeSession?.title ?? 'Séance'}
        subtitle="Durée ≈ calories → Nutri"
      >
        {activeSession && (
          <div className="space-y-4 pb-2">
            <p className="text-[13px] text-[#AEAEB2]">{activeSession.muscles.join(' · ')}</p>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                Durée (min)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[30, 45, 60, 75, 90].map((m) => (
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
            </label>
            <p className="text-[12px] text-[#8E8E93]">
              Estimation ~{' '}
              {estimateSessionKcal(
                durationMin,
                sport?.kcalPerHour ?? 400,
                profile.weightKg,
              )}{' '}
              kcal — rééquilibrage selon ton objectif ({GOAL_LABELS[plan.goal]}).
            </p>
            <button
              type="button"
              onClick={confirmSession}
              className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
            >
              Valider la séance
            </button>
          </div>
        )}
      </IosSheet>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 max-w-[90%] -translate-x-1/2 rounded-full border border-white/10 bg-[#2C2C2E] px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
