import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Check, Play } from 'lucide-react'
import { BrandMark } from '../components/brand/BrandMark'
import { BottomNav } from '../components/layout/BottomNav'
import {
  CardExpandTransition,
  LivingProgressBar,
  SessionCompleteBurst,
  TabPageTransition,
  animMs,
  readCardExpandRect,
  SET_VALIDATED_POP_MS,
} from '../components/motion'
import { StreakCelebrationOverlay } from '../components/streak/StreakCelebrationOverlay'
import { HomeBootSkeleton } from '../components/ui/AppBootScreen'
import { XPProgressBar } from '../components/ui/XPProgressBar'
import type { TabId } from '../types'
import type { CardExpandRect } from '../components/motion/CardExpandTransition'

/**
 * QA fixture `/animations-fixture` — demos the 6 team animations + streak skip path.
 * Session-shaped UI (set check + fin de séance), Accueil/Train wave + tabs,
 * bottom-bar play glow, XP progress (never kcal). Effort lexicon only.
 */
export function AnimationsFixture() {
  const [tab, setTab] = useState<TabId>('home')
  const [burstOpen, setBurstOpen] = useState(false)
  const [setDone, setSetDone] = useState(false)
  const [setPop, setSetPop] = useState(false)
  const [setPopKey, setSetPopKey] = useState(0)
  const [progress, setProgress] = useState(0.3)
  const [xpCurrent, setXpCurrent] = useState(360)
  const [expandFrom, setExpandFrom] = useState<CardExpandRect | null>(null)
  const [waveKey, setWaveKey] = useState(0)
  const [waveActive, setWaveActive] = useState(false)
  const [streakOpen, setStreakOpen] = useState(false)
  const [playKey, setPlayKey] = useState(0)
  const [pressHeld, setPressHeld] = useState(false)

  const validateSet = useCallback(() => {
    setSetDone(true)
    setSetPop(false)
    window.requestAnimationFrame(() => {
      setSetPopKey((k) => k + 1)
      setSetPop(true)
      window.setTimeout(() => setSetPop(false), animMs(SET_VALIDATED_POP_MS))
    })
  }, [])

  const resetSet = useCallback(() => {
    setSetDone(false)
    setSetPop(false)
  }, [])

  const replayWave = useCallback(() => {
    setWaveActive(false)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setWaveKey((k) => k + 1)
        setWaveActive(true)
      })
    })
  }, [])

  const fillProgress = useCallback(() => {
    // Hold ~30% long enough to read on video, then fill to 100% + sparks.
    setProgress(0.3)
    setXpCurrent(360)
    window.setTimeout(() => {
      setProgress(1)
      setXpCurrent(1200)
    }, animMs(700))
  }, [])

  const restartPlayBreathe = useCallback(() => {
    setPlayKey((k) => k + 1)
  }, [])

  // First paint: cards mount hidden, then wave plays (visible on video / reload).
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setWaveActive(true))
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  const sessionDemos = (
    <div className="flex flex-col gap-5" data-fixture-panel="session">
      <section className="space-y-2" data-demo="session-complete">
        <h2 className="text-[13px] font-semibold text-[#8E8E93]">1 · Fin de séance</h2>
        <button
          type="button"
          className="ios-press btn-brand min-h-11 w-full rounded-2xl px-4 text-[14px] font-semibold text-white"
          data-testid="demo-session-complete"
          onClick={() => setBurstOpen(true)}
        >
          Terminer la séance
        </button>
      </section>

      <section className="space-y-2" data-demo="set-validated">
        <h2 className="text-[13px] font-semibold text-[#8E8E93]">2 · Série validée</h2>
        <div
          key={setPopKey}
          className={`relative grid grid-cols-[2.25rem_1fr_1fr_1fr_2.5rem] items-center gap-x-2 rounded-xl px-1 py-1 ${
            setPop ? 'rg-set-row--pop' : ''
          }`}
          data-rg-set-pop={setPop ? '1' : undefined}
          data-testid="demo-set-row"
          data-set-row={setDone ? 'done' : 'active'}
        >
          <span className="text-center text-[13px] font-bold text-white">1</span>
          <span className="text-center text-[13px] tabular-nums text-[#AEAEB2]">80</span>
          <span className="text-center text-[13px] tabular-nums text-[#AEAEB2]">8</span>
          <span className="text-center text-[13px] tabular-nums text-[#AEAEB2]">
            {setDone ? '7' : '—'}
          </span>
          <div className="flex items-center justify-center">
            {setDone ? (
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF2B2B] text-white"
                aria-label="Série 1 validée"
                data-rg-set-check
                data-testid="demo-set-check"
                onClick={() => {
                  resetSet()
                  window.setTimeout(validateSet, 80)
                }}
              >
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </button>
            ) : (
              <button
                type="button"
                className="ios-press h-7 w-7 rounded-full border border-[#3a3a3c]"
                aria-label="Valider la série 1"
                data-testid="demo-set-check"
                onClick={validateSet}
              />
            )}
          </div>
        </div>
        <p className="text-[12px] text-[#636366]">Bench · Effort 7</p>
        <p className="text-[12px] tabular-nums text-[#636366]" data-rg-metric="load-static">
          80 kg · 8 reps
        </p>
        <button
          type="button"
          className="ios-press btn-brand min-h-11 rounded-2xl px-4 text-[14px] font-semibold text-white"
          data-testid="demo-set-validate"
          onClick={() => {
            if (setDone) {
              resetSet()
              window.setTimeout(validateSet, 80)
            } else {
              validateSet()
            }
          }}
        >
          Valider la série
        </button>
      </section>
    </div>
  )

  const homePanel = (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5" data-fixture-panel="home">
      <h1 className="text-[28px] font-bold tracking-tight text-white">Accueil</h1>
      <p className="text-[14px] text-[#AEAEB2]">Train · vague + onglets</p>

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
          <p className="mt-1 text-[13px] text-[#AEAEB2]">Appuyer pour ouvrir</p>
        </button>
      </section>

      <section className="space-y-2" data-demo="wave-enter">
        <h2 className="text-[13px] font-semibold text-[#8E8E93]">4 · Chargement en vague</h2>
        <div
          key={waveKey}
          className={
            waveActive ? 'rg-wave-enter rg-wave-enter--active space-y-3' : 'space-y-3'
          }
          data-rg-anim="wave-enter"
          data-testid="demo-wave"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={`${waveKey}-${i}`}
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
          onClick={replayWave}
        >
          Rejouer la vague
        </button>
      </section>

      <section className="space-y-2" data-demo="living-progress">
        <h2 className="text-[13px] font-semibold text-[#8E8E93]">5 · Barres vivantes (XP)</h2>
        <XPProgressBar currentXp={xpCurrent} xpToNextLevel={1200} level={4} />
        <LivingProgressBar value={progress} sparksAtFull aria-label="Objectif séances" />
        <p className="text-[12px] text-[#636366]" data-rg-metric="sessions-static">
          3 / 4 séances cette semaine
        </p>
        <button
          type="button"
          className="ios-press btn-brand min-h-11 rounded-2xl px-4 text-[14px] font-semibold text-white"
          data-testid="demo-progress-fill"
          onClick={fillProgress}
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
          data-pressed={pressHeld ? 'true' : undefined}
          onPointerDown={() => setPressHeld(true)}
          onPointerUp={() => setPressHeld(false)}
          onPointerLeave={() => setPressHeld(false)}
          onPointerCancel={() => setPressHeld(false)}
        >
          Press feedback
        </button>
        <div className="flex justify-center py-2">
          <button
            type="button"
            key={playKey}
            className="rg-play-breathe flex h-14 w-14 items-center justify-center rounded-full bg-[#FF2B2B] text-white"
            data-rg-anim="play-breathe"
            data-testid="demo-play-breathe"
            aria-label="Nouvelle séance"
            onClick={restartPlayBreathe}
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </button>
        </div>
        <p className="text-center text-[12px] text-[#636366]">
          Glow aussi sur le bouton play de la barre du bas
        </p>
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
  )

  let panel: ReactNode
  if (tab === 'training') {
    panel = (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5" data-fixture-panel="training">
        <h1 className="text-[28px] font-bold tracking-tight text-white">Séance</h1>
        <p className="text-[14px] text-[#AEAEB2]">Push · Effort suivi</p>
        {sessionDemos}
        <section className="glass-card rounded-2xl p-4">
          <p className="text-[11px] font-medium text-[#8E8E93]">Train</p>
          <p className="mt-2 text-[22px] font-bold tabular-nums text-white">3 séances</p>
          <p className="mt-1 text-[13px] text-[#AEAEB2]">Effort suivi cette semaine</p>
        </section>
      </div>
    )
  } else if (tab === 'home') {
    panel = homePanel
  } else {
    panel = (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5" data-fixture-panel={tab}>
        <h1 className="text-[28px] font-bold tracking-tight text-white">{tab}</h1>
        <p className="text-[14px] text-[#AEAEB2]">Transition d&apos;onglet</p>
      </div>
    )
  }

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
        <TabPageTransition tabId={tab}>{panel}</TabPageTransition>
      </main>

      <div data-bottom-nav-host>
        <BottomNav
          activeTab={tab}
          onTabChange={setTab}
          floatingPill={false}
          onStartTraining={() => {
            restartPlayBreathe()
            setTab('training')
          }}
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
