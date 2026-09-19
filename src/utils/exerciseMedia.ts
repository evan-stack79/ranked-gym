import developpeCoucheWebp from '../assets/exercises/developpe-couche.webp'

/**
 * Stable media keys — NOT free-text exercise titles.
 * Wire via `ExerciseEntry.canonicalExerciseId` when known.
 */
export type CanonicalExerciseId = 'bench_press' | 'leg_press'

export type ExerciseMedia = {
  /** Resolved canonical id when known, else slugified display name. */
  slug: string
  /** Canonical key used for asset lookup, or null when unknown. */
  canonicalExerciseId: CanonicalExerciseId | null
  /** Local optimized asset URL, or null when missing. */
  imageSrc: string | null
  /** Accessible description for the hero photo. */
  imageAlt: string
  /** Primary muscle labels for the subtitle line (only when canonically known). */
  muscles: string[]
}

type AssetEntry = {
  imageSrc: string
  imageAlt: string
  muscles: string[]
}

/** Known local assets keyed by canonical exercise id. */
const CANONICAL_ASSETS: Record<CanonicalExerciseId, AssetEntry | null> = {
  bench_press: {
    imageSrc: developpeCoucheWebp,
    imageAlt: 'Athlète réalisant un développé couché à la barre',
    muscles: ['Pectoraux', 'Triceps'],
  },
  // Reserved for a future local asset — intentional null (neutral fallback).
  leg_press: null,
}

/**
 * Reliable display-name slugs → canonical id.
 * Intentionally excludes free-text stubs like « DÉVELOPPER » / `developper`
 * (too ambiguous; would invent a wrong exercise type).
 */
const NAME_SLUG_TO_CANONICAL: Record<string, CanonicalExerciseId> = {
  'developpe-couche': 'bench_press',
  'dev-couche': 'bench_press',
  'developpe-couche-barre': 'bench_press',
  'barre-couchee': 'bench_press',
  'bench-press': 'bench_press',
  bench: 'bench_press',
}

export type ResolveExerciseMediaInput = {
  name?: string | null
  canonicalExerciseId?: string | null
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

function asCanonicalId(raw: string | null | undefined): CanonicalExerciseId | null {
  if (!raw) return null
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if (key === 'bench_press' || key === 'leg_press') return key
  return null
}

function resolveCanonical(input: ResolveExerciseMediaInput): {
  canonical: CanonicalExerciseId | null
  nameSlug: string
} {
  const fromField = asCanonicalId(input.canonicalExerciseId ?? null)
  if (fromField) {
    return { canonical: fromField, nameSlug: exerciseSlug(input.name ?? '') }
  }
  const nameSlug = exerciseSlug(input.name ?? '')
  const fromName = nameSlug ? (NAME_SLUG_TO_CANONICAL[nameSlug] ?? null) : null
  return { canonical: fromName, nameSlug }
}

/**
 * Resolve local media for an exercise.
 * Priority: `canonicalExerciseId` → reliable name slug → null asset (neutral fallback).
 * Never invents a type from ambiguous free text (e.g. « DÉVELOPPER »).
 */
export function resolveExerciseMedia(
  input: string | ResolveExerciseMediaInput,
): ExerciseMedia {
  const normalized: ResolveExerciseMediaInput =
    typeof input === 'string' ? { name: input } : input
  const { canonical, nameSlug } = resolveCanonical(normalized)
  const asset = canonical ? CANONICAL_ASSETS[canonical] : null

  if (canonical && asset) {
    return {
      slug: canonical,
      canonicalExerciseId: canonical,
      imageSrc: asset.imageSrc,
      imageAlt: asset.imageAlt,
      muscles: asset.muscles,
    }
  }

  return {
    slug: canonical ?? (nameSlug || 'unknown'),
    canonicalExerciseId: canonical,
    imageSrc: null,
    imageAlt: '',
    muscles: [],
  }
}

/** Subtitle line: `Pectoraux · Triceps` or empty when unknown. */
export function formatExerciseMuscles(muscles: string[]): string {
  return muscles.filter(Boolean).join(' · ')
}
