import { friendlyAuthError } from './authErrors'

export function toUserFacingError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const lower = raw.toLowerCase()

  if (
    lower.includes('convex_avatar_upload_failed') ||
    lower.includes('convex_avatar_storage_id_missing')
  ) {
    return 'Upload de la photo impossible pour le moment. Réessaie.'
  }
  if (lower.includes('forbidden_cross_user_avatar_upload')) {
    return 'Action non autorisée sur ce profil.'
  }
  if (lower.includes('auth_password_reset_email_unavailable')) {
    return 'Réinitialisation par email indisponible pour le moment. Contacte le support pour recevoir un lien.'
  }

  return friendlyAuthError(error, fallback)
}
