import { parseBooleanFlag } from './featureFlag'

/**
 * Accueil gallery + floating pill bottom nav.
 *
 * ON by default (Evan GO) — unset / empty ⇒ enabled.
 * Explicit `false` / `0` / `no` turns it off (legacy dashboard + dock nav).
 */
export function isAccueilGalleryEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_ACCUEIL_GALLERY,
): boolean {
  if (typeof raw === 'string' && raw.trim() !== '') {
    return parseBooleanFlag(raw)
  }
  return true
}
