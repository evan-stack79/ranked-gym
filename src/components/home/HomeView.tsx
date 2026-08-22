import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useHomeAreaName } from '../../hooks/useHomeAreaName'
import {
  getLocalGhostModeEnabled,
  resolveGhostModeEnabled,
  setLocalGhostModeEnabled,
} from '../../services/ghostModeStorage'
import { getTrainingState } from '../../services/trainingStorage'
import { getHomeGreeting, resolveDisplayFirstName } from '../../utils/homeGreeting'
import { getTodayWorkout } from '../../utils/todayWorkout'
import { DailyStreak } from './DailyStreak'
import { TodayWorkoutCard } from './TodayWorkoutCard'
import { NutritionSnapshot } from './NutritionSnapshot'
import { LocalActivityFeed } from './LocalActivityFeed'

interface HomeViewProps {
  onStartTraining: (routineId: string) => void
}

export function HomeView({ onStartTraining }: HomeViewProps) {
  const { user, profile, updateGhostMode, isAuthenticated } = useAuth()
  const [trainingTick, setTrainingTick] = useState(0)
  const [ghostTick, setGhostTick] = useState(0)
  const [ghostSaving, setGhostSaving] = useState(false)
  const { areaName, loading: areaLoading } = useHomeAreaName()

  useEffect(() => {
    const syncTraining = () => setTrainingTick((n) => n + 1)
    const syncGhost = () => setGhostTick((n) => n + 1)

    window.addEventListener('ranked-gym:backup-restored', syncTraining)
    window.addEventListener('ranked-gym:discipline-changed', syncTraining)
    window.addEventListener('ranked-gym:ghost-mode-changed', syncGhost)
    window.addEventListener('ranked-gym:profile-changed', syncGhost)
    window.addEventListener('focus', () => {
      syncTraining()
      syncGhost()
    })

    return () => {
      window.removeEventListener('ranked-gym:backup-restored', syncTraining)
      window.removeEventListener('ranked-gym:discipline-changed', syncTraining)
      window.removeEventListener('ranked-gym:ghost-mode-changed', syncGhost)
      window.removeEventListener('ranked-gym:profile-changed', syncGhost)
    }
  }, [])

  const firstName = resolveDisplayFirstName({
    firstName: user?.firstName,
    displayName: user?.displayName,
    pseudo: profile?.pseudo,
  })
  const greeting = getHomeGreeting(firstName)

  const ghostModeEnabled = useMemo(() => {
    void ghostTick
    return isAuthenticated ? resolveGhostModeEnabled(profile) : getLocalGhostModeEnabled()
  }, [ghostTick, isAuthenticated, profile])

  const feedViewer = useMemo(() => {
    const username = profile?.pseudo || user?.displayName || firstName
    if (!username || username === 'Champion') return null
    return {
      username,
      isGhostModeEnabled: ghostModeEnabled,
    }
  }, [profile?.pseudo, user?.displayName, firstName, ghostModeEnabled])

  const todayWorkout = useMemo(
    () => getTodayWorkout(getTrainingState()),
    [trainingTick],
  )

  const handleGhostModeChange = async (enabled: boolean) => {
    setGhostSaving(true)
    try {
      if (isAuthenticated) {
        await updateGhostMode(enabled)
      } else {
        setLocalGhostModeEnabled(enabled)
        window.dispatchEvent(new Event('ranked-gym:ghost-mode-changed'))
      }
    } finally {
      setGhostSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight text-white">
          {greeting}
        </h1>
      </header>

      <DailyStreak />

      <TodayWorkoutCard
        workout={todayWorkout}
        onStart={() => onStartTraining(todayWorkout.routineId)}
      />

      <NutritionSnapshot />

      <LocalActivityFeed
        areaName={areaName}
        loading={areaLoading}
        viewer={feedViewer}
        ghostModeEnabled={ghostModeEnabled}
        onGhostModeChange={handleGhostModeChange}
        ghostModeSaving={ghostSaving}
      />
    </div>
  )
}
