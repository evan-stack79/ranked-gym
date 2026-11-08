import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react'
import { BlurInText } from '../../../src/components/motion'
import { SvgBottle15 } from '../components/DetailedSvgBottles'

/** Variante SVG soignée — pour A/B vs photos détourées. */
export function SvgCompareGlisser() {
  const fillRatio = 620 / 1500
  return (
    <div className="-mx-5 min-h-[70vh] bg-[#000000] pb-2" data-mockup-screen="svg-compare">
      <div className="flex flex-col gap-3 px-5 pt-1">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-[32px] font-bold tracking-tight text-white">
            <BlurInText as="span" instant>
              Nutrition
            </BlurInText>
          </h1>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white"
            aria-label="Menu nutrition"
          >
            <Ellipsis className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </header>
        <div className="flex items-center justify-between gap-2">
          <ChevronLeft className="h-5 w-5 text-[#ACB4BA]" />
          <p className="text-[14px] font-semibold text-white">Mercredi 7 oct.</p>
          <ChevronRight className="h-5 w-5 text-[#ACB4BA]" />
        </div>
        <section className="rounded-[28px] border border-white/12 bg-white/[0.04] px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
            Hydratation · SVG
          </p>
          <h2 className="mt-1 text-[22px] font-semibold text-white">Eau</h2>
          <div className="relative mx-auto mt-4 w-fit" data-mockup-drag-panel="svg15">
            <SvgBottle15 fillRatio={fillRatio} large />
            <div
              className="absolute inset-x-[10%] z-[2] h-5"
              style={{ bottom: `calc(${fillRatio * 100}% - 10px)` }}
              data-mockup-drag-handle
            >
              <div className="relative h-5">
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#5AC8FA]/75" />
                <span className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-1/2 rounded-full border border-[#5AC8FA]/80 bg-[#0B0B0D]" />
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[17px] font-semibold text-white">≈ 620 ml bus</p>
          <button
            type="button"
            className="mt-3 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
          >
            Ajouter
          </button>
        </section>
      </div>
    </div>
  )
}
