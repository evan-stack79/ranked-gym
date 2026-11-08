/**
 * Form-guide videos (perfect execution clips).
 * Lookup by exact catalog canonical id — never by free-text name.
 *
 * Drop an MP4 under `assets/exercises/form-videos/`, import it here,
 * and add the id → URL mapping. The UI picks it up automatically.
 */

export type ExerciseFormMedia = {
  /** Bundled MP4 URL when available. */
  videoSrc: string | null
  /** True when a form guide can still show the 3D still as visual help. */
  hasVisualGuide: boolean
}

/**
 * Canonical id → bundled form video.
 * Empty until clips are produced; keep wave illustrations as the interim aid.
 */
const FORM_VIDEO_BY_ID: Record<string, string> = {
  // Example once ready:
  // goblet_squat: gobletSquatMp4,
}

export function resolveFormVideoSrc(
  canonicalId: string | null | undefined,
): string | null {
  if (typeof canonicalId !== 'string' || canonicalId === '') return null
  return FORM_VIDEO_BY_ID[canonicalId] ?? null
}

export function listFormVideoCanonicalIds(): string[] {
  return Object.keys(FORM_VIDEO_BY_ID)
}
