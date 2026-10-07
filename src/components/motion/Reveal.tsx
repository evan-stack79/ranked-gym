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
  /** Stagger delay in ms (opacity/transform only). */
  delayMs?: number
  /** Force visible immediately (cold launch, tests). */
  instant?: boolean
}

/**
 * Soft fade + rise on first viewport entry (CSS + IntersectionObserver).
 * MIT-friendly: no paid libs. Disabled under prefers-reduced-motion.
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

  const classes = [
    'rg-reveal',
    inView ? 'rg-reveal--in' : '',
    skip ? 'rg-reveal--instant' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      ref={ref}
      className={classes}
      style={style}
      data-rg-reveal={inView ? 'in' : 'pending'}
      data-rg-motion={skip ? 'reduced' : 'on'}
    >
      {children}
    </Tag>
  )
}
