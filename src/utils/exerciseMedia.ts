import developpeCoucheWebp from '../assets/exercises/developpe-couche.webp'

export type ExerciseMedia = {
  /** Stable slug used as lookup key. */
  slug: string
  /** Local optimized asset URL, or null when missing. */
  imageSrc: string | null
  /** Primary muscle labels for the subtitle line. */
  muscles: string[]
}

/** Known local assets — expand per exercise without requiring every image upfront. */
const EXERCISE_ASSETS: Record<string, { imageSrc: string; muscles: string[] }> = {
  'developpe-couche': {
    imageSrc: developpeCoucheWebp,
    muscles: ['Pectoraux', 'Triceps'],
  },
  'bench-press': {
    imageSrc: developpeCoucheWebp,
    muscles: ['Pectoraux', 'Triceps'],
  },
}

/** Alias → canonical slug (after sanitize / normalize). */
const SLUG_ALIASES: Record<string, string> = {
  'dev-couche': 'developpe-couche',
  'developpe-couche-barre': 'developpe-couche',
  'barre-couchee': 'developpe-couche',
  bench: 'developpe-couche',
  'bench-press': 'bench-press',
}

/**
 * Normalize an exercise display name into a filesystem-safe slug.
 * Accent-insensitive; keeps a–z / 0–9 / hyphens.
 */
export function exerciseSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveSlug(nameOrId: string): string {
  const raw = exerciseSlug(nameOrId)
  if (!raw) return ''
  return SLUG_ALIASES[raw] ?? raw
}

/**
 * Resolve local media for an exercise by id or display name.
 * Missing assets return `imageSrc: null` with a sober empty muscles list —
 * callers render a plain dark fallback (no decorative wallpaper).
 */
export function resolveExerciseMedia(nameOrId: string): ExerciseMedia {
  const slug = resolveSlug(nameOrId)
  const hit = slug ? EXERCISE_ASSETS[slug] : undefined
  if (hit) {
    return { slug, imageSrc: hit.imageSrc, muscles: hit.muscles }
  }
  return { slug: slug || 'unknown', imageSrc: null, muscles: [] }
}

/** Subtitle line: `Pectoraux · Triceps` or empty when unknown. */
export function formatExerciseMuscles(muscles: string[]): string {
  return muscles.filter(Boolean).join(' · ')
}
