import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTrainingState } from '../../services/trainingStorage'
import { getHomeGreeting, resolveDisplayFirstName } from '../../utils/homeGreeting'
import { resolveHomeAreaName } from '../../utils/homeLocation'
import { getTodayWorkout } from '../../utils/todayWorkout'
import { DailyStreak } from './DailyStreak'
import { TodayWorkoutCard } from './TodayWorkoutCard'
import { NutritionSnapshot } from './NutritionSnapshot'
import { LocalActivityFeed } from './LocalActivityFeed'

interface HomeViewProps {
  onStartTraining: (routineId: string) => void
}

export function HomeView({ onStartTraining }: HomeViewProps) {
  const { user, profile } = useAuth()
  const [trainingTick, setTrainingTick] = useState(0)
  const [areaName, setAreaName] = useState(() => resolveHomeAreaName())

  useEffect(() => {
    const syncTraining = () => setTrainingTick((n) => n + 1)
    const syncArea = () => setAreaName(resolveHomeAreaName())

    window.addEventListener('ranked-gym:backup-restored', syncTraining)
    window.addEventListener('ranked-gym:discipline-changed', syncTraining)
    window.addEventListener('focus', () => {
      syncTraining()
      syncArea()
    })

    return () => {
      window.removeEventListener('ranked-gym:backup-restored', syncTraining)
      window.removeEventListener('ranked-gym:discipline-changed', syncTraining)
    }
  }, [])

  const firstName = resolveDisplayFirstName(profile?.pseudo, user?.displayName)
  const greeting = getHomeGreeting(firstName)

  const todayWorkout = useMemo(
    () => getTodayWorkout(getTrainingState()),
    [trainingTick],
  )

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white">
          {greeting}
        </h1>
      </header>

      <DailyStreak />

      <TodayWorkoutCard
        workout={todayWorkout}
        onStart={() => onStartTraining(todayWorkout.routineId)}
      />

      <NutritionSnapshot />

      <LocalActivityFeed areaName={areaName} />
    </div>
  )
}
