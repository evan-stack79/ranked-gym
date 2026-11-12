import { useEffect, useRef } from 'react'

const GRAY = '#ACB4BA'
const ITEM_H = 44
const PAD_H = 68

export const SLEEP_WHEEL_ITEM_H = ITEM_H

/** Index → scrollTop (pad + item centers align when scrollTop = idx × ITEM_H). */
export function sleepWheelScrollTopForIndex(index: number): number {
  return index * ITEM_H
}

export function sleepWheelIndexFromScrollTop(scrollTop: number, count: number): number {
  const idx = Math.round(scrollTop / ITEM_H)
  return Math.max(0, Math.min(count - 1, idx))
}

/** Lit la valeur centrée dans une colonne (source de vérité au commit). */
export function readSleepWheelCenteredValue(
  column: HTMLElement | null,
  values: number[],
): number | null {
  if (!column || values.length === 0) return null
  const idx = sleepWheelIndexFromScrollTop(column.scrollTop, values.length)
  return values[idx] ?? null
}

/**
 * Roue HH/MM — le scroll doit mettre à jour la valeur (pas seulement le clic).
 * Bug : snap CSS sans onScroll → Enregistrer gardait l’ancienne minute
 * (ex. 6:55 scrollé visuellement à 6:15 mais sauvegardé 6:55).
 */
export function SleepTimeWheelColumn({
  values,
  value,
  onChange,
  ariaLabel,
}: {
  values: number[]
  value: number
  onChange: (n: number) => void
  ariaLabel: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const suppressScrollSync = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const idx = values.indexOf(value)
    if (idx < 0) return
    const nextTop = sleepWheelScrollTopForIndex(idx)
    if (Math.abs(el.scrollTop - nextTop) < 1) return
    suppressScrollSync.current = true
    el.scrollTop = nextTop
    requestAnimationFrame(() => {
      suppressScrollSync.current = false
    })
  }, [value, values])

  return (
    <div
      ref={ref}
      className="relative h-[180px] w-[72px] overflow-y-auto snap-y snap-mandatory"
      style={{ scrollbarWidth: 'none' }}
      aria-label={ariaLabel}
      role="listbox"
      data-sleep-wheel-column
      onScroll={() => {
        if (suppressScrollSync.current) return
        const el = ref.current
        if (!el) return
        const next = readSleepWheelCenteredValue(el, values)
        if (next != null && next !== valueRef.current) onChange(next)
      }}
    >
      <div aria-hidden style={{ height: PAD_H }} />
      {values.map((n) => {
        const selected = n === value
        return (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={selected}
            data-sleep-wheel-option={n}
            onClick={() => onChange(n)}
            className="flex w-full snap-center items-center justify-center tabular-nums"
            style={{
              height: ITEM_H,
              color: selected ? '#FFFFFF' : GRAY,
              fontSize: selected ? 28 : 22,
              fontWeight: selected ? 600 : 400,
              opacity: selected ? 1 : 0.45,
            }}
          >
            {String(n).padStart(2, '0')}
          </button>
        )
      })}
      <div aria-hidden style={{ height: PAD_H }} />
    </div>
  )
}
