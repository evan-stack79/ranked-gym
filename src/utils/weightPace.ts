import type { BodyMorphology, NutritionGoal } from '../types/nutrition'

export interface WeightPacePlan {
  goal: NutritionGoal
  /** Recommended kg change per week (signed) */
  weeklyKg: number
  /** Soft min–max healthy band */
  weeklyMinKg: number
  weeklyMaxKg: number
  estimatedWeeks: number | null
  /** % of bodyweight per week */
  weeklyPct: number
  headline: string
  healthTip: string
  aestheticTip: string
}

/**
 * Sustainable weekly rate — health first, cleaner physique (less stretch-mark risk on bulk).
 */
export function computeWeightPace(options: {
  currentKg: number
  goalKg: number
  morphology: BodyMorphology
}): WeightPacePlan {
  const { currentKg, goalKg, morphology } = options
  const delta = goalKg - currentKg
  const abs = Math.abs(delta)

  if (abs < 0.4) {
    return {
      goal: 'maintain',
      weeklyKg: 0,
      weeklyMinKg: 0,
      weeklyMaxKg: 0,
      estimatedWeeks: null,
      weeklyPct: 0,
      headline: 'Tu es sur ton poids cible',
      healthTip: 'Maintiens calories + entraînement. Les petites variations jour à jour sont normales.',
      aestheticTip: 'Priorité qualité (protéines, sommeil) plutôt que le chiffre sur la balance.',
    }
  }

  if (delta < 0) {
    // Cut: ~0.5–0.8% BW / week — protect muscle
    let pct = 0.0065
    if (morphology === 'ectomorph') pct = 0.0055
    if (morphology === 'endomorph') pct = 0.007
    const weekly = Math.min(0.75, Math.max(0.35, currentKg * pct))
    const weeks = Math.max(1, Math.ceil(abs / weekly))
    return {
      goal: 'cut',
      weeklyKg: -Math.round(weekly * 100) / 100,
      weeklyMinKg: -Math.round(currentKg * 0.008 * 100) / 100,
      weeklyMaxKg: -Math.round(currentKg * 0.004 * 100) / 100,
      estimatedWeeks: weeks,
      weeklyPct: Math.round(pct * 1000) / 10,
      headline: `Perte recommandée ~${weekly.toFixed(2)} kg / semaine`,
      healthTip:
        'Pas plus vite : tu gardes le muscle, l’énergie et les hormones. Si tu crashes trop vite, tu rebondis.',
      aestheticTip:
        'Une sèche régulière = peau qui suit mieux + moins de fatigue. Vise la zone, pas le sprint.',
    }
  }

  // Bulk: slower lean gain — fewer stretch marks, more muscle vs fat
  let pct = 0.0035 // ~0.25–0.35% BW
  if (morphology === 'ectomorph') pct = 0.0045 // hardgainers can push a bit
  if (morphology === 'endomorph') pct = 0.0025 // stay leaner
  const weekly = Math.min(0.4, Math.max(0.15, currentKg * pct))
  const weeks = Math.max(1, Math.ceil(abs / weekly))
  return {
    goal: 'bulk',
    weeklyKg: Math.round(weekly * 100) / 100,
    weeklyMinKg: Math.round(currentKg * 0.002 * 100) / 100,
    weeklyMaxKg: Math.round(currentKg * 0.005 * 100) / 100,
    estimatedWeeks: weeks,
    weeklyPct: Math.round(pct * 1000) / 10,
    headline: `Prise recommandée ~${weekly.toFixed(2)} kg / semaine`,
    healthTip:
      'Prise lente = plus de muscle, moins de graisse. Ton corps a le temps d’adapter peau & articulations.',
    aestheticTip:
      'Évite le dirty bulk : moins de vergetures, silhouette plus propre. Simple, régulier, efficace.',
  }
}
