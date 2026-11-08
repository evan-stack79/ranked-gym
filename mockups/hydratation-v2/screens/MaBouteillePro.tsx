import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react'
import { BlurInText } from '../../../src/components/motion'
import { BottleDragPanel } from '../components/BottleDragPanel'

/**
 * Ma bouteille (Pass Pro, cosmétique) — vraie photo détourée de gourde,
 * eau + glisser au niveau, sans étiquette « Exemple ».
 */
export function MaBouteillePro() {
  // ~480 ml sur une gourde ~750 ml typique → niveau crédible
  const estimateMl = 480
  const fillRatio = 480 / 750

  return (
    <div
      className="-mx-5 min-h-[70vh] overflow-x-hidden bg-[#000000] pb-2"
      data-mockup-screen="ma-bouteille-pro"
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
          aria-label="Ma bouteille"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ACB4BA]">
                Hydratation
              </p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-white">
                Ma bouteille
              </h2>
            </div>
            <span
              className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF907F]"
              data-mockup-pro-chip
            >
              Pro
            </span>
          </div>

          <p className="mb-3 text-[12px] leading-snug text-[#8E8E93]">
            Look cosmétique Pass Pro. Aucun avantage de jeu.
          </p>

          <BottleDragPanel
            kind="gourd"
            fillRatio={fillRatio}
            estimateMl={estimateMl}
            capacityMl={750}
          />

          <button
            type="button"
            className="ios-press mt-2 min-h-11 w-full rounded-2xl bg-[#FF0702] text-[15px] font-semibold text-white"
            data-mockup-add-water
          >
            Ajouter
          </button>

          <p
            className="mt-1.5 text-center text-[12px] leading-snug text-[#8E8E93]"
            data-mockup-no-face
          >
            Pas de visage sur la photo
          </p>
        </section>

        <p
          className="px-1 text-center text-[12px] text-[#8E8E93]"
          data-mockup-photo-meta
        >
          Photo prise le 12 oct. · Changer la photo
        </p>
      </div>
    </div>
  )
}
