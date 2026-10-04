/**
 * Identifiant de build injecté par Vite (`__APP_BUILD_ID__`).
 * Affiché discrètement dans Réglages pour vérifier la version sur téléphone.
 */

declare const __APP_BUILD_ID__: string | undefined

export function getAppBuildId(
  injected: string | undefined = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : undefined,
): string {
  const trimmed = injected?.trim()
  if (trimmed) return trimmed
  return 'dev'
}

/** Libellé simple, sans jargon technique. */
export function formatAppVersionLabel(buildId: string = getAppBuildId()): string {
  return `Version ${buildId}`
}
