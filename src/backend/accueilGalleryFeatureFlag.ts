import { parseBooleanFlag } from './featureFlag'

/**
 * Preview Accueil gallery + floating pill bottom nav.
 *
 * OFF by default — current Accueil / dock nav stay production default.
 * Enable only with VITE_ENABLE_ACCUEIL_GALLERY=true at build time (Evan GO).
 */
export function isAccueilGalleryEnabled(
  raw: string | undefined = import.meta.env.VITE_ENABLE_ACCUEIL_GALLERY,
): boolean {
  return parseBooleanFlag(raw)
}
