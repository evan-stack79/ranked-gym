/** Copies techniques interdites dans l’UI de démarrage / chargement. */
export const FORBIDDEN_BOOT_UI_COPY = [
  'Récupération des données',
  'Récupération de ton profil',
  'Chargement des données',
  'Chargement des stats',
  'Synchronisation Supabase',
  'Synchronisation…',
  'Enregistrement cloud en cours',
] as const

export const USER_BOOT_ARIA_LABEL = 'Ranked Gym'
export const USER_OFFLINE_LABEL = 'Hors ligne'
export const USER_RETRY_LABEL = 'Réessayer'
export const USER_BLOCKING_LOAD_TITLE = 'Impossible de charger tes données'
export const USER_BLOCKING_LOAD_BODY =
  'Vérifie ta connexion puis réessaie. Tes informations restent sur cet appareil si elles y étaient déjà.'
export const USER_RECOVERABLE_LOAD_BODY =
  'Mise à jour impossible. Tes dernières données restent affichées.'
export const USER_BACKEND_UNAVAILABLE =
  'Connexion au service indisponible. Réessaie plus tard.'
export const USER_CRASH_TITLE = 'Ranked Gym a rencontré un problème'
export const USER_CRASH_BODY = 'Recharge la page. Tes données locales sont conservées.'
export const USER_RELOAD_LABEL = 'Recharger'

export function containsForbiddenBootCopy(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ')
  for (const snippet of FORBIDDEN_BOOT_UI_COPY) {
    if (normalized.includes(snippet)) return snippet
  }
  return null
}

export function isTechnicalCloudError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('supabase') ||
    lower.includes('convex') ||
    lower.includes('vite_') ||
    lower.includes('schema.sql') ||
    lower.includes('rls') ||
    lower.includes('timeout after') ||
    lower.includes('hydrat') ||
    lower.includes('workouts') ||
    lower.includes('user_backups') ||
    lower.includes('cloudflare')
  )
}

export function userFacingCloudError(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (isTechnicalCloudError(raw)) return USER_RECOVERABLE_LOAD_BODY
  return raw
}
