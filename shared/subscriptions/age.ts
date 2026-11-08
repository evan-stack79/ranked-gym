/**
 * Âge civil révolu pour garde d’achat Pro (ARCHI §7).
 * Convention : âge = années civiles révolues à la date UTC `asOf` (YYYY-MM-DD).
 * Pas de jours/365. Testé : jour des 15 ans, veille, bissextile, dates invalides.
 */
import { PRO_MIN_AGE_YEARS } from './constants'

export type DateOfBirthParts = { year: number; month: number; day: number }

export function parseIsoDateOnly(iso: string): DateOfBirthParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Reject impossible civil dates (e.g. 2023-02-29).
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

export function civilAgeYearsAt(
  dob: DateOfBirthParts,
  asOf: DateOfBirthParts,
): number {
  let age = asOf.year - dob.year
  const beforeBirthday =
    asOf.month < dob.month || (asOf.month === dob.month && asOf.day < dob.day)
  if (beforeBirthday) age -= 1
  return age
}

export function utcTodayParts(nowMs = Date.now()): DateOfBirthParts {
  const d = new Date(nowMs)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  }
}

export type PurchaseAgeFailReason = 'missing_dob' | 'invalid_dob' | 'future_dob' | 'underage'

export type PurchaseAgeGate =
  | { ok: true; ageYears: number; reason?: undefined }
  | { ok: false; reason: PurchaseAgeFailReason; ageYears?: number }

export function evaluatePurchaseAgeGate(
  dateOfBirthIso: string | null | undefined,
  nowMs = Date.now(),
  minAge = PRO_MIN_AGE_YEARS,
): PurchaseAgeGate {
  if (!dateOfBirthIso || typeof dateOfBirthIso !== 'string') {
    return { ok: false, reason: 'missing_dob' }
  }
  const dob = parseIsoDateOnly(dateOfBirthIso)
  if (!dob) return { ok: false, reason: 'invalid_dob' }
  const today = utcTodayParts(nowMs)
  // Future DOB
  if (
    dob.year > today.year ||
    (dob.year === today.year && dob.month > today.month) ||
    (dob.year === today.year && dob.month === today.month && dob.day > today.day)
  ) {
    return { ok: false, reason: 'future_dob' }
  }
  const ageYears = civilAgeYearsAt(dob, today)
  if (ageYears < minAge) return { ok: false, reason: 'underage', ageYears }
  return { ok: true, ageYears }
}

export function isEligibleForSoloPurchase(
  dateOfBirthIso: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  return evaluatePurchaseAgeGate(dateOfBirthIso, nowMs).ok
}
