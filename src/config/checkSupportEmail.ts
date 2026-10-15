import { isValidSupportEmail } from './contact'

export const SUPPORT_EMAIL_MISSING_FR =
  'Adresse de contact manquante : remplis SUPPORT_EMAIL avant la mise en ligne.' as const

export type SupportEmailCheckResult =
  | { ok: true }
  | { ok: false; message: typeof SUPPORT_EMAIL_MISSING_FR }

/**
 * Logique du check de release (sans process.exit) — testable unitairement.
 */
export function checkSupportEmailReady(email: string): SupportEmailCheckResult {
  if (!isValidSupportEmail(email)) {
    return { ok: false, message: SUPPORT_EMAIL_MISSING_FR }
  }
  return { ok: true }
}
