/**
 * Identifiant de build injecté par Vite (`__APP_BUILD_ID__` / `__APP_BUILD_TIME__`).
 * Affiché discrètement dans Réglages pour vérifier la version sur téléphone.
 *
 * Format : `Version 2026-10-06 00:05 · 840af17`
 * - date/heure = moment du build, fuseau Europe/Paris
 * - code = short SHA Cloudflare / CI (`local` uniquement en dev local)
 */

declare const __APP_BUILD_ID__: string | undefined
declare const __APP_BUILD_TIME__: string | undefined

/** Variables d’environnement CI connues (Workers Builds, Pages, GitHub). */
export const APP_BUILD_SHA_ENV_KEYS = [
  'WORKERS_CI_COMMIT_SHA', // Cloudflare Workers Builds (prod actuelle)
  'CF_PAGES_COMMIT_SHA', // Cloudflare Pages (legacy / pages:deploy)
  'VITE_APP_BUILD_ID', // override manuel
  'GITHUB_SHA', // GitHub Actions
] as const

/** Extrait un short SHA (7) depuis l’env de build, sinon `null` (→ local). */
export function pickShortCommitSha(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): string | null {
  for (const key of APP_BUILD_SHA_ENV_KEYS) {
    const raw = env[key]?.trim()
    if (!raw) continue
    const short = raw.slice(0, 7)
    if (short) return short
  }
  return null
}

/** Horodatage lisible FR (YYYY-MM-DD HH:mm) en Europe/Paris. */
export function formatParisBuildStamp(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(date.getTime())) return '—'
  // `sv-SE` → `2026-10-06 00:05` (ordre ISO, séparateur espace).
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function getAppBuildId(override?: string): string {
  const raw =
    override !== undefined
      ? override
      : typeof __APP_BUILD_ID__ !== 'undefined'
        ? __APP_BUILD_ID__
        : undefined
  const trimmed = raw?.trim()
  if (trimmed) return trimmed
  return 'dev'
}

export function getAppBuildTimeIso(override?: string): string {
  const raw =
    override !== undefined
      ? override
      : typeof __APP_BUILD_TIME__ !== 'undefined'
        ? __APP_BUILD_TIME__
        : undefined
  const trimmed = raw?.trim()
  if (trimmed) return trimmed
  return new Date().toISOString()
}

/**
 * Libellé Réglages : `Version YYYY-MM-DD HH:mm · <sha|local>`.
 * « local » uniquement quand aucun SHA CI n’a été injecté au build.
 */
export function formatAppVersionLabel(
  buildId: string = getAppBuildId(),
  buildTimeIso: string = getAppBuildTimeIso(),
): string {
  const stamp = formatParisBuildStamp(buildTimeIso)
  return `Version ${stamp} · ${buildId}`
}
