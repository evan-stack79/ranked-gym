import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTrainingState } from '../../services/trainingStorage'
import { getHomeGreeting, resolveDisplayFirstName } from '../../utils/homeGreeting'
import { getTodayWorkout } from '../../utils/todayWorkout'
import { DailyStreak } from './DailyStreak'
import { TodayWorkoutCard } from './TodayWorkoutCard'
import { NutritionSnapshot } from './NutritionSnapshot'
import { SleepSnapshot } from './SleepSnapshot'

interface HomeViewProps {
  onStartTraining: (routineId: string) => void
  onOpenTraining: () => void
  onOpenNutrition: () => void
}

/**
 * Accueil = dashboard quotidien.
 * Ordre : Nutrition (calories + eau) → Séance → Sommeil → Série → Alertes (si besoin).
 * Ghost mode / Lobby / feed social : hors nav principale (infra conservée).
 */
export function HomeView({ onStartTraining, onOpenTraining, onOpenNutrition }: HomeViewProps) {
  const { user, profile } = useAuth()
  const [trainingTick, setTrainingTick] = useState(0)

  useEffect(() => {
    const syncTraining = () => setTrainingTick((n) => n + 1)

    window.addEventListener('ranked-gym:backup-restored', syncTraining)
    window.addEventListener('ranked-gym:discipline-changed', syncTraining)
    window.addEventListener('ranked-gym:training-changed', syncTraining)
    window.addEventListener('focus', syncTraining)

    return () => {
      window.removeEventListener('ranked-gym:backup-restored', syncTraining)
      window.removeEventListener('ranked-gym:discipline-changed', syncTraining)
      window.removeEventListener('ranked-gym:training-changed', syncTraining)
      window.removeEventListener('focus', syncTraining)
    }
  }, [])

  const firstName = resolveDisplayFirstName({
    firstName: user?.firstName,
    displayName: user?.displayName,
    pseudo: profile?.pseudo,
  })
  const greeting = getHomeGreeting(firstName)

  const todayWorkout = useMemo(
    () => getTodayWorkout(getTrainingState()),
    [trainingTick],
  )

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight text-white">
          {greeting}
        </h1>
      </header>

      <NutritionSnapshot onOpenNutrition={onOpenNutrition} />

      <TodayWorkoutCard
        workout={todayWorkout}
        onStart={() => {
          if (todayWorkout?.canStart) onStartTraining(todayWorkout.routineId)
        }}
        onOpenNotebook={onOpenTraining}
      />

      <SleepSnapshot />

      <DailyStreak />

      {/* Alertes : uniquement si un signal produit le justifie (aucune alerte permanente). */}
    </div>
  )
}
