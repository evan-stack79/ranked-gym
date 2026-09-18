import { useEffect, useMemo, useState } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { BrandMark } from '../components/brand/BrandMark'
import { BottomNav } from '../components/layout/BottomNav'
import { NutritionDashboard } from '../components/nutrition/NutritionDashboard'
import {
  getCalorieProfile,
  saveCalorieProfile,
  saveMealJournal,
} from '../services/nutritionStorage'
import { todayKey } from '../utils/calories'
import type { CalorieProfile, DayJournal, MealEntry } from '../types/nutrition'
import type { TabId } from '../types'

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

function buildFixtureMeals(): MealEntry[] {
  const now = Date.now()
  return [
    {
      id: 'fx-bf',
      name: 'Flocons avoine',
      mealType: 'breakfast',
      calories: 350,
      proteinG: 18,
      carbsG: 48,
      fatG: 8,
      createdAt: now - 8 * 3600_000,
    },
    {
      id: 'fx-lunch',
      name: 'Poulet riz',
      mealType: 'lunch',
      calories: 620,
      proteinG: 48,
      carbsG: 65,
      fatG: 14,
      createdAt: now - 4 * 3600_000,
    },
    {
      id: 'fx-dinner',
      name: 'Saumon légumes',
      mealType: 'dinner',
      calories: 480,
      proteinG: 34,
      carbsG: 22,
      fatG: 24,
      createdAt: now - 1 * 3600_000,
    },
  ]
}

function seedNutritionFixture() {
  saveCalorieProfile(FIXTURE_PROFILE, { skipCloud: true })
  const journal: DayJournal = {
    dateKey: todayKey(),
    meals: buildFixtureMeals(),
    waterMl: 900,
    waterEntries: [
      {
        id: 'fx-water-1',
        amountMl: 500,
        createdAt: Date.now() - 3 * 3600_000,
        type: 'shaker',
        label: 'Shaker',
      },
      {
        id: 'fx-water-2',
        amountMl: 400,
        createdAt: Date.now() - 1 * 3600_000,
        type: 'glass',
        label: 'Verre',
      },
    ],
  }
  saveMealJournal({ [journal.dateKey]: journal }, { skipCloud: true })
}

function NutritionFixtureShell() {
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<CalorieProfile>(FIXTURE_PROFILE)
  const [activeTab] = useState<TabId>('nutrition')

  useEffect(() => {
    seedNutritionFixture()
    setProfile(getCalorieProfile())
    setReady(true)
  }, [])

  const content = useMemo(() => {
    if (!ready) return null
    return (
      <NutritionDashboard
        profile={profile}
        onChangeProfile={(next) => {
          setProfile(next)
          saveCalorieProfile(next, { skipCloud: true })
        }}
        onOpenSetup={() => undefined}
      />
    )
  }, [ready, profile])

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 flex-col bg-[#0C0C0E] font-sans"
      data-nutrition-fixture="1"
    >
      <main
        className="relative z-10 min-h-0 w-full flex-1 overflow-y-auto"
        style={{
          paddingBottom:
            'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 1rem)',
        }}
      >
        <header
          className="border-b border-white/5 bg-[#0C0C0E]"
          data-app-brand-header="1"
        >
          <div
            className="mx-auto flex max-w-lg items-center justify-center px-4 py-3"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <div data-cold-launch-target="compact">
              <BrandMark variant="compact" />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-lg px-5 py-8">{content}</div>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={() => undefined} />
    </div>
  )
}

/** Route `/nutrition-fixture` — capture UX Wave 2 sans auth. */
export function NutritionUxFixture() {
  return (
    <AuthProvider>
      <NutritionFixtureShell />
    </AuthProvider>
  )
}
