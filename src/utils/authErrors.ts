/** Messages d’auth lisibles — jamais de mot de passe dans les logs appelants. */

export const MIN_PASSWORD_LENGTH = 6

export function isNetworkAuthError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('network error') ||
    lower.includes('load failed') ||
    lower.includes('fetch failed') ||
    lower.includes('timeout') ||
    lower.includes('offline')
  )
}

/** Erreurs qui pourraient indiquer l’existence d’un compte — à masquer. */
export function isAccountEnumerationError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()
  return (
    lower.includes('user not found') ||
    lower.includes('unable to find user') ||
    lower.includes('email not found') ||
    lower.includes('for security purposes') ||
    lower.includes('signup is disabled')
  )
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  if (password !== confirm) {
    return 'Les mots de passe ne correspondent pas.'
  }
  return null
}

export function friendlyAuthError(err: unknown, fallback: string): string {
  if (isNetworkAuthError(err)) {
    return 'Connexion réseau impossible. Vérifie ta connexion puis réessaie.'
  }

  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.'
  }
  if (lower.includes('user already registered')) {
    return 'Cet email est déjà utilisé. Passe sur Connexion.'
  }
  if (lower.includes('password') && (lower.includes('6') || lower.includes('least'))) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  if (lower.includes('same password') || lower.includes('different from the old')) {
    return 'Choisis un mot de passe différent de l’ancien.'
  }
  if (lower.includes('email rate') || lower.includes('over_email_send_rate_limit')) {
    return 'Trop de tentatives. Réessaie dans quelques minutes.'
  }
  if (lower.includes('email')) {
    return fallback
  }
  return fallback
}
