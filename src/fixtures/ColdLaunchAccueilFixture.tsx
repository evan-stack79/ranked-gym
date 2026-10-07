import { useEffect, useState } from 'react'
import { BrandMark } from '../components/brand/BrandMark'
import { BlurInText, CountUpNumber, Reveal, StaticKcalNumber } from '../components/motion'

export function ColdLaunchAccueilFixture() {
  const [coldEntering, setColdEntering] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.dataset.coldLaunchLanding === '1'
  })

  useEffect(() => {
    const onColdLanding = () => setColdEntering(true)
    window.addEventListener('ranked-gym:cold-launch-landing', onColdLanding)
    return () => window.removeEventListener('ranked-gym:cold-launch-landing', onColdLanding)
  }, [])

  useEffect(() => {
    if (!coldEntering) return
    delete document.documentElement.dataset.coldLaunchLanding
    const t = window.setTimeout(() => {
      setColdEntering(false)
    }, 320)
    return () => window.clearTimeout(t)
  }, [coldEntering])

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col mesh-bg font-sans">
      <main
        className={`relative z-10 min-h-0 w-full flex-1 overflow-y-auto ${coldEntering ? 'home-cold-enter home-cold-enter--active' : ''}`}
        style={{
          paddingBottom:
            'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
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
              <div data-cold-launch-target="compact">
                <BrandMark variant="compact" />
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-lg px-5 py-8">
          <div className="flex flex-col gap-8">
            <header className="home-cold-enter__group home-cold-enter__group--0">
              <h1 className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight text-white">
                <BlurInText as="span" instant={coldEntering}>
                  Séance de l&apos;après-midi, Alex ?
                </BlurInText>
              </h1>
            </header>

            <section className="home-cold-enter__group home-cold-enter__group--1">
              <Reveal instant={coldEntering}>
                <div
                  className="glass-card rounded-3xl p-5"
                  data-reveal-card="nutrition"
                  data-testid="accueil-kcal-static"
                >
                  <p className="text-[11px] font-medium text-[#8E8E93]">Aujourd&apos;hui</p>
                  <p className="mt-1 text-[22px] font-bold tracking-tight text-white">
                    Il te reste <StaticKcalNumber value={842} /> kcal
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-[#8E8E93]">Eau</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-white">
                    <CountUpNumber
                      kind="water"
                      value={900}
                      instant={coldEntering}
                      format={(n) => `${Math.round(n)} ml`}
                    />{' '}
                    sur 2,8 L
                  </p>
                  <button
                    type="button"
                    className="btn-brand ios-press mt-4 min-h-11 w-full rounded-2xl border border-white/15 px-3 py-2.5 text-[14px] font-semibold text-white"
                    data-testid="accueil-fixture-cta"
                  >
                    Ajouter un repas
                  </button>
                </div>
              </Reveal>
            </section>

            <section className="home-cold-enter__group home-cold-enter__group--2">
              <Reveal delayMs={60} instant={coldEntering}>
                <div className="glass-card rounded-3xl p-5" data-reveal-card="train">
                  <p className="text-[11px] font-medium text-[#8E8E93]">Entraînement</p>
                  <p className="mt-1 text-[15px] font-semibold text-white">Push · 4 exercices</p>
                  <button
                    type="button"
                    className="btn-brand ios-press mt-4 min-h-11 rounded-2xl border border-white/15 px-4 py-2.5 text-[14px] font-semibold text-white"
                  >
                    Démarrer
                  </button>
                </div>
              </Reveal>
            </section>

            <section className="home-cold-enter__group home-cold-enter__group--3">
              <div className="glass-card rounded-3xl p-5">
                <div className="mb-3 h-5 w-40 rounded-full bg-white/20" />
                <div className="h-10 w-28 rounded-2xl bg-white/10" />
              </div>
            </section>

            <section className="home-cold-enter__group home-cold-enter__group--4">
              <div className="glass-card rounded-3xl p-5">
                <div className="mb-3 h-4 w-28 rounded-full bg-white/20" />
                <div className="h-3 w-56 rounded-full bg-white/10" />
              </div>
            </section>

            <section className="home-cold-enter__group home-cold-enter__group--4">
              <div className="glass-card rounded-3xl p-5">
                <div className="mb-3 h-4 w-32 rounded-full bg-white/20" />
                <div className="mb-2 h-3 w-full rounded-full bg-white/10" />
                <div className="h-3 w-3/4 rounded-full bg-white/10" />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
