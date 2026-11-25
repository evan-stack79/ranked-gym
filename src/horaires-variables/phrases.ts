/**
 * Phrases imposées + vetos texte (SCIENCE_32 + NOTES.md).
 * Pure — no I/O.
 */

import {
  HV_ALARM_INACTIVE,
  HV_ALARMS_READY,
  HV_FEATURE_NAME,
  HV_MINOR_ADULT_HELP,
  HV_MINOR_BODY_PHRASE,
  HV_MINOR_NO_NIGHT_MODE,
  HV_SHORT_NIGHT_DRIVE,
  HV_WATER_DAY_PHRASE,
} from './constants.ts'

/** Forbidden tokens / phrases for HV UI copy (case-insensitive). */
export const HV_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bphase\b/i,
  /\bbpm\b/i,
  /\bscore\b/i,
  /\bstreak\b/i,
  /\bs[eé]rie\b/i,
  /\bkcal\b/i,
  /\bpoints?\b/i,
  /\bclassement\b/i,
  /%/,
  /\befficacit[eé]\b/i,
  /temps endormi/i,
  /au r[eé]veil/i,
  /\bm[eé]decin\b/i,
  /\bsant[eé]\b/i,
]

/** Legacy name that must not appear in product copy. */
export const HV_LEGACY_NAME = 'Horaires qui changent'

export function containsForbiddenHvCopy(text: string): boolean {
  if (!text.trim()) return false
  if (text.includes(HV_LEGACY_NAME)) return true
  return HV_FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeHvCopy(text: string): void {
  if (containsForbiddenHvCopy(text)) {
    throw new Error(`HV forbidden copy: ${text.slice(0, 80)}`)
  }
}

export function minorGuidancePhrases(): {
  body: string
  adultHelp: string
  noNightMode: string
} {
  return {
    body: HV_MINOR_BODY_PHRASE,
    adultHelp: HV_MINOR_ADULT_HELP,
    noNightMode: HV_MINOR_NO_NIGHT_MODE,
  }
}

export function shortNightDriveLine(): string {
  return HV_SHORT_NIGHT_DRIVE
}

export function waterDayPhrase(): string {
  return HV_WATER_DAY_PHRASE
}

export function featureName(): string {
  return HV_FEATURE_NAME
}

/** All imposed verbatim phrases for contract tests. */
export const HV_IMPOSED_PHRASES = [
  HV_FEATURE_NAME,
  HV_MINOR_BODY_PHRASE,
  HV_MINOR_ADULT_HELP,
  HV_MINOR_NO_NIGHT_MODE,
  HV_SHORT_NIGHT_DRIVE,
  HV_WATER_DAY_PHRASE,
  HV_ALARM_INACTIVE,
  HV_ALARMS_READY,
] as const
