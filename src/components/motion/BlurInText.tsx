import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import { useInViewOnce } from '../../hooks/useInViewOnce'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export interface BlurInTextProps {
  children: ReactNode
  className?: string
  /** Polymorphic text host — default `span`. */
  as?: ElementType
  delayMs?: number
  instant?: boolean
}

/**
 * Title blur → sharp entrance (filter only while animating).
 * Final settled state always has filter: none, opacity 1, transform: none.
 */
export function BlurInText({
  children,
  className = '',
  as: Tag = 'span',
  delayMs = 0,
  instant = false,
}: BlurInTextProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const { ref, inView } = useInViewOnce<HTMLElement>({ instant: skip })
  const [settled, setSettled] = useState(skip)

  useEffect(() => {
    if (skip) setSettled(true)
  }, [skip])

  const onAnimationEnd = useCallback(() => {
    setSettled(true)
  }, [])

  const style: CSSProperties | undefined =
    !skip && delayMs > 0
      ? ({ '--rg-blur-delay': `${delayMs}ms` } as CSSProperties)
      : undefined

  const classes = [
    'rg-blur-in',
    inView ? 'rg-blur-in--in' : '',
    skip || settled ? 'rg-blur-in--settled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      ref={ref}
      className={classes}
      style={style}
      onAnimationEnd={onAnimationEnd}
      data-rg-blur={settled ? 'settled' : inView ? 'in' : 'pending'}
      data-rg-motion={skip ? 'reduced' : 'on'}
    >
      {children}
    </Tag>
  )
}
