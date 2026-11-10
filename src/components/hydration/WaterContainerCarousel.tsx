import { useEffect, useRef } from 'react'
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

export function WaterContainerCarousel({
  mode,
  proActive,
  onSelect,
  onRequestPro,
}: WaterContainerCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const selectedIndex = Math.max(0, WATER_SETTINGS_CAROUSEL_ORDER.indexOf(mode))

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const tile = root.querySelector<HTMLElement>(`[data-hydration-carousel-tile="${mode}"]`)
    tile?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [mode])

  return (
    <div data-hydration-carousel className="space-y-3">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {WATER_SETTINGS_CAROUSEL_ORDER.map((id) => {
          const selected = mode === id
          const shell = shellForMode(id)
          const pro = id === 'my_bottle'
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
              className={`relative flex w-[148px] shrink-0 snap-center flex-col items-center justify-end rounded-[26px] border pb-4 pt-3 ${
                selected
                  ? 'h-[232px] w-[186px] border-2 border-[#FF0702] bg-[#FF0702]/10'
                  : 'h-[192px] border border-white/10 bg-[#25282A] opacity-50'
              }`}
            >
              <div
                className={`relative ${
                  id === 'glasses_250'
                    ? selected
                      ? 'h-24 w-14'
                      : 'h-20 w-12'
                    : selected
                      ? 'h-[146px] w-11'
                      : 'h-[126px] w-10'
                }`}
              >
                <img
                  src={shell}
                  alt=""
                  draggable={false}
                  className="relative z-0 h-full w-full object-contain"
                />
                {id !== 'my_bottle' || !pro ? (
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
                        height: selected ? '70%' : '60%',
                        background:
                          'linear-gradient(to top, rgba(40,120,205,0.92), rgba(120,200,245,0.78))',
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <b
                className={`mt-3 text-white ${selected ? 'text-[18px]' : 'text-[15px]'}`}
              >
                {carouselTitleForMode(id)}
              </b>
              <span className="mt-0.5 text-[13px] text-[#ACB4BA]">
                {pro ? (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF907F]">
                    PRO
                  </span>
                ) : (
                  carouselDetailForMode(id)
                )}
              </span>
              {selected ? (
                <span
                  className="absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FF0702]"
                  aria-hidden
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-1.5" aria-hidden>
        {WATER_SETTINGS_CAROUSEL_ORDER.map((id, i) => (
          <i
            key={id}
            className={
              i === selectedIndex
                ? 'h-[7px] w-5 rounded bg-[#FF0702]'
                : 'h-[7px] w-[7px] rounded-full bg-[#42484C]'
            }
          />
        ))}
      </div>
    </div>
  )
}
