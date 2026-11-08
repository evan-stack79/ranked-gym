import bottle15 from '../assets/cutouts/shell_bottle_15.png'
import bottle50 from '../assets/cutouts/shell_bottle_50.png'
import glass25 from '../assets/cutouts/shell_glass.png'
import gourde from '../assets/cutouts/shell_gourde.png'

export type PhotoKind = 'plastic_15' | 'small_50' | 'glass_25' | 'gourd'

const SRC: Record<PhotoKind, string> = {
  plastic_15: bottle15,
  small_50: bottle50,
  glass_25: glass25,
  gourd: gourde,
}

/**
 * Contenant photo détouré + eau masquée au bon ratio.
 * Poignée collée à la surface de l'eau (ligne + pastille + trait).
 */
export function PhotoContainer({
  kind,
  fillRatio,
  size = 'large',
  showHandle = false,
  handleLabel = 'glisse pour régler',
}: {
  kind: PhotoKind
  fillRatio: number
  size?: 'large' | 'thumb'
  showHandle?: boolean
  handleLabel?: string
}) {
  const ratio = Math.min(1, Math.max(0, fillRatio))
  const waterPct = `${Math.round(ratio * 1000) / 10}%`
  const isThumb = size === 'thumb'
  const heightClass =
    kind === 'gourd'
      ? isThumb
        ? 'h-[56px]'
        : 'h-[176px]'
      : kind === 'glass_25'
        ? isThumb
          ? 'h-[52px]'
          : 'h-[156px]'
        : kind === 'small_50'
          ? isThumb
            ? 'h-[52px]'
            : 'h-[156px]'
          : isThumb
            ? 'h-[58px]'
            : 'h-[176px]'

  return (
    <div
      className={`relative mx-auto ${heightClass} ${isThumb ? 'w-auto' : 'w-full max-w-[200px]'}`}
      data-mockup-photo-container={kind}
      data-fill-ratio={ratio.toFixed(3)}
    >
      <div className="relative mx-auto h-full w-fit">
        {/* Eau clipée à la silhouette */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: `url(${SRC[kind]})`,
            maskImage: `url(${SRC[kind]})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center bottom',
            maskPosition: 'center bottom',
          }}
          aria-hidden
        >
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: waterPct,
              background:
                kind === 'gourd'
                  ? 'linear-gradient(180deg, rgba(90,200,250,0.62) 0%, rgba(10,132,255,0.48) 100%)'
                  : 'linear-gradient(180deg, rgba(160,230,255,0.72) 0%, rgba(70,180,235,0.70) 40%, rgba(10,132,255,0.58) 100%)',
            }}
          />
          {/* ménisque sobre */}
          <div
            className="absolute inset-x-[12%] h-px bg-white/35"
            style={{ bottom: waterPct }}
          />
        </div>

        <img
          src={SRC[kind]}
          alt=""
          draggable={false}
          className="relative z-[1] h-full w-auto select-none object-contain"
        />

        {showHandle ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-[2] h-5"
            style={{ bottom: `calc(${waterPct} - 10px)` }}
            data-mockup-drag-handle
          >
            {/* ligne au niveau de l'eau + pastille + graduation */}
            <div className="relative mx-auto h-5 w-[78%]">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#5AC8FA]/80" />
              <span className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-[#5AC8FA]" />
              <span className="absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-[#5AC8FA]/85 bg-[#0B0B0D]">
                <span className="h-2 w-2 rounded-full bg-[#5AC8FA]" />
              </span>
              <span className="absolute left-[calc(100%+12px)] top-1/2 w-[5.5rem] -translate-y-1/2 text-[10px] font-medium leading-snug text-[#ACB4BA]">
                {handleLabel}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function PhotoThumb({
  kind,
  fillRatio,
}: {
  kind: Exclude<PhotoKind, 'gourd'>
  fillRatio: number
}) {
  return (
    <div className="flex h-[64px] items-end justify-center" aria-hidden>
      <PhotoContainer kind={kind} fillRatio={fillRatio} size="thumb" />
    </div>
  )
}
