import { useState } from 'react'

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
 * Marque header compacte — fond transparent, cadrage serré (`brand:assets`).
 * Affichage CSS 38×38 → sources @2x / @3x pour netteté retina (pas de SVG photo).
 */
export const BRAND_MARK_COMPACT_SRC = '/brand-header-mark.png'
export const BRAND_MARK_COMPACT_SRC_2X = '/brand-header-mark@2x.png'
export const BRAND_MARK_COMPACT_SRC_3X = '/brand-header-mark@3x.png'
/** Taille CSS du mark compact (header Nutrition / Train). */
export const BRAND_MARK_COMPACT_CSS_PX = 38

const VARIANT = {
  compact: {
    size: BRAND_MARK_COMPACT_CSS_PX,
    src: BRAND_MARK_COMPACT_SRC,
    srcSet: `${BRAND_MARK_COMPACT_SRC_2X} 2x, ${BRAND_MARK_COMPACT_SRC_3X} 3x`,
    textClass: 'text-[17px] font-semibold tracking-tight',
    stackClass: 'flex-row items-center gap-2',
    taglineClass: 'text-[11px]',
  },
  hero: {
    size: 96,
    src: BRAND_MARK_HERO_SRC,
    srcSet: undefined as string | undefined,
    textClass: 'text-[22px] font-semibold tracking-tight',
    stackClass: 'flex-col items-center gap-3',
    taglineClass: 'text-[13px]',
  },
} as const

/**
 * Marque Ranked Gym : panthère calme + wordmark.
 * L’image est décorative (`alt=""`) — le nom reste dans le DOM.
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
  const markSrc = cfg.src
  const renderMark = showMark && !imageFailed

  return (
    <div
      className={`inline-flex ${cfg.stackClass} ${className}`.trim()}
      data-brand-mark={variant}
    >
      {renderMark ? (
        <img
          src={markSrc}
          srcSet={cfg.srcSet}
          width={size}
          height={size}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          onError={() => setImageFailed(true)}
          data-brand-mark-image={variant}
          className="brand-mark-image shrink-0 select-none object-contain"
          style={{
            width: size,
            height: size,
            filter: 'none',
            opacity: 1,
            transform: 'none',
          }}
        />
      ) : null}

      {showWordmark ? (
        <div
          className={
            variant === 'hero' ? 'flex flex-col items-center text-center' : 'min-w-0'
          }
        >
          <p
            className={`${cfg.textClass} text-white`}
            style={{ opacity: 1, filter: 'none', transform: 'none' }}
          >
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
