import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react'
import { BlurInText } from '../../../src/components/motion'
import { ContainerPicker } from '../components/ContainerPicker'
import { BottleDragPanel } from '../components/BottleDragPanel'
import type { PhotoKind } from '../components/PhotoContainer'

const CAPACITY: Record<Exclude<PhotoKind, 'gourd'>, number> = {
  plastic_15: 1500,
  small_50: 500,
  glass_25: 250,
}

/**
 * Nutrition — contenants photo détourés, glisser au niveau de l'eau.
 * Aucun kcal.
 */
export function AlimentationGlisser() {
  const [container, setContainer] = useState<Exclude<PhotoKind, 'gourd'>>('plastic_15')
  // Niveau figé pour la maquette : 620 ml sur 1,5 L (ratio exact).
  const estimateMl = 620
  const fillRatio = useMemo(() => {
    if (container === 'plastic_15') return 620 / 1500
    if (container === 'small_50') return Math.min(1, 620 / 500)
    return Math.min(1, 620 / 250)
  }, [container])

  return (
    <div
      className="-mx-5 min-h-[70vh] overflow-x-hidden bg-[#000000] pb-2"
      data-mockup-screen="alimentation-glisser"
    >
      <div className="flex flex-col gap-3 px-5 pt-1">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-[32px] font-bold tracking-tight text-white">
            <BlurInText as="span" instant>
              Nutrition
            </BlurInText>
          </h1>
          <button
            type="button"
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white"
            aria-label="Menu nutrition"
          >
            <Ellipsis className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </header>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full text-[#ACB4BA]"
            aria-label="Jour précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="ios-press min-h-10 flex-1 text-center text-[14px] font-semibold text-white"
            aria-label="Choisir une date"
          >
            Mercredi 7 oct. <span className="text-[#ACB4BA]">⌄</span>
          </button>
          <button
            type="button"
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full text-[#ACB4BA]"
            aria-label="Jour suivant"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <section
          className="rounded-[28px] border border-white/12 bg-white/[0.04] px-3 py-2.5"
          data-mockup-eau-section
          aria-label="Eau"
        >
          <div className="mb-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
              Hydratation
            </p>
            <h2 className="mt-0.5 text-[22px] font-semibold tracking-tight text-white">Eau</h2>
          </div>

          <ContainerPicker selected={container} onSelect={setContainer} />

          <div className="mt-2">
            <BottleDragPanel
              kind={container}
              fillRatio={fillRatio}
              estimateMl={estimateMl}
              capacityMl={CAPACITY[container]}
            />
          </div>

          <button
            type="button"
            className="ios-press mt-2 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
            data-mockup-add-water
          >
            Ajouter
          </button>
        </section>
      </div>
    </div>
  )
}
