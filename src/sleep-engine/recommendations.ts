import type { SleepMetrics } from './types'

/**
 * Recommandations et warnings UI — n’altèrent jamais les métriques calculées.
 * Aucun diagnostic médical (apnée, insomnie, trouble circadien, etc.).
 */
export function buildSleepRecommendations(metrics: SleepMetrics): {
  recommendations: string[]
  warnings: string[]
} {
  const recommendations: string[] = []
  const warnings: string[] = []

  switch (metrics.quantity.scientific_status) {
    case 'optimal':
      recommendations.push(
        'Votre durée de sommeil (TST) se situe dans la fourchette usuelle de 7 à 9 heures pour les adultes.',
      )
      break
    case 'deficit':
      recommendations.push(
        'Votre TST est inférieur à 7 h. Priorisez un coucher un peu plus tôt tout en gardant des horaires stables.',
      )
      break
    case 'excess':
      recommendations.push(
        'Votre TST dépasse 9 h. Un sommeil très prolongé n’est pas recommandé de façon routinière ; maintenez des horaires réguliers.',
      )
      break
  }

  if (metrics.catchUp.recoveryNeeded && metrics.catchUp.recommendation) {
    recommendations.push(metrics.catchUp.recommendation)
  }

  if (metrics.regularity.insufficientHistory) {
    recommendations.push(
      'Historique insuffisant pour estimer la variabilité des horaires. Continuez à enregistrer vos couchers et levers.',
    )
  }

  if (
    metrics.efficiency.sleepEfficiencyPercent != null &&
    metrics.efficiency.aboveClinicalTibRestrictionThreshold85 === false
  ) {
    recommendations.push(
      'Votre efficacité (TST/TIB) est inférieure au seuil de 85 % utilisé dans le contexte clinique de restriction du temps au lit. ' +
        'Ce seuil n’est pas une définition universelle de la qualité du sommeil. ' +
        'Le moteur ne modifie pas automatiquement votre temps au lit.',
    )
  }

  // Signaux répétés de déficit marqué → orientation vers un professionnel (pas un diagnostic).
  if (metrics.quantity.scientific_status === 'deficit' && metrics.quantity.tstHours < 5) {
    warnings.push(
      'Déficit de sommeil marqué. Si la fatigue, les ronflements, les pauses respiratoires ou l’hypersomnolence diurne persistent, ' +
        'consultez un professionnel de santé. Cette application ne pose aucun diagnostic.',
    )
  }

  if (
    metrics.catchUp.recoveryNeeded &&
    metrics.catchUp.workdayAverageTstHours != null &&
    metrics.catchUp.workdayAverageTstHours < 5
  ) {
    warnings.push(
      'Moyenne de sommeil en jours travaillés très basse. Un avis médical peut être utile. Aucun diagnostic n’est établi ici.',
    )
  }

  return { recommendations, warnings }
}
