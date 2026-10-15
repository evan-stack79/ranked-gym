/**
 * Adresse de contact unique pour « Nous écrire » (corrections âge / TCA).
 * Remplir avant mise en ligne — `npm run check:release` refuse un déploiement si vide.
 */
export const SUPPORT_EMAIL = 'contact.rankedgym@gmail.com'

/** Objet mailto fixe — jamais de données santé. */
export const SUPPORT_MAIL_SUBJECT = 'Ranked Gym : demande de correction' as const

export const CONTACT_UNAVAILABLE_MESSAGE = 'Adresse de contact bientôt disponible.' as const

export const WRITE_TO_US_LABEL = 'Nous écrire' as const

/** Vérifie qu’une adresse e-mail est non vide et plausible. */
export function isValidSupportEmail(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed) return false
  // Simple et strict : local@domaine.tld
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

/**
 * Construit le href mailto: (sujet fixe, corps vide).
 * Retourne null si SUPPORT_EMAIL n’est pas une adresse valide.
 */
export function buildSupportMailtoHref(
  email: string = SUPPORT_EMAIL,
  subject: string = SUPPORT_MAIL_SUBJECT,
): string | null {
  if (!isValidSupportEmail(email)) return null
  return `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}`
}
