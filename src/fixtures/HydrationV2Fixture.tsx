import { useEffect, useState, type ReactNode } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { EauTile, SeriesJourTile } from '../components/home/AccueilMetricTiles'
import { BottleDragPanel } from '../components/hydration/BottleDragPanel'
import { ContainerPicker } from '../components/hydration/ContainerPicker'
import { deriveWaterTileModel } from '../utils/accueilWidgetTiles'
import { setUserWaterGoalMl } from '../utils/userWaterGoal'
import { saveCalorieProfile, saveMealJournal } from '../services/nutritionStorage'
import { todayKey } from '../utils/calories'
import type { CalorieProfile } from '../types/nutrition'
import type { BottleDragMode } from '../components/hydration/LiveBottleVisual'

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

function NutritionPhaseScreen({
  testId,
  phase,
  remainingMl,
  startRemainingMl,
}: {
  testId: string
  phase: BottleDragMode
  remainingMl: number
  startRemainingMl: number
}) {
  const [remaining, setRemaining] = useState(remainingMl)
  return (
    <ScreenShell title="Nutrition" testId={testId}>
      <section className="rounded-[28px] border border-white/12 bg-white/[0.04] px-3 py-2.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
              Hydratation
            </p>
            <h2 className="mt-0.5 text-[22px] font-semibold tracking-tight text-white">Eau</h2>
          </div>
          <p className="text-[11px] font-medium text-[#8E8E93]">Eau bue seule</p>
        </div>
        <ContainerPicker selected="plastic_15" onSelect={() => undefined} />
        <p className="mt-2 text-[13px] font-medium text-[#ACB4BA]">
          {phase === 'setup' ? 'Niveau de départ' : 'Boire'}
        </p>
        <div className="mt-1">
          <BottleDragPanel
            kind="plastic_15"
            remainingMl={remaining}
            capacityMl={1500}
            startRemainingMl={startRemainingMl}
            mode={phase}
            onRemainingChange={setRemaining}
          />
        </div>
        {phase === 'setup' ? (
          <button
            type="button"
            className="ios-press mt-2 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
          >
            C&apos;est bon
          </button>
        ) : (
          <>
            <button
              type="button"
              className="ios-press mt-2 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
            >
              Ajouter
            </button>
            <button
              type="button"
              className="ios-press mt-2 min-h-11 w-full rounded-2xl border border-white/15 bg-white/5 text-[14px] font-semibold text-white"
            >
              Régler le niveau
            </button>
          </>
        )}
      </section>
    </ScreenShell>
  )
}

export default function HydrationV2Fixture() {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<
    'accueil' | 'alimentation' | 'ma-bouteille' | 'setup' | 'drink'
  >('accueil')

  useEffect(() => {
    seed()
    setReady(true)
    const params = new URLSearchParams(window.location.search)
    const s = params.get('screen')
    if (
      s === 'alimentation'
      || s === 'ma-bouteille'
      || s === 'accueil'
      || s === 'setup'
      || s === 'drink'
    ) {
      setScreen(s)
    }
  }, [])

  if (!ready) return null

  return (
    <AuthProvider>
      <div className="min-h-screen bg-black" data-hydration-v2-fixture="1">
        {screen === 'accueil' ? <AccueilScreen /> : null}
        {screen === 'alimentation' || screen === 'setup' ? (
          <NutritionPhaseScreen
            testId={screen === 'setup' ? 'setup' : 'alimentation'}
            phase="setup"
            remainingMl={1100}
            startRemainingMl={1100}
          />
        ) : null}
        {screen === 'drink' ? (
          <NutritionPhaseScreen
            testId="drink"
            phase="drink"
            remainingMl={750}
            startRemainingMl={1500}
          />
        ) : null}
        {screen === 'ma-bouteille' ? (
          <NutritionPhaseScreen
            testId="ma-bouteille"
            phase="drink"
            remainingMl={270}
            startRemainingMl={750}
          />
        ) : null}
      </div>
    </AuthProvider>
  )
}
