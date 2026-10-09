import { useState } from 'react'
import { Check, Play } from 'lucide-react'
import { BrandMark } from '../components/brand/BrandMark'
import { BottomNav } from '../components/layout/BottomNav'
import {
  CardExpandTransition,
  LivingProgressBar,
  SessionCompleteBurst,
  readCardExpandRect,
} from '../components/motion'
import { StreakCelebrationOverlay } from '../components/streak/StreakCelebrationOverlay'
import { HomeBootSkeleton } from '../components/ui/AppBootScreen'
import type { TabId } from '../types'
import type { CardExpandRect } from '../components/motion/CardExpandTransition'

/**
 * QA fixture `/animations-fixture` — demos the 6 team animations + streak skip path.
 * No Convex / auth. Effort lexicon only (never RPE).
 */
export function AnimationsFixture() {
  const [tab, setTab] = useState<TabId>('home')
  const [burstOpen, setBurstOpen] = useState(false)
  const [setPop, setSetPop] = useState(false)
  const [progress, setProgress] = useState(0.35)
  const [expandFrom, setExpandFrom] = useState<CardExpandRect | null>(null)
  const [wave, setWave] = useState(true)
  const [streakOpen, setStreakOpen] = useState(false)

  return (
    <div
      className="relative flex h-[100dvh] min-h-0 flex-col mesh-bg font-sans"
      data-animations-fixture="1"
    >
      <header
        className="border-b border-white/5"
        data-app-brand-header="1"
        style={{ paddingTop: 'var(--app-safe-area-top, env(safe-area-inset-top, 0px))' }}
      >
        <div className="relative">
          <div
            aria-hidden="true"
            data-brand-header-bg="1"
            className="pointer-events-none absolute inset-0 -z-10 bg-[#0C0C0E]"
          />
          <div className="mx-auto flex max-w-lg items-center justify-center px-4 pb-2 pt-0">
            <BrandMark variant="compact" />
          </div>
        </div>
      </header>

      <main
        className="relative z-10 min-h-0 w-full flex-1 overflow-y-auto px-5 py-6"
        data-app-scroll-main="1"
        style={{
          paddingBottom:
            'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
          <h1 className="text-[28px] font-bold tracking-tight text-white">Animations</h1>
          <p className="text-[14px] text-[#AEAEB2]">
            Démos figées — Effort suivi, jamais d&apos;échelle RPE.
          </p>

          <section className="space-y-2" data-demo="session-complete">
            <h2 className="text-[13px] font-semibold text-[#8E8E93]">1 · Fin de séance</h2>
            <button
              type="button"
              className="ios-press btn-brand min-h-11 w-full rounded-2xl px-4 text-[14px] font-semibold text-white"
              data-testid="demo-session-complete"
              onClick={() => setBurstOpen(true)}
            >
              Lancer la célébration
            </button>
          </section>

          <section className="space-y-2" data-demo="set-validated">
            <h2 className="text-[13px] font-semibold text-[#8E8E93]">2 · Série validée</h2>
            <div
              className={`relative grid grid-cols-[2.25rem_1fr_2.5rem] items-center gap-2 rounded-xl px-2 py-2 ${
                setPop ? 'rg-set-row--pop' : ''
              }`}
              data-rg-set-pop={setPop ? '1' : undefined}
              data-testid="demo-set-row"
            >
              <span className="text-center text-[13px] font-bold text-white">1</span>
              <span className="text-[13px] text-[#AEAEB2]">Bench · Effort 7</span>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white"
                data-rg-set-check
              >
                <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
              </span>
            </div>
            {/* kg shown static — never animated */}
            <p className="text-[12px] tabular-nums text-[#636366]" data-rg-metric="load-static">
              80 kg · 8 reps
            </p>
            <button
              type="button"
              className="ios-press btn-brand min-h-11 rounded-2xl px-4 text-[14px] font-semibold text-white"
              data-testid="demo-set-validate"
              onClick={() => {
                setSetPop(true)
                window.setTimeout(() => setSetPop(false), 400)
              }}
            >
              Valider la série
            </button>
          </section>

          <section className="space-y-2" data-demo="card-expand">
            <h2 className="text-[13px] font-semibold text-[#8E8E93]">3 · Passage (carte → page)</h2>
            <button
              type="button"
              className="ios-press glass-card w-full rounded-2xl p-4 text-left"
              data-testid="demo-expand-card"
              data-rg-vt-card
              onClick={(e) => {
                setExpandFrom(readCardExpandRect(e.currentTarget))
              }}
            >
              <p className="text-[15px] font-semibold text-white">Carte séance</p>
              <p className="mt-1 text-[13px] text-[#AEAEB2]">App Store expand</p>
            </button>
          </section>

          <section className="space-y-2" data-demo="wave-enter">
            <h2 className="text-[13px] font-semibold text-[#8E8E93]">4 · Chargement en vague</h2>
            <div
              className={wave ? 'rg-wave-enter rg-wave-enter--active space-y-3' : 'space-y-3'}
              data-rg-anim="wave-enter"
              data-testid="demo-wave"
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`rg-wave-enter__card rg-wave-enter__card--${i} glass-card rounded-2xl p-4`}
                >
                  <HomeBootSkeleton />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="ios-press min-h-11 rounded-2xl border border-white/12 px-4 text-[13px] font-semibold text-[#AEAEB2]"
              data-testid="demo-wave-replay"
              onClick={() => {
                setWave(false)
                window.requestAnimationFrame(() => setWave(true))
              }}
            >
              Rejouer la vague
            </button>
          </section>

          <section className="space-y-2" data-demo="living-progress">
            <h2 className="text-[13px] font-semibold text-[#8E8E93]">5 · Barres vivantes</h2>
            <LivingProgressBar value={progress} sparksAtFull aria-label="Objectif séances" />
            <p className="text-[12px] text-[#636366]" data-rg-metric="kcal-static">
              1840 kcal (statique)
            </p>
            <button
              type="button"
              className="ios-press btn-brand min-h-11 rounded-2xl px-4 text-[14px] font-semibold text-white"
              data-testid="demo-progress-fill"
              onClick={() => setProgress((p) => (p >= 1 ? 0.2 : 1))}
            >
              Remplir à 100%
            </button>
          </section>

          <section className="space-y-2" data-demo="buttons">
            <h2 className="text-[13px] font-semibold text-[#8E8E93]">6 · Boutons</h2>
            <button
              type="button"
              className="ios-press btn-brand flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white"
              data-testid="demo-press-btn"
            >
              Press feedback
            </button>
            <div className="flex justify-center py-2">
              <span
                className="rg-play-breathe flex h-14 w-14 items-center justify-center rounded-full bg-[#FF2B2B] text-white"
                data-rg-anim="play-breathe"
                data-testid="demo-play-breathe"
              >
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </div>
          </section>

          <section className="space-y-2" data-demo="streak-fix">
            <h2 className="text-[13px] font-semibold text-[#8E8E93]">7 · Streak (≤560ms, skippable)</h2>
            <button
              type="button"
              className="ios-press btn-brand min-h-11 w-full rounded-2xl px-4 text-[14px] font-semibold text-white"
              data-testid="demo-streak"
              onClick={() => setStreakOpen(true)}
            >
              Lancer la série
            </button>
          </section>
        </div>
      </main>

      <div data-bottom-nav-host>
        <BottomNav
          activeTab={tab}
          onTabChange={setTab}
          floatingPill={false}
          onStartTraining={() => setTab('training')}
        />
      </div>

      <SessionCompleteBurst open={burstOpen} onComplete={() => setBurstOpen(false)} />
      <CardExpandTransition from={expandFrom} onComplete={() => setExpandFrom(null)} />
      {streakOpen ? (
        <StreakCelebrationOverlay
          previousStreak={6}
          currentStreak={7}
          dateKey="2026-10-09"
          onComplete={() => setStreakOpen(false)}
        />
      ) : null}
    </div>
  )
}
