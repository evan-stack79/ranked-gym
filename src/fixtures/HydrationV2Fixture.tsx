import { useEffect, useState, type ReactNode } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { EauTile, SeriesJourTile } from '../components/home/AccueilMetricTiles'
import { HydrationPanel } from '../components/hydration/HydrationPanel'
import { BottleDragPanel } from '../components/hydration/BottleDragPanel'
import { deriveWaterTileModel } from '../utils/accueilWidgetTiles'
import { setUserWaterGoalMl } from '../utils/userWaterGoal'
import { saveCalorieProfile, saveMealJournal } from '../services/nutritionStorage'
import { todayKey } from '../utils/calories'
import type { CalorieProfile } from '../types/nutrition'

const PROFILE: CalorieProfile = {
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

const MOTION = {
  coldEntering: false,
  prefersReducedMotion: true,
  freezeCountUp: true,
} as const

function seed() {
  setUserWaterGoalMl(2000)
  saveCalorieProfile(PROFILE, { skipCloud: true })
  saveMealJournal(
    {
      [todayKey()]: {
        dateKey: todayKey(),
        meals: [],
        waterMl: 1250,
        waterEntries: [
          {
            id: 'hy-v2-1',
            amountMl: 1250,
            createdAt: Date.now() - 3600_000,
            type: 'bottle',
            label: 'Bouteille',
          },
        ],
      },
    },
    { skipCloud: true },
  )
}

function ScreenShell({
  title,
  children,
  testId,
}: {
  title: string
  children: ReactNode
  testId: string
}) {
  return (
    <div
      className="mx-auto min-h-[844px] w-[390px] overflow-hidden bg-black px-5 pb-8 pt-10 text-white"
      data-hydration-v2-screen={testId}
    >
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-[32px] font-bold tracking-tight text-white">{title}</h1>
      </header>
      {children}
    </div>
  )
}

function AccueilScreen() {
  const model = deriveWaterTileModel(1250, 2000, true)
  return (
    <ScreenShell title="Accueil" testId="accueil">
      <div className="accueil-widgets flex flex-col gap-3">
        <div className="accueil-widgets__row" data-accueil-widget-row>
          <div className="accueil-widgets__cell min-w-0">
            <EauTile model={model} motion={MOTION} onSetGoal={() => undefined} />
          </div>
          <div className="accueil-widgets__cell min-w-0">
            <SeriesJourTile
              model={{ doneSets: 2, plannedSets: 12, showRing: true, progress: 2 / 12 }}
              motion={MOTION}
            />
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}

function NutritionScreen() {
  return (
    <ScreenShell title="Nutrition" testId="alimentation">
      <HydrationPanel />
    </ScreenShell>
  )
}

function MaBouteilleScreen() {
  const [ml, setMl] = useState(480)
  return (
    <ScreenShell title="Nutrition" testId="ma-bouteille">
      <section className="rounded-[28px] border border-white/12 bg-white/[0.04] px-3 py-2.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
              Hydratation
            </p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-white">
              Ma bouteille
            </h2>
          </div>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF907F]">
            Pro
          </span>
        </div>
        <p className="mb-3 text-[12px] leading-snug text-[#8E8E93]">
          Look cosmétique Pass Pro. Aucun avantage de jeu.
        </p>
        <BottleDragPanel kind="gourd" ml={ml} capacityMl={750} onMlChange={setMl} />
        <button
          type="button"
          className="ios-press mt-2 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
        >
          Ajouter
        </button>
        <p className="mt-1.5 text-center text-[12px] text-[#8E8E93]">Pas de visage sur la photo</p>
      </section>
      <p className="mt-3 px-1 text-center text-[12px] text-[#8E8E93]">
        Photo prise le 12 oct. · Changer la photo
      </p>
    </ScreenShell>
  )
}

export default function HydrationV2Fixture() {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<'accueil' | 'alimentation' | 'ma-bouteille'>('accueil')

  useEffect(() => {
    seed()
    setReady(true)
    const params = new URLSearchParams(window.location.search)
    const s = params.get('screen')
    if (s === 'alimentation' || s === 'ma-bouteille' || s === 'accueil') setScreen(s)
  }, [])

  if (!ready) return null

  return (
    <AuthProvider>
      <div className="min-h-screen bg-black" data-hydration-v2-fixture="1">
        {screen === 'accueil' ? <AccueilScreen /> : null}
        {screen === 'alimentation' ? <NutritionScreen /> : null}
        {screen === 'ma-bouteille' ? <MaBouteilleScreen /> : null}
      </div>
    </AuthProvider>
  )
}
