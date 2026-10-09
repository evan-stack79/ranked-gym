import { useEffect, useMemo, useState } from 'react'
import { isAccueilGalleryEnabled } from '../../backend/accueilGalleryFeatureFlag'
import { useAuth } from '../../context/AuthContext'
import { getTrainingState } from '../../services/trainingStorage'
import {
  getHomeGreetingSubtitle,
  resolveDisplayFirstName,
} from '../../utils/homeGreeting'
import { getTodayWorkout } from '../../utils/todayWorkout'
import { BlurInText, Reveal, SoftBlurIn, TextFlip } from '../motion'
import { DailyStreak } from './DailyStreak'
import { HomeGalleryView } from './HomeGalleryView'
import { TodayWorkoutCard } from './TodayWorkoutCard'
import { NutritionSnapshot } from './NutritionSnapshot'
import { SleepSnapshot } from './SleepSnapshot'
import { markWaveEnterSeen, shouldPlayWaveEnter } from '../../utils/waveEnterOnce'

interface HomeViewProps {
  onStartTraining: (routineId: string) => void
  onOpenTraining: () => void
  onOpenNutrition: () => void
  onOpenHistory?: () => void
}

/**
 * Accueil shell — gallery + floating pill when `VITE_ENABLE_ACCUEIL_GALLERY`
 * is on (default ON; set false for legacy dashboard + dock nav).
 */
export function HomeView({
  onStartTraining,
  onOpenTraining,
  onOpenNutrition,
  onOpenHistory = onOpenTraining,
}: HomeViewProps) {
  if (isAccueilGalleryEnabled()) {
    return (
      <HomeGalleryView
        onStartTraining={onStartTraining}
        onOpenTraining={onOpenTraining}
        onOpenHistory={onOpenHistory}
      />
    )
  }

  return (
    <HomeDashboardView
      onStartTraining={onStartTraining}
      onOpenTraining={onOpenTraining}
      onOpenNutrition={onOpenNutrition}
    />
  )
}

/**
 * Accueil = dashboard quotidien (default).
 * Ordre : Nutrition (calories + eau) → Séance → Sommeil → Série → Alertes (si besoin).
 * Ghost mode / Lobby / feed social : hors nav principale (infra conservée).
 */
function HomeDashboardView({
  onStartTraining,
  onOpenTraining,
  onOpenNutrition,
}: {
  onStartTraining: (routineId: string) => void
  onOpenTraining: () => void
  onOpenNutrition: () => void
}) {
  const { user, profile } = useAuth()
  const [trainingTick, setTrainingTick] = useState(0)
  const [coldEntering, setColdEntering] = useState(() => {
    if (typeof document === 'undefined') return false
    return (
      document.documentElement.dataset.coldLaunchLanding === '1' && shouldPlayWaveEnter()
    )
  })
  const [waveEnter, setWaveEnter] = useState(() => shouldPlayWaveEnter())

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

  useEffect(() => {
    const onColdLanding = () => {
      if (!shouldPlayWaveEnter()) return
      setColdEntering(true)
      setWaveEnter(true)
    }
    window.addEventListener('ranked-gym:cold-launch-landing', onColdLanding)
    return () => window.removeEventListener('ranked-gym:cold-launch-landing', onColdLanding)
  }, [])

  useEffect(() => {
    if (!coldEntering && !waveEnter) return
    delete document.documentElement.dataset.coldLaunchLanding
    markWaveEnterSeen()
    const t = window.setTimeout(() => {
      setColdEntering(false)
      setWaveEnter(false)
    }, 320)
    return () => window.clearTimeout(t)
  }, [coldEntering, waveEnter])

  const firstName = resolveDisplayFirstName({
    firstName: user?.firstName,
    displayName: user?.displayName,
    pseudo: profile?.pseudo,
  })
  const subtitle = getHomeGreetingSubtitle()

  const todayWorkout = useMemo(
    () => getTodayWorkout(getTrainingState()),
    [trainingTick],
  )

  return (
    <div
      className={`flex flex-col gap-8 ${
        coldEntering || waveEnter
          ? 'home-cold-enter home-cold-enter--active rg-wave-enter rg-wave-enter--active'
          : ''
      }`}
      data-rg-anim={coldEntering || waveEnter ? 'wave-enter' : undefined}
    >
      <header className="home-cold-enter__group home-cold-enter__group--0 rg-wave-enter__card rg-wave-enter__card--0">
        <h1 className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight text-white">
          <TextFlip /><BlurInText as="span" instant={coldEntering} label={`, ${firstName} ?`}>{`, ${firstName} ?`}</BlurInText>
        </h1>
        <p className="mt-1.5 text-[15px] font-medium text-[#AEAEB2]">
          <SoftBlurIn instant={coldEntering}>{subtitle}</SoftBlurIn>
        </p>
      </header>

      <div className="home-cold-enter__group home-cold-enter__group--1 rg-wave-enter__card rg-wave-enter__card--1">
        <Reveal instant={coldEntering}>
          <NutritionSnapshot onOpenNutrition={onOpenNutrition} />
        </Reveal>
      </div>

      <div className="home-cold-enter__group home-cold-enter__group--2 rg-wave-enter__card rg-wave-enter__card--2">
        <Reveal delayMs={60} instant={coldEntering}>
          <TodayWorkoutCard
            workout={todayWorkout}
            onStart={() => {
              if (todayWorkout?.canStart) onStartTraining(todayWorkout.routineId)
            }}
            onOpenNotebook={onOpenTraining}
          />
        </Reveal>
      </div>

      <div className="home-cold-enter__group home-cold-enter__group--3 rg-wave-enter__card rg-wave-enter__card--3">
        <SleepSnapshot />
      </div>

      <div className="home-cold-enter__group home-cold-enter__group--4 rg-wave-enter__card rg-wave-enter__card--4">
        <DailyStreak />
      </div>

      {/* Alertes : uniquement si un signal produit le justifie (aucune alerte permanente). */}
    </div>
  )
}
