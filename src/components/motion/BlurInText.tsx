import {
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

/** Max stagger between title words (ms). */
export const BLUR_WORD_STAGGER_MS = 60

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
  const parts = text.trim().split(/(\s+)/)
  const words: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part || /^\s+$/.test(part)) continue
    const trailingSpace = i + 1 < parts.length && /^\s+$/.test(parts[i + 1] ?? '')
    words.push(trailingSpace ? `${part} ` : part)
  }
  return words.length > 0 ? words : text ? [text] : []
}

/**
 * Title blur → sharp entrance, word by word (opacity + blur(8px) + translateY(4px)).
 * Full text stays accessible via aria-label + visually-hidden copy; animated spans are aria-hidden.
 * Final settled state always has filter: none, opacity 1, transform: none.
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

  useEffect(() => {
    if (skip) setSettled(true)
  }, [skip])

  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      // Wait for the last word; ignore bubbled ends from earlier words.
      const el = event.target as HTMLElement
      if (!el.classList.contains('rg-blur-word')) return
      const host = event.currentTarget
      const all = host.querySelectorAll('.rg-blur-word')
      const last = all[all.length - 1]
      if (el === last) setSettled(true)
    },
    [],
  )

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
      aria-label={fullText || undefined}
      data-rg-blur={settled ? 'settled' : inView ? 'in' : 'pending'}
      data-rg-motion={skip ? 'reduced' : 'on'}
    >
      <span className="sr-only">{fullText}</span>
      <span aria-hidden="true" className="rg-blur-words">
        {words.map((word, index) => (
          <span
            key={`${index}-${word}`}
            className="rg-blur-word"
            style={
              {
                '--rg-word-delay': skip
                  ? '0ms'
                  : `${delayMs + index * BLUR_WORD_STAGGER_MS}ms`,
              } as CSSProperties
            }
          >
            {word}
          </span>
        ))}
      </span>
    </Tag>
  )
}
