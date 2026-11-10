import type { HydrationMode } from '../../shared/hydration'
import {
  WATER_SETTINGS_CAROUSEL_ORDER,
  carouselDetailForMode,
  carouselTitleForMode,
  shellForMode,
} from '../../utils/hydrationModeDisplay'

interface WaterContainerCarouselProps {
  mode: HydrationMode
  proActive: boolean
  onSelect: (mode: HydrationMode) => void
  onRequestPro: () => void
}

/**
 * Rangée de 4 tuiles entières (390 px) — tap = sélection.
 * Plus de carrousel scrollable (évite les tuiles tronquées).
 */
export function WaterContainerCarousel({
  mode,
  proActive,
  onSelect,
  onRequestPro,
}: WaterContainerCarouselProps) {
  return (
    <div data-hydration-carousel className="w-full min-w-0">
      <div className="grid w-full grid-cols-4 gap-1.5">
        {WATER_SETTINGS_CAROUSEL_ORDER.map((id) => {
          const selected = mode === id
          const shell = shellForMode(id)
          const pro = id === 'my_bottle'
          const title = carouselTitleForMode(id)
          const detail = carouselDetailForMode(id)
          return (
            <button
              key={id}
              type="button"
              data-hydration-carousel-tile={id}
              data-hydration-mode-option={id}
              onClick={() => {
                if (pro && !proActive) {
                  onRequestPro()
                  return
                }
                onSelect(id)
              }}
              className={`relative flex min-w-0 flex-col items-center rounded-2xl border px-1 pb-2 pt-2 ${
                selected
                  ? 'border-2 border-[#FF0702] bg-[#FF0702]/10'
                  : 'border border-white/10 bg-[#25282A]'
              }`}
            >
              {selected ? (
                <span
                  className="absolute right-1 top-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF0702]"
                  aria-hidden
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              ) : null}
              <div
                className={`relative shrink-0 ${
                  id === 'glasses_250' ? 'h-14 w-8' : 'h-14 w-7'
                }`}
              >
                <img
                  src={shell}
                  alt=""
                  draggable={false}
                  className="relative z-0 h-full w-full object-contain"
                />
                {id !== 'my_bottle' ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
                    style={{
                      WebkitMaskImage: `url(${shell})`,
                      maskImage: `url(${shell})`,
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                    }}
                    aria-hidden
                  >
                    <div
                      className="absolute inset-x-0 bottom-0"
                      style={{
                        height: selected ? '70%' : '55%',
                        background:
                          'linear-gradient(to top, rgba(40,120,205,0.92), rgba(120,200,245,0.78))',
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <span className="mt-1.5 w-full text-center text-[11px] font-semibold leading-tight text-white">
                {title}
              </span>
              <span className="mt-0.5 min-h-[12px] w-full text-center text-[10px] leading-tight text-[#ACB4BA]">
                {pro ? (
                  <span className="font-semibold uppercase tracking-wide text-[#FF907F]">PRO</span>
                ) : (
                  detail.trim() || '\u00a0'
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
