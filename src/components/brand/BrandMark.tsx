import { useState } from 'react'
import { BrandMarkSvg, BRAND_MARK_COMPACT_CSS_PX } from './BrandMarkSvg'

export type BrandMarkVariant = 'compact' | 'hero'

export interface BrandMarkProps {
  /** `compact` = header ; `hero` = boot / splash UI. */
  variant?: BrandMarkVariant
  className?: string
  /**
   * Promesse sous le wordmark (boot uniquement).
   * Ne pas passer cette prop dans le header.
   */
  tagline?: string
  /** Affiche la panthère (défaut `true`). */
  showMark?: boolean
  /** Affiche « Ranked Gym » (défaut `true`). */
  showWordmark?: boolean
}

/** Asset PWA — boot / hero uniquement. */
export const BRAND_MARK_HERO_SRC = '/pwa-192x192.png'
/**
 * @deprecated Legacy PNG densités — le header compact utilise désormais un SVG inline.
 * Conservé pour les écrans immersifs qui importent encore la constante.
 */
export const BRAND_MARK_COMPACT_SRC = '/brand-header-mark.png'
export const BRAND_MARK_COMPACT_SRC_2X = '/brand-header-mark@2x.png'
export const BRAND_MARK_COMPACT_SRC_3X = '/brand-header-mark@3x.png'
export const BRAND_MARK_COMPACT_SRC_4X = '/brand-header-mark@4x.png'
export { BRAND_MARK_COMPACT_CSS_PX }

const VARIANT = {
  compact: {
    size: BRAND_MARK_COMPACT_CSS_PX,
    textClass: 'text-[17px] font-semibold tracking-tight text-white',
    stackClass: 'flex-row items-center gap-2',
    taglineClass: 'text-[11px]',
  },
  hero: {
    size: 96,
    src: BRAND_MARK_HERO_SRC,
    textClass: 'text-[22px] font-semibold tracking-tight text-white',
    stackClass: 'flex-col items-center gap-3',
    taglineClass: 'text-[13px]',
  },
} as const

/**
 * Marque Ranked Gym : panthère + wordmark texte réel (pas d’image wordmark).
 * Compact = SVG vectoriel inline (pas de PNG soft / srcSet).
 * Hero = raster PWA pour le splash.
 */
export function BrandMark({
  variant = 'compact',
  className = '',
  tagline,
  showMark = true,
  showWordmark = true,
}: BrandMarkProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const cfg = VARIANT[variant]
  const size = cfg.size
  const renderMark = showMark && !(variant === 'hero' && imageFailed)

  return (
    <div
      className={`inline-flex ${cfg.stackClass} ${className}`.trim()}
      data-brand-mark={variant}
    >
      {renderMark ? (
        variant === 'compact' ? (
          <BrandMarkSvg
            size={size}
            className="brand-mark-svg shrink-0 select-none"
          />
        ) : (
          <img
            src={cfg.src}
            width={size}
            height={size}
            alt=""
            aria-hidden="true"
            decoding="async"
            draggable={false}
            onError={() => setImageFailed(true)}
            data-brand-mark-image={variant}
            className="brand-mark-image shrink-0 select-none object-contain"
            style={{ width: size, height: size }}
          />
        )
      ) : null}

      {showWordmark ? (
        <div
          className={
            variant === 'hero' ? 'flex flex-col items-center text-center' : 'min-w-0'
          }
        >
          <p className={cfg.textClass} data-brand-wordmark-line={variant}>
            <span data-brand-wordmark={variant}>
              Ranked <span className="text-[#FF2B2B]">Gym</span>
            </span>
          </p>
          {tagline ? (
            <p
              className={`mt-1 max-w-[20rem] truncate font-medium tracking-tight text-[#8E8E93] ${cfg.taglineClass}`}
            >
              {tagline}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
