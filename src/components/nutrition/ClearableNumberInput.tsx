import { useEffect, useRef, useState } from 'react'
import {
  type SetFieldKind,
  validateTrainSetNumber,
} from '../../utils/autoValidateSet'

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
   * With `fieldKind`, out-of-range / non-finite values are refused (same as Valider).
   */
  clampOnBlur?: boolean
  /**
   * Train field kind — blur/flush use `validateTrainSetNumber` (same rules as Valider).
   * Required for kg/reps/effort when `clampOnBlur` is false.
   */
  fieldKind?: SetFieldKind
  /**
   * Strip spaces / unit suffixes (g, ml…) so paste like « 150 g » becomes 150.
   */
  sanitizeUnits?: boolean
  /**
   * Effort 1–10 : ne pas commit le préfixe ambigu « 1 » (vers « 10 ») tant que
   * l’utilisateur frappe / avant blur — évite l’auto-validate prématuré.
   */
  deferAmbiguousIntegerPrefix?: boolean
  /**
   * When true, numeric values are committed only on blur (local string while typing).
   * Empty still reports null immediately when `required` is false.
   */
  commitOnBlur?: boolean
  /**
   * Legacy: commit a complete valid number on every keystroke.
   * Prefer `commitOnBlur` for Train (Architect) — Valider/Terminer call
   * `flushPendingClearableNumberInputs()` first.
   */
  commitOnInput?: boolean
  /** Select all text on focus (handy when default is prefilled). */
  selectOnFocus?: boolean
  /** Called on focus — e.g. apply « dernière fois » placeholders into the value. */
  onFocus?: () => void
  /** After internal blur commit/restore — e.g. Train auto-validate. */
  onBlur?: () => void
  enterKeyHint?: 'done' | 'enter' | 'go' | 'next' | 'previous' | 'search' | 'send'
  'aria-label'?: string
}

type PendingCommit = () => void

/** Focused Train fields — Valider / Terminer flush before reading parent state. */
const pendingCommits = new Set<PendingCommit>()

/** Set when a flush/blur refused an out-of-range or non-finite commit. */
let pendingCommitRejected = false

/**
 * Applique le même commit que blur sur toutes les cases encore focalisées.
 * Train (`fieldKind`) : vide → null (pas de restore). Nutrition required : restore.
 * Sans callback `onBlur` parent.
 * @returns `false` si au moins un commit a été refusé (hors bornes / non-fini).
 */
export function flushPendingClearableNumberInputs(): boolean {
  pendingCommitRejected = false
  for (const commit of [...pendingCommits]) {
    commit()
  }
  return !pendingCommitRejected
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

/** Empty or trailing decimal separator — not a complete number yet. */
export function isIncompleteNumberText(raw: string): boolean {
  return raw === '' || raw === '.' || /^\d*\.$/.test(raw)
}

function isEmptyValue(value: number | null | undefined): boolean {
  return value == null || !Number.isFinite(value)
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
  fieldKind,
  sanitizeUnits = false,
  deferAmbiguousIntegerPrefix = false,
  commitOnBlur = false,
  commitOnInput = false,
  selectOnFocus = false,
  onFocus,
  onBlur,
  enterKeyHint,
  'aria-label': ariaLabel,
}: ClearableNumberInputProps) {
  const [text, setText] = useState(() => formatValue(value, step))
  const [focused, setFocused] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const valueRef = useRef(value)
  /** Valeur au moment du focus — blur vide restaure celle-ci (pas la dernière frappe). */
  const focusValueRef = useRef(value)
  const textRef = useRef(text)
  const focusedRef = useRef(false)
  const pendingRef = useRef<PendingCommit | null>(null)
  const onChangeRef = useRef(onChange)
  const onBlurRef = useRef(onBlur)
  const propsRef = useRef({ required, clampOnBlur, fieldKind, min, max, step, value })

  textRef.current = text
  focusedRef.current = focused
  onChangeRef.current = onChange
  onBlurRef.current = onBlur
  propsRef.current = { required, clampOnBlur, fieldKind, min, max, step, value }

  useEffect(() => {
    if (!focused) {
      setText(formatValue(value, step))
      valueRef.current = value
      return
    }
    // Remplissage externe pendant le focus (ex. « dernière fois ») :
    // parent passe de vide → valeur. Ne jamais réécrire un champ vidé par l’utilisateur.
    const prev = valueRef.current
    if (value !== prev) {
      valueRef.current = value
      if (
        text === '' &&
        !isEmptyValue(value) &&
        value !== 0 &&
        (isEmptyValue(prev) || prev === 0)
      ) {
        setText(formatValue(value, step))
        // « dernière fois » appliqué après focus → nouvelle baseline de restore.
        focusValueRef.current = value
      }
    }
  }, [value, focused, step, text])

  const applyCommit = (fireBlurCallback: boolean) => {
    const {
      required: req,
      clampOnBlur: clampBlur,
      fieldKind: kind,
      min: lo,
      max: hi,
      step: st,
      value: parentValue,
    } = propsRef.current
    const currentText = textRef.current
    const parsed = parseFloat(currentText)
    if (currentText === '' || currentText === '.' || Number.isNaN(parsed)) {
      setCommitError(null)
      /**
       * Train (`fieldKind` + commitOnBlur) : un champ vidé RESTE VIDE au blur /
       * re-render. Valider / Terminer refusent ensuite via flush + bornes (M1).
       * Nutrition (`required` sans fieldKind) : conserve le restore avant-focus.
       */
      if (kind) {
        onChangeRef.current(null)
        setText('')
        textRef.current = ''
      } else if (req) {
        // Vide → valeur d’AVANT le focus (20), pas la dernière frappe (2).
        let restored = focusValueRef.current
        if (isEmptyValue(restored)) {
          restored = parentValue
        }
        if (clampBlur && restored != null && Number.isFinite(restored)) {
          restored = clamp(restored, lo, hi, st)
        }
        const restoredText = formatValue(restored, st)
        setText(restoredText)
        textRef.current = restoredText
        if (
          restored != null &&
          Number.isFinite(restored) &&
          restored !== parentValue
        ) {
          onChangeRef.current(restored)
        }
      } else {
        onChangeRef.current(null)
        setText('')
        textRef.current = ''
      }
    } else if (!clampBlur && kind) {
      // Même règle que Valider / Terminer — refuse NaN, Infinity, hors bornes.
      const err = validateTrainSetNumber(kind, parsed)
      if (err) {
        pendingCommitRejected = true
        setCommitError(err)
        let restored = parentValue
        if (isEmptyValue(restored)) restored = focusValueRef.current
        const restoredText = formatValue(restored, st)
        setText(restoredText)
        textRef.current = restoredText
        // Ne jamais écrire la valeur invalide ni déclencher onBlur parent
        // (sinon auto-validate validerait l’ancienne série encore valide).
        return
      }
      setCommitError(null)
      onChangeRef.current(parsed)
      const nextText = formatValue(parsed, st)
      setText(nextText)
      textRef.current = nextText
    } else if (!clampBlur) {
      onChangeRef.current(parsed)
      const nextText = formatValue(parsed, st)
      setText(nextText)
      textRef.current = nextText
    } else {
      setCommitError(null)
      const clamped = clamp(parsed, lo, hi, st)
      onChangeRef.current(clamped)
      const nextText = formatValue(clamped, st)
      setText(nextText)
      textRef.current = nextText
    }
    if (fireBlurCallback) onBlurRef.current?.()
  }

  const unregisterPending = () => {
    if (pendingRef.current) {
      pendingCommits.delete(pendingRef.current)
      pendingRef.current = null
    }
  }

  const registerPending = () => {
    unregisterPending()
    const commit: PendingCommit = () => {
      if (!focusedRef.current) return
      focusedRef.current = false
      setFocused(false)
      unregisterPending()
      applyCommit(false)
    }
    pendingRef.current = commit
    pendingCommits.add(commit)
  }

  useEffect(() => () => unregisterPending(), [])

  const showPlaceholder = Boolean(placeholder) && text === '' && !focused

  return (
    <div className="relative w-full">
      {showPlaceholder && (
        <span
          className={
            placeholderClassName ??
            'pointer-events-none absolute inset-0 flex items-center text-[28px] font-bold tracking-tight text-[#717C83]'
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
        aria-invalid={commitError ? true : undefined}
        value={text}
        placeholder={focused ? placeholder : undefined}
        onFocus={(e) => {
          setFocused(true)
          focusedRef.current = true
          focusValueRef.current = valueRef.current
          setCommitError(null)
          registerPending()
          onFocus?.()
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
          textRef.current = raw
          setCommitError(null)
          if (raw === '' || raw === '.') {
            // Train fieldKind : propage null tout de suite pour que le parent
            // ne réécrive pas l’ancienne valeur au re-render / blur.
            if (!required || fieldKind) onChange(null)
            return
          }
          if (commitOnInput) {
            // Incomplet (« 2. ») → ne rien propager ; nombre complet (0 inclus) → commit immédiat.
            if (isIncompleteNumberText(raw)) return
          } else if (commitOnBlur) {
            return
          }
          if (deferAmbiguousIntegerPrefix && isAmbiguousIntegerPrefix(raw, min, max)) {
            return
          }
          const next = parseFloat(raw)
          if (Number.isNaN(next)) return
          // Clamp silencieux seulement si clampOnBlur (nutrition âges/kcal).
          // Train commitOnBlur : pas de propagation ici.
          if (fieldKind && !clampOnBlur) {
            const err = validateTrainSetNumber(fieldKind, next)
            if (err) return
          }
          onChange(commitOnInput && clampOnBlur ? clamp(next, min, max, step) : next)
        }}
        onBlur={() => {
          if (!focusedRef.current) return
          focusedRef.current = false
          setFocused(false)
          unregisterPending()
          applyCommit(true)
        }}
        className={`${className ?? ''} ${showPlaceholder ? 'caret-white' : ''}`}
      />
      {commitError ? (
        <p className="mt-0.5 text-center text-[10px] font-medium text-[#FF6961]" role="alert">
          {commitError}
        </p>
      ) : null}
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
