import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../App'
import { AuthStateProvider } from '../context/AuthContext'
import { RestTimerProvider } from '../context/RestTimerContext'
import { saveCalorieProfile } from '../services/nutritionStorage'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../test/authFixtureValue'

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
        <div data-logged-in-fixture="1" className="h-[100dvh]">
          <AppShell />
        </div>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}
