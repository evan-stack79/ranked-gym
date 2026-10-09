import { BlurInText, CountUpNumber, Reveal, SoftBlurIn } from '../components/motion'
import { BrandMark } from '../components/brand/BrandMark'

/**
 * Route `/train-fixture` — hub Train figé pour démo animations (sans auth).
 * UI word: Effort only.
 */
export function TrainUxFixture() {
  return (
    <div
      className="relative flex h-[100dvh] min-h-0 flex-col mesh-bg font-sans"
      data-train-fixture="1"
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

      <main
        className="relative z-10 min-h-0 w-full flex-1 overflow-y-auto"
        data-app-scroll-main="1"
        style={{
          paddingBottom:
            'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 py-8">
          <header>
            <h1 className="text-[34px] font-bold tracking-tight text-white">
              <BlurInText as="span">Train</BlurInText>
            </h1>
            <p className="mt-1 text-[15px] text-[#AEAEB2]">
              <SoftBlurIn>Hub de la semaine</SoftBlurIn>
            </p>
          </header>

          <Reveal>
            <section
              className="glass-card rounded-2xl p-4"
              aria-label="Résumé de la semaine"
              data-reveal-card="week"
            >
              <p className="text-[11px] font-medium text-[#8E8E93]">
                <SoftBlurIn>Cette semaine</SoftBlurIn>
              </p>
              <p className="mt-2 text-[22px] font-bold tabular-nums text-white">
                <CountUpNumber kind="sessions" value={3} /> séances
              </p>
              <p className="mt-1 text-[13px] text-[#AEAEB2]">
                <CountUpNumber kind="successful_sets" value={24} /> séries réussies · Effort suivi
              </p>
            </section>
          </Reveal>

          <Reveal delayMs={60}>
            <section
              className="glass-card rounded-2xl p-4"
              aria-label="Dernière séance"
              data-reveal-card="recent"
            >
              <p className="text-[11px] font-medium text-[#8E8E93]">
                <SoftBlurIn>Dernière séance</SoftBlurIn>
              </p>
              <p className="mt-1 text-[15px] font-semibold text-white">Poussée · Pecs · Épaules</p>
              <button
                type="button"
                className="btn-brand ios-press mt-4 min-h-11 w-full rounded-2xl border border-white/15 px-3 py-2.5 text-[14px] font-semibold text-white"
                data-testid="train-fixture-cta"
              >
                Reprendre
              </button>
            </section>
          </Reveal>

          <section className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-medium text-[#8E8E93]">Conseil</p>
            <p className="mt-1 text-[14px] text-[#AEAEB2]">
              Note ton Effort de 1 à 10 après chaque série.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
