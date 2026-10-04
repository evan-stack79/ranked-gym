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
  /**
   * When true (default), blur clamps into [min, max].
   * Set false to avoid silent correction — parent shows a message instead.
   */
  clampOnBlur?: boolean
  /**
   * Strip spaces / unit suffixes (g, ml…) so paste like « 150 g » becomes 150.
   */
  sanitizeUnits?: boolean
  /**
   * Effort 1–10 : ne pas commit le préfixe ambigu « 1 » (vers « 10 ») tant que
   * l’utilisateur frappe / avant blur — évite l’auto-validate prématuré.
   */
  deferAmbiguousIntegerPrefix?: boolean
  /** Select all text on focus (handy when default is prefilled). */
  selectOnFocus?: boolean
  enterKeyHint?: 'done' | 'enter' | 'go' | 'next' | 'previous' | 'search' | 'send'
  'aria-label'?: string
}

/** Remove spaces / common unit suffixes before parsing a quantity. */
export function sanitizeQuantityRaw(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/(g|ml|gr|grammes?|mll?)$/i, '')
}

/**
 * Texte entier encore préfixe d’un autre entier dans [min, max]
 * (ex. « 1 » → « 10 » pour Effort). Décimaux exclus.
 */
export function isAmbiguousIntegerPrefix(raw: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(raw)) return false
  for (let d = 0; d <= 9; d += 1) {
    const candidate = Number.parseInt(`${raw}${d}`, 10)
    if (candidate >= min && candidate <= max) return true
  }
  return false
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
  clampOnBlur = true,
  sanitizeUnits = false,
  deferAmbiguousIntegerPrefix = false,
  selectOnFocus = false,
  enterKeyHint,
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
        enterKeyHint={enterKeyHint}
        autoComplete="off"
        aria-label={ariaLabel}
        value={text}
        placeholder={focused ? placeholder : undefined}
        onFocus={(e) => {
          setFocused(true)
          if (selectOnFocus) {
            const target = e.currentTarget
            window.requestAnimationFrame(() => target.select())
          }
        }}
        onChange={(e) => {
          const raw = sanitizeUnits
            ? sanitizeQuantityRaw(e.target.value)
            : e.target.value.replace(',', '.')
          if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
          setText(raw)
          if (raw === '' || raw === '.') {
            if (!required) onChange(null)
            return
          }
          if (deferAmbiguousIntegerPrefix && isAmbiguousIntegerPrefix(raw, min, max)) {
            return
          }
          const next = parseFloat(raw)
          if (!Number.isNaN(next)) onChange(next)
        }}
        onBlur={() => {
          setFocused(false)
          const parsed = parseFloat(text)
          if (text === '' || text === '.' || Number.isNaN(parsed)) {
            if (required) {
              setText(formatValue(value, step))
              return
            }
            onChange(null)
            setText('')
            return
          }
          if (!clampOnBlur) {
            onChange(parsed)
            setText(formatValue(parsed, step))
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
