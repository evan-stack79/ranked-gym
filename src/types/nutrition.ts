/**
 * Profile sex — three answered values + null (Plus tard / never answered).
 * `'prefer_not_to_say'` is stored as its own value (never coerced to male/female).
 * Engine Mifflin still only accepts `'male' | 'female'`.
 */
export type Sex = 'male' | 'female' | 'prefer_not_to_say'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type NutritionGoal = 'cut' | 'maintain' | 'bulk'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
/** Somatotype — used to adapt meal size & scan guidance (not a medical label). */
export type BodyMorphology = 'ectomorph' | 'mesomorph' | 'endomorph'

/**
 * Explicit Santé answer (3 distinct states).
 * - `null` / absent = not answered (Plus tard / legacy) — never coerced to « non »
 * - `'none'` = « Aucune de ces situations »
 * - `'prefer_not'` = « Je préfère ne pas répondre »
 * - `'situations'` = one or more of Grossesse / Allaitement / TCA
 */
export type HealthAnswerStatus = 'none' | 'prefer_not' | 'situations'

export interface CalorieProfile {
  /**
   * Poids en kg. `null` = vide (jamais 0). À la lecture, 0/hors-plage legacy → null.
   */
  weightKg: number | null
  /** Poids cible en kg — `null` si non renseigné. */
  goalWeightKg: number | null
  /**
   * Taille en cm. `null` = vide (jamais 0). À la lecture, 0/hors-plage legacy → null.
   */
  heightCm: number | null
  /**
   * Âge en années. `0` legacy = vide (lire via sanitizeAge → null).
   * Jamais utilisé comme un vrai âge dans les calculs.
   */
  age: number
  /**
   * Null = Plus tard / never answered.
   * `'prefer_not_to_say'` = « Je préfère ne pas répondre » (distinct, survives sync).
   */
  sex: Sex | null
  /** Newest sex answer wins on sync (same pattern as bodyMetricsClearedAt). */
  sexUpdatedAt?: number | null
  activity: ActivityLevel
  morphology: BodyMorphology
  /** Explicit user choice: cut | maintain | bulk */
  goal: NutritionGoal
  /**
   * Absolute weekly pace in kg/week chosen by the user (e.g. 0.5).
   * Sign is applied from `goal` (negative on cut, positive on bulk).
   */
  weeklyPaceKg: number
  onboardingComplete: boolean
  /** Déclarations facultatives — jamais inférées (SEC-POP-04). */
  declaredPregnancy?: boolean
  declaredBreastfeeding?: boolean
  declaredEatingDisorder?: boolean
  /**
   * Diabète déclaré — conserve l’accès à « Ajouter un aliment »,
   * mais retire l’objectif calorique auto et l’objectif de perte de poids.
   */
  declaredDiabetes?: boolean
  /** @deprecated Prefer `healthAnswer === 'prefer_not'`. Kept for back-compat reads. */
  preferNotAnswerHealth?: boolean
  /**
   * Explicit 3-state Santé answer. Absent/null = not answered (legacy / Plus tard).
   * Never infer « none » from missing flags alone.
   */
  healthAnswer?: HealthAnswerStatus | null
  /**
   * Tombstone / version Santé — newest wins on sync (same pattern as bodyMetricsClearedAt).
   */
  healthAnswerUpdatedAt?: number | null
  /**
   * Tombstone effacement taille/poids — empêche une copie cloud stale (0 ou
   * ancienne valeur) de ressusciter les mensurations après « Effacer ».
   */
  bodyMetricsClearedAt?: number | null
}

export interface CalorieResult {
  bmr: number
  tdee: number
  targetCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  goal: NutritionGoal
  deltaKg: number
  weeklyChangeKg: number
  estimatedWeeks: number | null
}

export interface MealEntry {
  id: string
  name: string
  mealType: MealType
  /** V3 : null si kcal inconnue (jamais inventer 0). Legacy : nombre. */
  calories: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  /** Portion weight when logged from a scale / scan / piece count */
  grams?: number
  /** Number of pieces when logged without a scale (nuggets, boulettes…) */
  pieces?: number
  /** How the user intended this food in the meal */
  portionMode?: 'solo' | 'with_sides'
  /**
   * Libellé de portion figé à l’ajout (serving_size OFF ou « pour 100 g »).
   * Snapshot — un repas passé ne se met pas à jour si OFF change.
   */
  portionLabel?: string
  /** URL photo (stockage Ranked Gym) figée — V3 UI préfère foodIconCategory. */
  imageUrl?: string
  /** Réf. image Convex storage (jamais un hotlink OFF). */
  imageStorageId?: string
  /** Code-barres / code OFF figé au snapshot. */
  offCode?: string
  /**
   * Icône catégorie V3 (viennoiserie, pain, …) — déduite des categories_tags OFF
   * à l’ajout ; pas de photo contributeur.
   */
  foodIconCategory?:
    | 'viennoiserie'
    | 'pain'
    | 'produit_laitier'
    | 'fruit'
    | 'legume'
    | 'viande'
    | 'poisson'
    | 'boisson'
    | 'plat'
    | 'snack'
    | 'autre'
  /** categories_tags OFF figés (repli icône si foodIconCategory absent). */
  categoriesTags?: string[]
  createdAt: number
  /**
   * Horodatage propre à cette entrée (sync newest-wins, comme les verres d’eau).
   * Absent sur les repas legacy → traité comme createdAt.
   */
  updatedAt?: number
  /** Ligne créée par addFoodSnapshot V3 — upsertMeal ignore kcal/macros client. */
  entrySource?: 'v3'
  /** Id stable d’un ajout V3 (retries). */
  selectionEventId?: string
  /** File : refus définitif serveur — marque « Pas enregistré » dans le journal. */
  syncRejected?: boolean
  syncRejectCode?: string
  syncRejectedAt?: number
}

/** Compteurs journaliers des raccourcis d’hydratation (verre, shaker…). */
export type WaterPresetsCount = Record<string, number>

/** Type de contenant / source d’une entrée d’hydratation. */
export type WaterEntryType = 'glass' | 'shaker' | 'bottle' | 'manual' | 'legacy'

/**
 * Ligne du journal d’hydratation du jour.
 * Persistée dans `nutrition.journal[date].waterEntries` (JSON Supabase).
 */
export interface WaterEntry {
  id: string
  /** Volume de cette prise (ml). */
  amountMl: number
  /** Epoch ms — affichage heure locale. */
  createdAt: number
  type: WaterEntryType
  /** Libellé UI (ex. « Bouteille »). */
  label: string
}

export interface DayJournal {
  dateKey: string
  meals: MealEntry[]
  /** Eau bue aujourd’hui (ml) — somme des waterEntries, sync cloud. */
  waterMl?: number
  /**
   * Journal d’hydratation du jour (source de vérité).
   * Option B : tableau JSON dans nutrition.journal.
   */
  waterEntries?: WaterEntry[]
  /**
   * @deprecated Dérivé de waterEntries — conservé pour migration / badges.
   */
  waterPresetsCount?: WaterPresetsCount
  /**
   * Phase technique de la bouteille active : ml déjà bus (0–1500), pas les ml restants UI.
   * En calibrage : `waterBottleLevelMl = capacity − remainingMl`.
   * Legacy : peut exister seul (sans `waterBottleCalibrationTotalMl`).
   */
  waterBottleLevelMl?: number
  /**
   * Ancre de calibrage : total du journal (`waterMl`) au moment du réglage.
   * Présent uniquement en mode calibré — avec `waterBottleLevelMl`, permet de
   * faire baisser/monter le niveau affiché quand le journal change, sans créer d’eau.
   */
  waterBottleCalibrationTotalMl?: number
}
