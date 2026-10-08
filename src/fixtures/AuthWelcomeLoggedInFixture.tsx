import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../App'
import { AuthStateProvider } from '../context/AuthContext'
import { RestTimerProvider } from '../context/RestTimerContext'
import { saveCalorieProfile } from '../services/nutritionStorage'
import { getTrainingState, saveTrainingState } from '../services/trainingStorage'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../test/authFixtureValue'
import type { WorkoutRoutine } from '../types/training'

function seedOnboarding() {
  saveCalorieProfile(
    {
      weightKg: 78,
      goalWeightKg: 75,
      heightCm: 178,
      age: 28,
      sex: 'male',
      activity: 'active',
      morphology: 'mesomorph',
      goal: 'cut',
      weeklyPaceKg: 0.4,
      onboardingComplete: true,
    },
    { skipCloud: true },
  )

  const current = getTrainingState()
  if (current.routines.length > 0) return
  const push: WorkoutRoutine = {
    id: 'push',
    label: 'Push',
    subtitle: 'Poussée',
    accent: '#FF2B2B',
    updatedAt: Date.now(),
    exercises: [
      {
        id: 'e1',
        name: 'Développé couché',
        canonicalExerciseId: 'bench_press',
        sets: [
          { reps: 8, weightKg: 60, done: true },
          { reps: 8, weightKg: 60 },
          { reps: 8, weightKg: 60 },
        ],
      },
    ],
  }
  saveTrainingState(
    {
      ...current,
      primarySportId: 'musculation',
      favoriteSportIds: ['musculation'],
      sportsOnboardingComplete: true,
      routines: [push, ...(current.routines ?? [])],
      lastSelectedRoutineId: 'push',
      lastSelectedSportId: 'musculation',
      workoutNotes: [
        {
          id: 'n-seed',
          title: 'Push',
          dateKey: new Date().toISOString().slice(0, 10),
          createdAt: Date.now() - 86_400_000,
          estimatedKcal: 280,
          durationMin: 40,
          sessionKind: 'strength',
          sportId: 'musculation',
          routineId: 'push',
          exercises: push.exercises,
        },
        ...(current.workoutNotes ?? []),
      ],
    },
    { skipCloud: true },
  )
}

/** Session déjà valide : hold silencieux puis app, jamais l’écran d’accueil. */
export function AuthWelcomeLoggedInFixture() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    seedOnboarding()
    const delay = new URLSearchParams(window.location.search).get('restoreMs')
    const ms = delay ? Math.max(0, Number(delay) || 0) : 480
    const t = window.setTimeout(() => setIsLoading(false), ms)
    return () => window.clearTimeout(t)
  }, [])

  const value = useMemo(
    () =>
      buildAuthContextValue({
        user: FIXTURE_AUTH_USER,
        isAuthenticated: true,
        isLoading,
      }),
    [isLoading],
  )

  return (
    <AuthStateProvider value={value}>
      <RestTimerProvider>
        {/*
          Fixture-only : masque le bandeau config backend (Convex/Supabase absents
          en local/QA). Ne change pas le comportement app en production.
        */}
        <style>{`
          [data-logged-in-fixture="1"] [role="alert"].sticky {
            display: none !important;
          }
        `}</style>
        <div data-logged-in-fixture="1" className="h-[100dvh]">
          <AppShell />
        </div>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}
