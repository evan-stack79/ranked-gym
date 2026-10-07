import {
  useCallback,
  useEffect,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import { useInViewOnce } from '../../hooks/useInViewOnce'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export interface SoftBlurInProps {
  children: ReactNode
  className?: string
  as?: ElementType
  delayMs?: number
  instant?: boolean
}

/**
 * Soft Blur In — small texts / subtitles (whole line).
 * Gentler: opacity + blur(4px) + translateY(4px), ~400ms.
 * Disabled under prefers-reduced-motion (final state immediately).
 */
export function SoftBlurIn({
  children,
  className = '',
  as: Tag = 'span',
  delayMs = 0,
  instant = false,
}: SoftBlurInProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const { ref, inView } = useInViewOnce<HTMLElement>({ instant: skip })
  const [settled, setSettled] = useState(skip)

  useEffect(() => {
    if (skip) setSettled(true)
  }, [skip])

  const onAnimationEnd = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) setSettled(true)
  }, [])

  const style: CSSProperties | undefined =
    !skip && delayMs > 0
      ? ({ '--rg-soft-blur-delay': `${delayMs}ms` } as CSSProperties)
      : undefined

  const classes = [
    'rg-soft-blur',
    inView ? 'rg-soft-blur--in' : '',
    skip || settled ? 'rg-soft-blur--settled' : '',
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
      data-rg-soft-blur={settled ? 'settled' : inView ? 'in' : 'pending'}
      data-rg-motion={skip ? 'reduced' : 'on'}
    >
      {children}
    </Tag>
  )
}
