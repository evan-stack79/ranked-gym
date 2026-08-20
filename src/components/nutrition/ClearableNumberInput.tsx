import { useEffect, useState } from 'react'

interface ClearableNumberInputProps {
  value: number | null
  onChange: (value: number | null) => void
  min: number
  max: number
  step?: number
  className?: string
  placeholder?: string
  placeholderClassName?: string
  /** When true (default), empty blur restores the last known value. */
  required?: boolean
  'aria-label'?: string
}

/**
 * Number field that can be fully cleared while typing.
 * Clamps to min/max only on blur. Supports Apple-style gray placeholders.
 */
export function ClearableNumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
  placeholder,
  placeholderClassName,
  required = true,
  'aria-label': ariaLabel,
}: ClearableNumberInputProps) {
  const [text, setText] = useState(() => formatValue(value, step))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatValue(value, step))
  }, [value, focused, step])

  const showPlaceholder = Boolean(placeholder) && text === '' && !focused

  return (
    <div className="relative w-full">
      {showPlaceholder && (
        <span
          className={
            placeholderClassName ??
            'pointer-events-none absolute inset-0 flex items-center text-[28px] font-bold tracking-tight text-[#636366]'
          }
          aria-hidden="true"
        >
          {placeholder}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={text}
        placeholder={focused ? placeholder : undefined}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.')
          if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
          setText(raw)
          if (raw === '' || raw === '.') {
            if (!required) onChange(null)
            return
          }
          const next = Number(raw)
          if (!Number.isNaN(next)) onChange(next)
        }}
        onBlur={() => {
          setFocused(false)
          const parsed = Number(text)
          if (text === '' || text === '.' || Number.isNaN(parsed)) {
            if (required) {
              setText(formatValue(value, step))
              return
            }
            onChange(null)
            setText('')
            return
          }
          const clamped = clamp(parsed, min, max, step)
          onChange(clamped)
          setText(formatValue(clamped, step))
        }}
        className={`${className ?? ''} ${showPlaceholder ? 'caret-white' : ''}`}
      />
    </div>
  )
}

function formatValue(value: number | null, step?: number): string {
  if (value == null || !Number.isFinite(value)) return ''
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
