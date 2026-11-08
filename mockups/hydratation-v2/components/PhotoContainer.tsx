import type { CSSProperties } from 'react'
import wet15 from '../assets/cutouts/wet_bottle_15.png'
import wet50 from '../assets/cutouts/wet_bottle_50.png'
import wetGlass from '../assets/cutouts/wet_glass_25.png'
import wetGourd from '../assets/cutouts/wet_gourde.png'

export type PhotoKind = 'plastic_15' | 'small_50' | 'glass_25' | 'gourd'

/** Photos avec eau pré-composée (niveaux maquette). */
const WET: Record<PhotoKind, string> = {
  plastic_15: wet15,
  small_50: wet50,
  glass_25: wetGlass,
  gourd: wetGourd,
}

/**
 * Zone remplissable (hors bouchon / col / base).
 * fillRatio = ml/capacité → hauteur d’eau dans cette zone utile.
 */
const FILLABLE: Record<PhotoKind, { topInset: number; bottomInset: number }> = {
  plastic_15: { topInset: 0.155, bottomInset: 0.035 },
  small_50: { topInset: 0.14, bottomInset: 0.04 },
  glass_25: { topInset: 0.06, bottomInset: 0.12 },
  gourd: { topInset: 0.12, bottomInset: 0.03 },
}

/** Niveaux d’eau bakés dans les PNG wet_* (doivent matcher l’écran). */
const BAKED_FILL: Record<PhotoKind, number> = {
  plastic_15: 620 / 1500,
  small_50: 0.35,
  glass_25: 0.55,
  gourd: 480 / 750,
}

/** Hauteur depuis le bas (0–1) de la surface de l’eau. */
export function waterSurfaceFromBottom(kind: PhotoKind, fillRatio: number): number {
  const { topInset, bottomInset } = FILLABLE[kind]
  const useful = 1 - topInset - bottomInset
  const r = Math.min(1, Math.max(0, fillRatio))
  return bottomInset + r * useful
}

/**
 * Contenant photo détouré avec eau déjà composée dans le PNG
 * (translucide, ménisque, reflets conservés). Poignée sur la surface.
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
  // Utilise le niveau baké du PNG (maquette statique) — fillRatio doit matcher.
  const ratio = BAKED_FILL[kind]
  void fillRatio
  const surface = waterSurfaceFromBottom(kind, ratio)
  const waterPct = `${Math.round(surface * 1000) / 10}%`
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
      data-water-surface={surface.toFixed(3)}
    >
      <div className="relative mx-auto h-full w-fit">
        <img
          src={WET[kind]}
          alt=""
          draggable={false}
          className="relative z-0 h-full w-auto select-none object-contain"
          data-mockup-water-fill
        />

        {/* marqueur invisible pour asserts ménisque / surface */}
        <span
          className="pointer-events-none absolute inset-x-0 z-[1] h-0"
          style={{ bottom: waterPct } as CSSProperties}
          data-mockup-meniscus
          aria-hidden
        />

        {showHandle ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-[3] h-5"
            style={{ bottom: `calc(${waterPct} - 10px)` }}
            data-mockup-drag-handle
          >
            <div className="relative mx-auto h-5 w-[78%]">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#5AC8FA]/85" />
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
  void fillRatio
  return (
    <div className="flex h-[64px] items-end justify-center" aria-hidden>
      <PhotoContainer kind={kind} fillRatio={BAKED_FILL[kind]} size="thumb" />
    </div>
  )
}
