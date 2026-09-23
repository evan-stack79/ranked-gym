import {
  catalogForSelectedSports,
  type CatalogExercise,
} from '../data/exerciseCatalog'

/** Normalise pour matching : casse + accents ignorés. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function scoreExercise(ex: CatalogExercise, query: string): number {
  if (!query) return ex.popularity

  const name = normalizeSearchText(ex.name)
  const aliases = ex.aliases.map(normalizeSearchText)
  const muscles = ex.muscles.map(normalizeSearchText)
  const equipment = normalizeSearchText(ex.equipment)

  if (name === query) return 10_000 + ex.popularity
  if (aliases.some((a) => a === query)) return 9_000 + ex.popularity
  if (name.startsWith(query)) return 8_000 + ex.popularity
  if (aliases.some((a) => a.startsWith(query))) return 7_500 + ex.popularity
  if (name.includes(query)) return 6_000 + ex.popularity
  if (aliases.some((a) => a.includes(query))) return 5_500 + ex.popularity
  if (muscles.some((m) => m.includes(query) || query.includes(m))) {
    return 4_000 + ex.popularity
  }
  if (equipment.includes(query)) return 3_000 + ex.popularity
  return -1
}

export type SearchExercisesOptions = {
  /** Limite d’affichage (défaut 8). */
  limit?: number
  /** Sports du profil — filtre le catalogue s’il existe des matches. */
  sportIds?: string[]
}

/**
 * Recherche locale dans le catalogue.
 * Pertinence d’abord, puis popularité. Sans requête → top popularité.
 */
export function searchExercises(
  rawQuery: string,
  options: SearchExercisesOptions = {},
): CatalogExercise[] {
  const limit = options.limit ?? 8
  const query = normalizeSearchText(rawQuery)

  const catalog = catalogForSelectedSports(options.sportIds)
  const scored = catalog.map((ex) => ({
    ex,
    score: scoreExercise(ex, query),
  })).filter((row) => row.score >= 0)

  scored.sort((a, b) => b.score - a.score || b.ex.popularity - a.ex.popularity)
  return scored.slice(0, limit).map((row) => row.ex)
}

/** Compte total de matches sans limite d’affichage (compteur UI). */
export function countExerciseMatches(rawQuery: string, sportIds?: string[]): number {
  const catalog = catalogForSelectedSports(sportIds)
  const query = normalizeSearchText(rawQuery)
  if (!query) return catalog.length
  return catalog.filter((ex) => scoreExercise(ex, query) >= 0).length
}
