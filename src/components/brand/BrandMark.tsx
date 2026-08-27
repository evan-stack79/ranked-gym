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

/** Asset PWA léger — jamais le master 1254 px. */
export const BRAND_MARK_SRC = '/pwa-192x192.png'

const VARIANT = {
  compact: {
    size: 30,
    textClass: 'text-[17px] font-semibold tracking-tight',
    stackClass: 'flex-row items-center gap-2',
    taglineClass: 'text-[11px]',
  },
  hero: {
    size: 96,
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
  const renderMark = showMark && !imageFailed

  return (
    <div
      className={`inline-flex ${cfg.stackClass} ${className}`.trim()}
      data-brand-mark={variant}
    >
      {renderMark ? (
        <img
          src={BRAND_MARK_SRC}
          width={size}
          height={size}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          onError={() => setImageFailed(true)}
          className="shrink-0 select-none object-contain"
          style={{ width: size, height: size }}
        />
      ) : null}

      {showWordmark ? (
        <div
          className={
            variant === 'hero' ? 'flex flex-col items-center text-center' : 'min-w-0'
          }
        >
          <p className={`${cfg.textClass} text-white`}>
            Ranked <span className="text-[#FF2B2B]">Gym</span>
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
