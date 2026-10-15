import { useEffect, useState } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { BrandMark } from '../components/brand/BrandMark'
import { NutritionSnapshot } from '../components/home/NutritionSnapshot'
import { NutritionHydrationCard } from '../components/nutrition/NutritionHydrationCard'
import { SmartWaterGauge } from '../components/nutrition/SmartWaterGauge'
import {
  getTodayWaterMl,
  saveCalorieProfile,
  saveMealJournal,
} from '../services/nutritionStorage'
import { todayKey } from '../utils/calories'
import {
  clearUserWaterGoal,
  getUserWaterGoalMl,
  WATER_GOAL_CHANGED_EVENT,
} from '../utils/userWaterGoal'
import type { CalorieProfile, DayJournal } from '../types/nutrition'

const FIXTURE_PROFILE: CalorieProfile = {
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
}

function seed() {
  clearUserWaterGoal()
  saveCalorieProfile(FIXTURE_PROFILE, { skipCloud: true })
  const journal: DayJournal = {
    dateKey: todayKey(),
    meals: [],
    waterMl: 750,
    waterEntries: [
      {
        id: 'wg-water-1',
        amountMl: 500,
        createdAt: Date.now() - 2 * 3600_000,
        type: 'shaker',
        label: 'Shaker',
      },
      {
        id: 'wg-water-2',
        amountMl: 250,
        createdAt: Date.now() - 1 * 3600_000,
        type: 'glass',
        label: 'Verre',
      },
    ],
  }
  saveMealJournal({ [journal.dateKey]: journal }, { skipCloud: true })
}

function WaterGoalFixtureShell() {
  const [ready, setReady] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    seed()
    setReady(true)
  }, [])

  useEffect(() => {
    const sync = () => setTick((n) => n + 1)
    window.addEventListener(WATER_GOAL_CHANGED_EVENT, sync)
    window.addEventListener('ranked-gym:water-changed', sync)
    return () => {
      window.removeEventListener(WATER_GOAL_CHANGED_EVENT, sync)
      window.removeEventListener('ranked-gym:water-changed', sync)
    }
  }, [])

  if (!ready) return null

  void tick
  const goalMl = getUserWaterGoalMl()
  const consumedMl = getTodayWaterMl()

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#0C0C0E] font-sans"
      data-water-goal-fixture="1"
    >
      <header
        className="sticky top-0 z-30 shrink-0 border-b border-white/5"
        style={{ paddingTop: 'var(--app-safe-area-top, env(safe-area-inset-top, 0px))' }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 pb-2 pt-0">
          <BrandMark variant="compact" />
        </div>
      </header>
      <main
        className="relative z-10 min-h-0 w-full flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        data-app-scroll-main="1"
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-6">
          <section data-capture="accueil-snapshot" aria-label="Accueil nutrition">
            {/* onOpenNutrition required so « Ajouter un repas » is enabled (same as HomeView). */}
            <NutritionSnapshot onOpenNutrition={() => undefined} />
          </section>
          <section data-capture="hydration-card" aria-label="Carte hydratation">
            <NutritionHydrationCard
              consumedMl={consumedMl}
              goalMl={goalMl}
              onAdd250={() => undefined}
              onGoalSaved={() => setTick((n) => n + 1)}
              chooserInputId="water-goal-input-card"
            />
          </section>
          <section data-capture="smart-gauge" aria-label="Jauge eau">
            <SmartWaterGauge />
          </section>
        </div>
      </main>
    </div>
  )
}

/** Route `/water-goal-fixture` — captures objectif eau sans auth. */
export function WaterGoalFixture() {
  return (
    <AuthProvider>
      <WaterGoalFixtureShell />
    </AuthProvider>
  )
}
