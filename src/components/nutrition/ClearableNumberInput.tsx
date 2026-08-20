import { useEffect, useState } from 'react'

interface ClearableNumberInputProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  className?: string
  'aria-label'?: string
}

/**
 * Number field that can be fully cleared while typing.
 * Clamps to min/max only on blur (so you can wipe "78" and type "65").
 */
export function ClearableNumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
  'aria-label': ariaLabel,
}: ClearableNumberInputProps) {
  const [text, setText] = useState(() => formatValue(value, step))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatValue(value, step))
  }, [value, focused, step])

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.')
        // Allow scale-precise values like 61.05 while typing
        if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
        setText(raw)
        if (raw === '' || raw === '.') return
        const next = Number(raw)
        if (!Number.isNaN(next)) onChange(next)
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = Number(text)
        if (text === '' || text === '.' || Number.isNaN(parsed)) {
          setText(formatValue(value, step))
          return
        }
        const clamped = clamp(parsed, min, max, step)
        onChange(clamped)
        setText(formatValue(clamped, step))
      }}
      className={className}
    />
  )
}

function formatValue(value: number, step?: number): string {
  if (!Number.isFinite(value)) return ''
  if (step != null && step > 0 && step < 1) {
    const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 2
    return Number(value.toFixed(decimals)).toString()
  }
  return String(value)
}

function clamp(value: number, min: number, max: number, step?: number): number {
  let next = Math.min(max, Math.max(min, value))
  if (step && step > 0) {
    const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0
    next = Math.round(next / step) * step
    next = Number(next.toFixed(decimals))
    next = Math.min(max, Math.max(min, next))
  }
  return next
}
