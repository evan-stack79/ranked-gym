/**
 * URL de retour pour les emails de récupération de mot de passe.
 *
 * `detectSessionInUrl: true` (client Supabase) lit le hash/query au chargement
 * après le clic sur le lien. L’URL doit être HTTPS publique et autorisée dans
 * Supabase → Authentication → URL Configuration.
 *
 * Ne jamais envoyer `capacitor://…` ni `https://localhost` dans l’email :
 * ces schémas cassent le parcours mail sur appareil réel.
 */

import { isSafeExternalNavigationUrl } from './safeExternalNavigation'

export const PASSWORD_RESET_SENT_MESSAGE =
  'Si un compte existe avec cette adresse, un lien vient d’être envoyé.'

function isNativeCapacitorShell(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
    }
  ).Capacitor
  if (!cap) return false
  if (cap.isNativePlatform?.() === true) return true
  const platform = cap.getPlatform?.()
  return platform === 'ios' || platform === 'android'
}

function isSafeWebOrigin(origin: string): boolean {
  return isSafeExternalNavigationUrl(origin)
}

/**
 * Redirection pour `resetPasswordForEmail`.
 * - `VITE_PUBLIC_APP_URL` (https) prioritaire
 * - sinon `window.location.origin` si HTTPS (ou localhost http en dev web)
 * - sinon `undefined` → Supabase utilise le Site URL du dashboard
 *   (recommandé pour le shell Capacitor natif sans URL publique configurée)
 */
export function getPasswordRecoveryRedirectTo(
  envPublicAppUrl: string | undefined = import.meta.env.VITE_PUBLIC_APP_URL,
): string | undefined {
  const configured = typeof envPublicAppUrl === 'string' ? envPublicAppUrl.trim() : ''
  if (configured) {
    try {
      const parsed = new URL(configured)
      // Email deep-links must be public HTTPS only (never http/localhost/capacitor).
      if (parsed.protocol === 'https:' && isSafeExternalNavigationUrl(parsed.origin)) {
        return `${parsed.origin}/`
      }
    } catch {
      // ignore invalid env — fallback below
    }
  }

  if (typeof window === 'undefined') return undefined

  const origin = window.location.origin
  if (isNativeCapacitorShell()) {
    return undefined
  }
  if (!isSafeWebOrigin(origin)) return undefined
  return `${origin.replace(/\/$/, '')}/`
}
