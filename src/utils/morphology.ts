import type { BodyMorphology, MealType } from '../types/nutrition'

export const MORPHOLOGY_ORDER: BodyMorphology[] = ['ectomorph', 'mesomorph', 'endomorph']

export const MORPHOLOGY_LABELS: Record<BodyMorphology, string> = {
  ectomorph: 'Ectomorphe',
  mesomorph: 'Mésomorphe',
  endomorph: 'Endomorphe',
}

export const MORPHOLOGY_SHORT: Record<BodyMorphology, string> = {
  ectomorph: 'Fin · mange petit',
  mesomorph: 'Athlétique · équilibré',
  endomorph: 'Trapu · portions calmes',
}

/** How to self-identify — simple visual cues, not a medical diagnosis. */
export const MORPHOLOGY_HOW_TO =
  'Regarde-toi au naturel (pas après un gros repas) : épaules, taille, hanches, et comment tu prends / perds du poids. Choisis le profil qui te ressemble le plus — tu pourras le changer plus tard.'

export const MORPHOLOGY_HINTS: Record<BodyMorphology, string> = {
  ectomorph:
    'Silhouette plutôt fine, épaules étroites, métabolisme rapide. Tu as souvent du mal à finir un gros plat → on privilégie des portions plus petites, plus souvent.',
  mesomorph:
    'Silhouette athlétique, épaules marquées, tu changes assez facilement. Un rythme de repas classique te convient bien.',
  endomorph:
    'Silhouette plus ronde / trapue, tu stockes plus facilement. On garde des portions claires et on évite de trop charger un seul aliment.',
}

export const MORPHOLOGY_APP_TIP: Record<BodyMorphology, string> = {
  ectomorph:
    'Astuce Ranked : fractionne tes calories (plus de collations). Un seul gros repas, ce n’est pas obligatoire.',
  mesomorph: 'Astuce Ranked : 3 repas + une collation restent un très bon rythme.',
  endomorph:
    'Astuce Ranked : vise des assiettes équilibrées — un aliment dense, mieux vaut l’accompagner.',
}

/** Meal calorie shares adapted to morphology (still sum ≈ 1). */
export const MEAL_SHARE_BY_MORPHOLOGY: Record<BodyMorphology, Record<MealType, number>> = {
  ectomorph: {
    breakfast: 0.2,
    lunch: 0.28,
    dinner: 0.27,
    snack: 0.25, // more snacks — smaller meals
  },
  mesomorph: {
    breakfast: 0.25,
    lunch: 0.35,
    dinner: 0.3,
    snack: 0.1,
  },
  endomorph: {
    breakfast: 0.25,
    lunch: 0.35,
    dinner: 0.3,
    snack: 0.1,
  },
}

export type PortionMode = 'solo' | 'with_sides'

/** How much of the remaining meal budget this scanned food should cover. */
export function foodShareForMode(
  mode: PortionMode,
  morphology: BodyMorphology,
): number {
  if (mode === 'solo') {
    // Fill almost the whole meal with this product
    return morphology === 'ectomorph' ? 0.92 : 0.95
  }
  // Leave room for other foods on the plate
  if (morphology === 'ectomorph') return 0.45 // smaller main item, easier to finish
  if (morphology === 'endomorph') return 0.55
  return 0.65
}
