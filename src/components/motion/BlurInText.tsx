import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import { useInViewOnce } from '../../hooks/useInViewOnce'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

/** Default stagger between title words (ms). Hard cap ≤80. */
export const BLUR_WORD_STAGGER_MS = 50
/** Per-word animation duration — total title time stays ≤600ms. */
export const BLUR_WORD_DUR_MS = 400
export const BLUR_IN_UP_TOTAL_MAX_MS = 600

export interface BlurInTextProps {
  children: ReactNode
  className?: string
  /** Polymorphic text host — default `span`. */
  as?: ElementType
  delayMs?: number
  instant?: boolean
  /** Explicit accessible string when children are not plain text. */
  label?: string
}

function textFromChildren(children: ReactNode): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textFromChildren).join('')
  return ''
}

function splitWords(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length > 0 ? words : text ? [text] : []
}

/** Compress stagger so (n-1)*stagger + wordDur ≤ 600ms. */
export function blurInUpTiming(wordCount: number): { durationMs: number; staggerMs: number } {
  const n = Math.max(1, wordCount)
  const durationMs = BLUR_WORD_DUR_MS
  if (n <= 1) return { durationMs, staggerMs: 0 }
  const budget = Math.max(0, BLUR_IN_UP_TOTAL_MAX_MS - durationMs)
  const staggerMs = Math.min(BLUR_WORD_STAGGER_MS, Math.floor(budget / (n - 1)))
  return { durationMs, staggerMs }
}

/**
 * Blur In Up — big titles (h1 / main section titles).
 * Word-by-word: opacity 0 + blur(10px) + translateY(12px) → clear.
 * Total ≤600ms. Accessible via aria-label + sr-only; animated spans aria-hidden.
 */
export function BlurInText({
  children,
  className = '',
  as: Tag = 'span',
  delayMs = 0,
  instant = false,
  label,
}: BlurInTextProps) {
  const reduced = usePrefersReducedMotion()
  const skip = instant || reduced
  const { ref, inView } = useInViewOnce<HTMLElement>({ instant: skip })
  const [settled, setSettled] = useState(skip)

  const fullText = useMemo(
    () => (label?.trim() ? label : textFromChildren(children)).trim(),
    [label, children],
  )
  const words = useMemo(() => splitWords(fullText), [fullText])
  const timing = useMemo(() => blurInUpTiming(words.length), [words.length])

  useEffect(() => {
    if (skip) setSettled(true)
  }, [skip])

  const onAnimationEnd = useCallback((event: AnimationEvent<HTMLElement>) => {
    const el = event.target as HTMLElement
    if (!el.classList.contains('rg-blur-word')) return
    const host = event.currentTarget
    const all = host.querySelectorAll('.rg-blur-word')
    const last = all[all.length - 1]
    if (el === last) setSettled(true)
  }, [])

  const style: CSSProperties = {
    '--rg-word-dur': `${timing.durationMs}ms`,
    ...( !skip && delayMs > 0 ? { '--rg-blur-delay': `${delayMs}ms` } : {}),
  } as CSSProperties

  const classes = [
    'rg-blur-in',
    'rg-blur-in-up',
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
      aria-label={fullText || undefined}
      data-rg-blur={settled ? 'settled' : inView ? 'in' : 'pending'}
      data-rg-blur-variant="up"
      data-rg-motion={skip ? 'reduced' : 'on'}
    >
      <span className="sr-only">{fullText}</span>
      <span aria-hidden="true" className="rg-blur-words">
        {words.map((word, index) => (
          <Fragment key={`${index}-${word}`}>
            <span
              className="rg-blur-word"
              style={
                {
                  '--rg-word-delay': skip
                    ? '0ms'
                    : `${delayMs + index * timing.staggerMs}ms`,
                } as CSSProperties
              }
            >
              {word}
            </span>
            {index < words.length - 1 ? ' ' : null}
          </Fragment>
        ))}
      </span>
    </Tag>
  )
}

/** Alias matching Evan’s naming (Blur In Up). */
export const BlurInUp = BlurInText
