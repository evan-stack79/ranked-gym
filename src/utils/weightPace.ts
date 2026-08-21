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
 * Weekly rate — uses the user's explicit goal + pace when provided.
 */
export function computeWeightPace(options: {
  currentKg: number
  goalKg: number
  morphology: BodyMorphology
  goal?: NutritionGoal
  weeklyPaceKg?: number
}): WeightPacePlan {
  const { currentKg, goalKg, morphology } = options
  const delta = goalKg - currentKg
  const abs = Math.abs(delta)

  const goal: NutritionGoal =
    options.goal ??
    (abs < 0.4 ? 'maintain' : delta < 0 ? 'cut' : 'bulk')

  if (goal === 'maintain') {
    return {
      goal: 'maintain',
      weeklyKg: 0,
      weeklyMinKg: 0,
      weeklyMaxKg: 0,
      estimatedWeeks: null,
      weeklyPct: 0,
      headline: 'Maintien — calories au TDEE',
      healthTip: 'Maintiens calories + entraînement. Les petites variations jour à jour sont normales.',
      aestheticTip: 'Priorité qualité (protéines, sommeil) plutôt que le chiffre sur la balance.',
    }
  }

  const customPace = options.weeklyPaceKg
  if (customPace != null && customPace > 0) {
    const weekly = Math.round(customPace * 100) / 100
    const signed = goal === 'cut' ? -weekly : weekly
    const weeks = abs > 0.05 ? Math.max(1, Math.ceil(abs / weekly)) : null
    const pct = currentKg > 0 ? Math.round((weekly / currentKg) * 1000) / 10 : 0
    return {
      goal,
      weeklyKg: signed,
      weeklyMinKg: goal === 'cut' ? -0.75 : 0.15,
      weeklyMaxKg: goal === 'cut' ? -0.2 : 0.75,
      estimatedWeeks: weeks,
      weeklyPct: pct,
      headline:
        goal === 'cut'
          ? `Perte choisie : ${weekly.toFixed(1)} kg / semaine`
          : `Prise choisie : ${weekly.toFixed(1)} kg / semaine`,
      healthTip:
        goal === 'cut'
          ? 'Ce rythme alimente le déficit calorique de ton plan Nutri.'
          : 'Ce rythme alimente le surplus calorique de ton plan Nutri.',
      aestheticTip:
        'Tu peux le changer à tout moment dans Balance — les calories se recalculent.',
    }
  }

  // Legacy morphology-based suggestion (only if no custom pace)
  if (goal === 'cut') {
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
        'Pas plus vite : tu gardes le muscle, l’énergie et les hormones.',
      aestheticTip:
        'Une sèche régulière = peau qui suit mieux + moins de fatigue.',
    }
  }

  let pct = 0.0035
  if (morphology === 'ectomorph') pct = 0.0045
  if (morphology === 'endomorph') pct = 0.0025
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
    healthTip: 'Prise lente = plus de muscle, moins de graisse.',
    aestheticTip: 'Évite le dirty bulk : silhouette plus propre.',
  }
}
