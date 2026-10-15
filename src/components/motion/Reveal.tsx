import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import { useInViewOnce } from '../../hooks/useInViewOnce'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export interface RevealProps {
  children: ReactNode
  className?: string
  /** Polymorphic wrapper — default `div`. */
  as?: ElementType
  /** Stagger delay in ms (keep ≤80ms between sibling cards). */
  delayMs?: number
  /** Force visible immediately (cold launch, tests). */
  instant?: boolean
}

/**
 * Mask Reveal Up — cards: clip-path inset bottom→top + slight translateY.
 * Inspired by Animata / Magic UI (MIT), pure CSS. No opacity fade on brand logo.
 * Stagger via delayMs (≤80ms). Disabled under prefers-reduced-motion.
 *
 * Clip-path lives on an *inner* mask so IntersectionObserver watches an
 * unclipped layout box. Observing a fully inset(100%) node reports ratio 0
 * forever in Chromium/WebKit — heroes stayed invisible after Accueil remount.
 */
export function Reveal({
  children,
  className = '',
  as: Tag = 'div',
  delayMs = 0,
  instant = false,
}: RevealProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const { ref, inView } = useInViewOnce<HTMLElement>({ instant: skip })

  const style: CSSProperties | undefined =
    !skip && delayMs > 0
      ? ({ '--rg-reveal-delay': `${delayMs}ms` } as CSSProperties)
      : undefined

  const maskClasses = [
    'rg-mask-reveal',
    inView ? 'rg-mask-reveal--in' : '',
    skip ? 'rg-mask-reveal--instant' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      ref={ref}
      className={className}
      data-rg-reveal={inView ? 'in' : 'pending'}
      data-rg-reveal-variant="mask-up"
      data-rg-motion={skip ? 'reduced' : 'on'}
    >
      <div className={maskClasses} style={style}>
        {children}
      </div>
    </Tag>
  )
}

/** Alias matching Evan’s naming (Mask Reveal Up). */
export const MaskReveal = Reveal
