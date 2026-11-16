import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import { HV_RED } from '../../../horaires-variables/constants'

const OFF = '#39393D'

/**
 * Interrupteur iOS 51×31 — pilule, rond blanc, rouge #ff0702 quand on.
 */
export function HvIosSwitch({
  checked,
  onChange,
  'aria-label': ariaLabel,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  'aria-label'?: string
  disabled?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full disabled:opacity-50"
      style={{
        backgroundColor: checked ? HV_RED : OFF,
        transition: reduced ? undefined : 'background-color 200ms ease',
      }}
      data-hv-ios-switch={checked ? 'on' : 'off'}
    >
      <span
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow"
        style={{
          left: checked ? 22 : 2,
          transition: reduced ? undefined : 'left 200ms ease',
        }}
        aria-hidden
      />
    </button>
  )
}
