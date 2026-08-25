/**
 * Constantes de politique produit — Nutrition Engine V2 (post-Waterfall).
 *
 * [SCIENCE]
 * - Lipides ~20–35 % des kcal : plage couramment citée (pas une obligation individuelle).
 * - Protéines sport ~1,6–2,2 g/kg : fourchette de référence fréquente (pas un plafond médical universel).
 * - Aucune source ne fixe un plafond glucidique médical universel (ex. 7 g/kg) pour la musculation.
 *
 * [CHOIX PRODUIT]
 * - CARB_REVIEW_THRESHOLD_G_PER_KG : seuil de revue algorithmique, PAS une limite médicale.
 * - LIP_MAX_PCT / PROTEIN_MAX_G_PER_KG : bornes de redistribution produit dans des plages de référence.
 *
 * [ALGORITHME]
 * - Utilisées uniquement par le post-pass `applyCarbReviewRedistribution` après le Waterfall V1.
 */

/** Seuil de revue glucidique (g/kg) — politique produit, pas un plafond scientifique. */
export const CARB_REVIEW_THRESHOLD_G_PER_KG = 7.0

/** Cible lipidique Waterfall V1 (fraction de Target_Kcal). */
export const LIP_TARGET_PCT = 0.25

/** Plafond lipidique pour la redistribution V2 (fraction de Target_Kcal). */
export const LIP_MAX_PCT = 0.35

/**
 * Borne haute d’upgrade protéique lors de la redistribution V2 (g/kg).
 * Politique produit dans une fourchette de référence ; pas un plafond médical universel.
 * N’écrase jamais un Prot_Target déjà supérieur (ex. cut + musculation 2,4).
 */
export const PROTEIN_MAX_G_PER_KG = 2.2

export const ALLOCATION_FLAGS = {
  /** Redistribution effectuée ; glucides finaux ≤ seuil produit. */
  CARB_REDISTRIBUTED_WITHIN_LIMITS: 'CARB_REDISTRIBUTED_WITHIN_LIMITS',
  /** Après Lip_Max + Prot_Max produit, glucides encore > seuil — macros figées. */
  CARB_REVIEW_REMAINING_AFTER_LIMITS: 'CARB_REVIEW_REMAINING_AFTER_LIMITS',
} as const

export type AllocationFlag = (typeof ALLOCATION_FLAGS)[keyof typeof ALLOCATION_FLAGS]
