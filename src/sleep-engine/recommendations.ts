import type { SleepMetrics } from './types.ts'

/**
 * Textes affichés à l’utilisateur — n’altèrent jamais les métriques calculées.
 * Langage courant uniquement (pas de jargon TST/TIB/σ dans l’UI).
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
        'Tu as dormi entre 7 et 9 heures, la plage habituelle pour un adulte.',
      )
      break
    case 'deficit':
      recommendations.push(
        'Tu as dormi moins de 7 heures. Essaie de te coucher un peu plus tôt, en gardant des horaires stables.',
      )
      break
    case 'excess':
      recommendations.push(
        'Tu as dormi plus de 9 heures. Un sommeil très long tous les jours n’est pas idéal ; garde des horaires réguliers.',
      )
      break
  }

  if (metrics.catchUp.recoveryNeeded && metrics.catchUp.recommendation) {
    recommendations.push(metrics.catchUp.recommendation)
  }

  if (metrics.regularity.insufficientHistory) {
    recommendations.push(
      'Encore trop peu de nuits pour juger si tes horaires sont stables. Continue d’enregistrer tes couchers et levers.',
    )
  }

  if (
    metrics.efficiency.sleepEfficiencyPercent != null &&
    metrics.efficiency.aboveClinicalTibRestrictionThreshold85 === false
  ) {
    recommendations.push(
      'Une partie notable du temps passé au lit n’était pas du sommeil. L’app ne change pas pour autant tes horaires automatiquement.',
    )
  }

  // Signaux répétés de déficit marqué → orientation vers un professionnel (pas un diagnostic).
  if (metrics.quantity.scientific_status === 'deficit' && metrics.quantity.tstHours < 5) {
    warnings.push(
      'Tu as dormi très peu. Si la fatigue, les ronflements, les pauses respiratoires ou une somnolence importante dans la journée persistent, parle-en à un professionnel de santé. Cette app ne pose aucun diagnostic.',
    )
  }

  if (
    metrics.catchUp.recoveryNeeded &&
    metrics.catchUp.workdayAverageTstHours != null &&
    metrics.catchUp.workdayAverageTstHours < 5
  ) {
    warnings.push(
      'En moyenne, tu dors très peu les jours travaillés. Un avis médical peut être utile. Aucun diagnostic n’est établi ici.',
    )
  }

  return { recommendations, warnings }
}
