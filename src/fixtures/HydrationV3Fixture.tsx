/**
 * Fixture capture — Hydratation bouteille v3 variante B.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { LiveBottleVisual } from '../components/hydration/LiveBottleVisual'
import { BottleFlowV3, HydrationUndoToast } from '../components/hydration/BottleFlowV3'
import {
  WATER_CONTAINER_CAPACITY_ML,
  WATER_DRAG_STEP_ML,
  drunkMlFromStartAndCurrent,
} from '../shared/hydration'
import { setUserWaterGoalMl } from '../utils/userWaterGoal'
import { saveCalorieProfile, saveMealJournal } from '../services/nutritionStorage'
import { todayKey } from '../utils/calories'
import type { CalorieProfile } from '../types/nutrition'

const CAP = WATER_CONTAINER_CAPACITY_ML.plastic_15
const START = 1200
const AFTER = 950
const DRUNK = drunkMlFromStartAndCurrent(START, AFTER, CAP, WATER_DRAG_STEP_ML)
const DAY_BEFORE = 800
const DAY_AFTER = DAY_BEFORE + DRUNK

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

function seed() {
  setUserWaterGoalMl(2000)
  saveCalorieProfile(PROFILE, { skipCloud: true })
  saveMealJournal(
    {
      [todayKey()]: {
        dateKey: todayKey(),
        meals: [],
        waterMl: DAY_BEFORE,
        waterEntries: [],
      },
    },
    { skipCloud: true },
  )
}

function Phone({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div
      className="relative mx-auto overflow-hidden bg-black text-white"
      style={{ width: 402, height: 874 }}
      data-hydration-v3-screen={testId}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-[54px] items-end justify-between px-7 pb-1.5">
        <span className="text-[15px] font-semibold">9:41</span>
        <span className="h-2.5 w-4 rounded-[2px] border border-white/80" />
      </div>
      <div className="relative flex h-full flex-col px-5 pb-9 pt-[58px]">{children}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-50 flex justify-center">
        <span className="h-[5px] w-[134px] rounded-full bg-white/35" />
      </div>
    </div>
  )
}

function CardScreen({ drunkMl, testId }: { drunkMl: number; testId: string }) {
  const drunkL = (drunkMl / 1000).toFixed(2).replace('.', ',')
  return (
    <Phone testId={testId}>
      <h1 className="text-[34px] font-bold tracking-tight">Alimentation</h1>
      <p className="mt-1 text-[15px] text-[#8E8E93]">Aujourd&apos;hui</p>
      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-[72px] w-12 items-end justify-center">
            <LiveBottleVisual
              kind="plastic_15"
              remainingMl={START}
              capacityMl={CAP}
              size="thumb"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Eau</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums">
              {drunkL}&nbsp;/&nbsp;2&nbsp;L
            </p>
            <p className="mt-0.5 text-[13px] text-[#ACB4BA]">Cristaline 1,5&nbsp;L</p>
          </div>
          <span className="text-[20px] font-light text-[#8E8E93]">›</span>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-[#8E8E93]">
        Touche la carte pour dire ce que tu as bu.
      </p>
    </Phone>
  )
}

export default function HydrationV3Fixture() {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState('01')

  useEffect(() => {
    seed()
    setReady(true)
    const s = new URLSearchParams(window.location.search).get('screen')
    if (s) setScreen(s)
  }, [])

  if (!ready) return null

  return (
    <AuthProvider>
      <div className="min-h-screen bg-black" data-hydration-v3-fixture="1">
        {screen === '01' ? <CardScreen drunkMl={DAY_BEFORE} testId="01" /> : null}

        {screen === '02' ? (
          <div style={{ width: 402, height: 874 }} data-hydration-v3-screen="02">
            <BottleFlowV3
              open
              onClose={() => undefined}
              capacityMl={CAP}
              kind="plastic_15"
              initialRemainingMl={CAP}
              initialPhase="intro"
              onCommitDrunk={async () => undefined}
            />
          </div>
        ) : null}

        {screen === '03' ? (
          <div style={{ width: 402, height: 874 }} data-hydration-v3-screen="03">
            <BottleFlowV3
              open
              onClose={() => undefined}
              capacityMl={CAP}
              kind="plastic_15"
              initialRemainingMl={START}
              initialPhase="setup"
              captureStartMl={START}
              captureRemainingMl={START}
              onCommitDrunk={async () => undefined}
            />
          </div>
        ) : null}

        {screen === '04B' ? (
          <div style={{ width: 402, height: 874 }} data-hydration-v3-screen="04B">
            <BottleFlowV3
              open
              onClose={() => undefined}
              capacityMl={CAP}
              kind="plastic_15"
              initialRemainingMl={START}
              initialPhase="drink"
              captureStartMl={START}
              captureRemainingMl={AFTER}
              onCommitDrunk={async () => undefined}
            />
          </div>
        ) : null}

        {screen === '05B' ? (
          <Phone testId="05B">
            <button type="button" className="text-[17px] font-medium text-[#FF0702]">
              Retour
            </button>
            <h1 className="mt-2 text-[28px] font-bold">Alimentation</h1>
            <p className="text-[14px] text-[#8E8E93]">Aujourd&apos;hui</p>
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-[72px] w-12 items-end justify-center">
                  <LiveBottleVisual
                    kind="plastic_15"
                    remainingMl={AFTER}
                    capacityMl={CAP}
                    size="thumb"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">Eau</p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums">
                    {(DAY_AFTER / 1000).toFixed(2).replace('.', ',')}&nbsp;/&nbsp;2&nbsp;L
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#ACB4BA]">Cristaline 1,5&nbsp;L</p>
                </div>
              </div>
              <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-[#2A2A2E]">
                <div
                  className="h-full rounded-full bg-[#FF0702]"
                  style={{ width: `${(DAY_AFTER / 2000) * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-auto">
              <HydrationUndoToast
                amountMl={DRUNK}
                progress={0.62}
                onUndo={() => undefined}
                onDismiss={() => undefined}
              />
            </div>
          </Phone>
        ) : null}

        {screen === '06' ? (
          <Phone testId="06">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[17px] font-medium text-[#FF0702]">Retour</span>
              <span className="text-[13px] text-[#8E8E93]">Eau</span>
            </div>
            <div className="mt-3 flex flex-1 flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF0702]/15">
                <span className="text-[24px] font-bold text-[#FF0702]">✓</span>
              </div>
              <h2 className="mt-3 text-[26px] font-bold">{DRUNK}&nbsp;ml ajoutés</h2>
              <p className="mt-1.5 text-[14px] text-[#ACB4BA]">
                C&apos;est noté. Le total du jour est à jour.
              </p>
              <div className="mt-5 w-full rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-4 py-3.5 text-left">
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#ACB4BA]">
                  Aujourd&apos;hui
                </p>
                <p className="mt-1.5 text-[28px] font-bold tabular-nums">
                  {(DAY_AFTER / 1000).toFixed(2).replace('.', ',')}&nbsp;L
                </p>
                <p className="mt-0.5 text-[14px] text-[#ACB4BA]">
                  Objectif 2&nbsp;L · +{DRUNK}&nbsp;ml
                </p>
                <div className="mt-2.5 h-[4px] overflow-hidden rounded-full bg-[#2A2A2E]">
                  <div
                    className="h-full rounded-full bg-[#FF0702]"
                    style={{ width: `${(DAY_AFTER / 2000) * 100}%` }}
                  />
                </div>
              </div>
              <div className="mt-4">
                <LiveBottleVisual
                  kind="plastic_15"
                  remainingMl={AFTER}
                  capacityMl={CAP}
                  size="large"
                  showHandle
                />
                <p className="mt-2 text-[13px] text-[#8E8E93]">
                  Bouteille&nbsp;: {AFTER.toLocaleString('fr-FR')}&nbsp;ml restants
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-auto min-h-11 w-full rounded-2xl bg-[#FF0702] text-[16px] font-semibold"
            >
              Retour à Alimentation
            </button>
          </Phone>
        ) : null}
      </div>
    </AuthProvider>
  )
}
