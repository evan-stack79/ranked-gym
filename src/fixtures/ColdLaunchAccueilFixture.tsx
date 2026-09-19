import { useEffect, useState } from 'react'
import { BrandMark } from '../components/brand/BrandMark'

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

        <div className="mx-auto w-full max-w-lg px-5 py-8">
          <div className="flex flex-col gap-8">
            <header className="home-cold-enter__group home-cold-enter__group--0">
              <h1 className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight text-white">
                Séance de l&apos;après-midi, Alex ?
              </h1>
            </header>

            <section className="home-cold-enter__group home-cold-enter__group--1">
              <div className="glass-card rounded-3xl p-5">
                <div className="mb-3 h-4 w-24 rounded-full bg-white/20" />
                <div className="h-3 w-full rounded-full bg-white/10" />
              </div>
            </section>

            <section className="home-cold-enter__group home-cold-enter__group--2">
              <div className="glass-card rounded-3xl p-5">
                <div className="mb-3 h-5 w-52 rounded-full bg-white/20" />
                <div className="mb-4 h-3 w-44 rounded-full bg-white/10" />
                <div className="h-10 w-40 rounded-2xl bg-[#FF2B2B]/25" />
              </div>
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

            {/* Contenu additionnel pour démontrer le scroll de la marque */}
            <section className="home-cold-enter__group home-cold-enter__group--4">
              <div className="glass-card rounded-3xl p-5">
                <div className="mb-3 h-4 w-32 rounded-full bg-white/20" />
                <div className="mb-2 h-3 w-full rounded-full bg-white/10" />
                <div className="h-3 w-4/5 rounded-full bg-white/10" />
              </div>
            </section>
            <section>
              <div className="glass-card rounded-3xl p-5">
                <div className="mb-3 h-4 w-40 rounded-full bg-white/20" />
                <div className="h-24 rounded-2xl bg-white/5" />
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer data-bottom-nav-host className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto flex h-[calc(var(--app-bottom-nav)+env(safe-area-inset-bottom,0px))] w-full max-w-lg items-center justify-around border-t border-white/10 bg-[#111114] px-4 pb-[env(safe-area-inset-bottom,0px)]">
          <span className="text-sm font-semibold text-[#FF2B2B]">Accueil</span>
          <span className="text-sm text-[#8E8E93]">Train</span>
          <span className="text-sm text-[#8E8E93]">Nutri</span>
          <span className="text-sm text-[#8E8E93]">Profil</span>
        </div>
      </footer>
    </div>
  )
}
