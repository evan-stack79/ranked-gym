/** Radix custom accent (dark) — https://www.radix-ui.com/colors/custom?accent-dark=E22400 */

export const RADIX_RED = {
  1: '#170f0d',
  2: '#201412',
  3: '#3b140e',
  4: '#530e05',
  5: '#631509',
  6: '#742316',
  7: '#8d3325',
  8: '#b64331',
  9: '#e22400',
  10: '#d20000',
  11: '#ff917b',
  12: '#ffd1c8',
} as const

export const RADIX_GRAY = {
  1: '#111113',
  2: '#19191b',
  3: '#222325',
  4: '#292a2e',
  5: '#303136',
  6: '#393a40',
  7: '#46484f',
  8: '#5f606a',
  9: '#6c6e79',
  10: '#797b86',
  11: '#b2b3bd',
  12: '#eeeef0',
} as const

/** Solid accent — Radix step 9. */
export const BRAND_COLOR = RADIX_RED[9]
/** Hover / pressed solid — Radix step 10. */
export const BRAND_COLOR_HOVER = RADIX_RED[10]
export const APP_BACKGROUND = '#111111'
