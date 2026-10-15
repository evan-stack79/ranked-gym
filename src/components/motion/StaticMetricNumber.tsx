/**
 * Instant numeric display for safety-critical metrics.
 *
 * SAFETY RULE (PM / Vérificateur):
 * Calories (kcal) and body weight must NEVER use CountUpNumber / rAF counters.
 * These components always render the final value immediately — no entrance animation.
 */

export interface StaticKcalNumberProps {
  value: number
  className?: string
  /** Override formatting; default fr-FR rounded kcal. */
  format?: (n: number) => string
}

export interface StaticBodyWeightNumberProps {
  value: number
  className?: string
  format?: (n: number) => string
}

function formatKcal(n: number): string {
  return Math.max(0, Math.round(Number.isFinite(n) ? n : 0)).toLocaleString('fr-FR')
}

function formatKg(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const rounded = Math.round(n * 10) / 10
  return rounded.toLocaleString('fr-FR', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

/** Instant kcal — never animated. Do not swap for CountUpNumber. */
export function StaticKcalNumber({
  value,
  className = '',
  format = formatKcal,
}: StaticKcalNumberProps) {
  const safe = Number.isFinite(value) ? value : 0
  return (
    <span className={className} data-rg-metric="kcal-static" data-rg-motion="off">
      {format(safe)}
    </span>
  )
}

/** Instant body weight — never animated. Do not swap for CountUpNumber. */
export function StaticBodyWeightNumber({
  value,
  className = '',
  format = formatKg,
}: StaticBodyWeightNumberProps) {
  const safe = Number.isFinite(value) ? value : 0
  return (
    <span className={className} data-rg-metric="body-weight-static" data-rg-motion="off">
      {format(safe)}
    </span>
  )
}
