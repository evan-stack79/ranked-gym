import developpeCoucheWebp from '../assets/exercises/developpe-couche.webp'
import {
  formatExerciseMetaLine,
  getCatalogExercise,
  type ExerciseEquipment,
} from '../data/exerciseCatalog'

export { formatExerciseMetaLine }

/**
 * Stable media keys — NOT free-text exercise titles.
 * Wire via `ExerciseEntry.canonicalExerciseId` when known.
 * Known ids come from the exercise catalog (+ legacy aliases).
 */
export type CanonicalExerciseId = string

export type ExerciseMedia = {
  /** Resolved canonical id when known, else slugified display name. */
  slug: string
  /** Canonical key used for asset lookup, or null when unknown. */
  canonicalExerciseId: string | null
  /** Local optimized asset URL, or null when missing. */
  imageSrc: string | null
  /** Accessible description for the hero photo. */
  imageAlt: string
  /** Primary muscle labels for the subtitle line (only when canonically known). */
  muscles: string[]
  /** Equipment label from catalog when canonically known. */
  equipment: string | null
  /**
   * Illustration locale (equipment glyph) when no photo — never an invented exercise photo.
   * Values are stable keys for SVG glyphs in the UI.
   */
  illustrationKey: ExerciseEquipment | 'neutral'
}

type AssetEntry = {
  imageSrc: string
  imageAlt: string
}

/** Known local assets keyed by canonical exercise id. Missing → neutral fallback. */
const CANONICAL_ASSETS: Record<string, AssetEntry> = {
  bench_press: {
    imageSrc: developpeCoucheWebp,
    imageAlt: 'Athlète réalisant un développé couché à la barre',
  },
}

/**
 * Reliable display-name slugs → canonical id.
 * Intentionally excludes free-text stubs like « DÉVELOPPER » / `developper`
 * (too ambiguous; would invent a wrong exercise type).
 */
const NAME_SLUG_TO_CANONICAL: Record<string, string> = {
  'developpe-couche': 'bench_press',
  'dev-couche': 'bench_press',
  'developpe-couche-barre': 'bench_press',
  'barre-couchee': 'bench_press',
  'bench-press': 'bench_press',
  bench: 'bench_press',
  'developpe-incline': 'incline_bench_press',
  'dev-incline': 'incline_bench_press',
  'developpe-militaire': 'overhead_press',
  'dev-militaire': 'overhead_press',
  'military-press': 'overhead_press',
  'developpe-couche-halteres': 'dumbbell_bench_press',
  'dev-couche-halteres': 'dumbbell_bench_press',
  'presse-a-cuisses': 'leg_press',
  'leg-press': 'leg_press',
  'souleve-de-terre': 'deadlift',
  deadlift: 'deadlift',
  squat: 'back_squat',
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

function asCanonicalId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if (getCatalogExercise(key)) return key
  // Legacy reserved ids still accepted even if catalog evolves.
  if (key === 'bench_press' || key === 'leg_press') return key
  return null
}

function resolveCanonical(input: ResolveExerciseMediaInput): {
  canonical: string | null
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

function musclesForCanonical(canonical: string | null): string[] {
  if (!canonical) return []
  const catalog = getCatalogExercise(canonical)
  if (catalog) return [...catalog.muscles]
  return []
}

function equipmentForCanonical(canonical: string | null): string | null {
  if (!canonical) return null
  const catalog = getCatalogExercise(canonical)
  return catalog?.equipment ?? null
}

function illustrationKeyFor(
  equipment: string | null,
): ExerciseEquipment | 'neutral' {
  if (
    equipment === 'Barre' ||
    equipment === 'Haltères' ||
    equipment === 'Machine' ||
    equipment === 'Poids du corps' ||
    equipment === 'Câble' ||
    equipment === 'Kettlebell' ||
    equipment === 'Autre'
  ) {
    return equipment
  }
  return 'neutral'
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
  const asset = canonical ? CANONICAL_ASSETS[canonical] : undefined
  const muscles = musclesForCanonical(canonical)
  const equipment = equipmentForCanonical(canonical)
  const illustrationKey = illustrationKeyFor(equipment)

  if (canonical && asset) {
    return {
      slug: canonical,
      canonicalExerciseId: canonical,
      imageSrc: asset.imageSrc,
      imageAlt: asset.imageAlt,
      muscles,
      equipment,
      illustrationKey,
    }
  }

  return {
    slug: canonical ?? (nameSlug || 'unknown'),
    canonicalExerciseId: canonical,
    imageSrc: null,
    imageAlt: '',
    muscles,
    equipment,
    illustrationKey,
  }
}

/** Subtitle muscles-only (compat). Prefer formatExerciseMetaLine for UI unifiée. */
export function formatExerciseMuscles(muscles: string[]): string {
  return muscles.filter(Boolean).join(' · ')
}
