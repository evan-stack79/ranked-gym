/**
 * Règles communauté / classements / notifications (lot 1).
 * Âge stocké uniquement dans le profil nutrition client — exclusion classement
 * côté client uniquement (pas de champ âge Convex dans ce lot).
 */
import type { CalorieProfile } from '../types/nutrition'
import { getCalorieProfile } from './nutritionStorage'
import {
  canParticipateInRankings,
  isMinorAge,
  isMinorOrUnknownAge,
  readHealthDeclarations,
} from './nutritionSafetyRules'

export function getLocalSafetyProfile(profileOverride?: CalorieProfile): CalorieProfile {
  return profileOverride ?? getCalorieProfile()
}

export function isRankingEligible(profileOverride?: CalorieProfile): boolean {
  const profile = getLocalSafetyProfile(profileOverride)
  return canParticipateInRankings({
    age: profile.age,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    sex: profile.sex,
    declarations: readHealthDeclarations(profile),
  })
}

export function isMinorMode(profileOverride?: CalorieProfile): boolean {
  return isMinorAge(getLocalSafetyProfile(profileOverride).age)
}

/** Âge inconnu ou mineur → pas de classement (plus protecteur). */
export function shouldHideRankings(profileOverride?: CalorieProfile): boolean {
  return !isRankingEligible(profileOverride)
}

/**
 * Axes de classement interdits (VETO Q11) : volume, nombre de séances,
 * XP dérivé du volume/séances, poids, calories, macros, Effort, sommeil, forme.
 * Axes autorisés (non construits ici) : régularité plafonnée, progression relative.
 */
export const FORBIDDEN_RANKING_AXES = [
  'volume',
  'session_count',
  'xp_from_volume',
  'level_from_xp',
  'body_weight',
  'calories',
  'macros',
  'weight_loss',
  'load_to_bodyweight_ratio',
  'effort',
  'sleep',
  'forme',
] as const

/** Neutralise un tri/classement par niveau/XP (dérivé séances). */
export function neutralizeLevelRanking<T extends { level?: number; username?: string }>(
  members: T[],
): T[] {
  return [...members].sort((a, b) =>
    String(a.username ?? '').localeCompare(String(b.username ?? ''), 'fr'),
  )
}

export function shouldBlockNutritionStreakAlerts(profileOverride?: CalorieProfile): boolean {
  const profile = getLocalSafetyProfile(profileOverride)
  if (isMinorOrUnknownAge(profile.age)) return true
  return readHealthDeclarations(profile).eatingDisorder
}

/**
 * Filtre les gabarits de notification : jamais poids / calories / déficit ;
 * pour mineur ou TCA déclaré : pas de nutrition ni « série en danger ».
 */
export function isNotificationTemplateAllowed(
  template: {
    body?: string
    title?: string
    kind?: 'session' | 'meal' | 'weigh_in' | 'streak_danger' | 'rank_loss' | 'other'
  },
  profileOverride?: CalorieProfile,
): boolean {
  const text = `${template.title ?? ''} ${template.body ?? ''}`.toLowerCase()
  if (
    /\b(kcal|calorie|calories|poids|déficit|deficit|kg\/sem)\b/i.test(text) ||
    /\b(kcal|calorie|calories|poids|déficit|deficit)\b/i.test(text)
  ) {
    return false
  }
  if (template.kind === 'session') return true

  const profile = getLocalSafetyProfile(profileOverride)
  const restricted =
    isMinorOrUnknownAge(profile.age) || readHealthDeclarations(profile).eatingDisorder

  if (!restricted) {
    // Adultes sans TCA : conserver repas/série existants (à décider plus tard) —
    // on n'autorise que session ici pour les nouveaux envois sensibles.
    return template.kind !== 'weigh_in' && template.kind !== 'rank_loss'
  }

  return false
}
