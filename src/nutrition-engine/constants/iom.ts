/**
 * Équations EER IOM (DRI 2005 — adultes ≥ 19 ans).
 * Poids : kg · Taille : m · Âge : années.
 *
 * Hommes : EER = 662 − (9.53 × âge) + PA × (15.91 × poids + 539.6 × taille)
 * Femmes : EER = 354 − (6.91 × âge) + PA × (9.36 × poids + 726 × taille)
 */
export const IOM_EER = {
  male: {
    intercept: 662,
    ageCoef: 9.53,
    weightCoef: 15.91,
    heightCoef: 539.6,
  },
  female: {
    intercept: 354,
    ageCoef: 6.91,
    weightCoef: 9.36,
    heightCoef: 726,
  },
} as const

/** Coefficients PA IOM — niveaux 1 à 4 (sédentaire → très actif). */
export const IOM_PA: Record<'male' | 'female', readonly [number, number, number, number]> = {
  male: [1.0, 1.11, 1.25, 1.48],
  female: [1.0, 1.12, 1.27, 1.45],
} as const

export const KCAL_PER_G = {
  protein: 4,
  fat: 9,
  carb: 4,
} as const

/** Tolérance conservation énergétique après arrondi d’affichage (kcal). */
export const ENERGY_ROUND_TOLERANCE_KCAL = 3

/**
 * Tolérance minimale API après réconciliation d’une seule macro entière (Atwater).
 * Glucides/protéines : pas de 4 kcal/g → résidu |r| ≤ 2 si delta ∉ 4ℤ.
 * Lipides : pas de 9 kcal/g — utilisé uniquement si delta ∈ 9ℤ (conservation exacte).
 * Si ni 4 ni 9 ne divise le delta post-arrondi, la conservation exacte est
 * mathématiquement impossible en n’ajustant qu’une macro ; on minimise |résidu|
 * (préférentiellement sur les glucides). Max documenté : 2 kcal.
 */
export const API_INTEGER_ENERGY_TOLERANCE_KCAL = 2
