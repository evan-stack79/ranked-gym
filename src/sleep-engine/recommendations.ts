import type { SleepMetrics } from './types.ts'

type SleepAgeBand = 'teen' | 'adult' | 'senior'

/**
 * Textes affichés à l’utilisateur — n’altèrent jamais les métriques calculées.
 * Langage courant uniquement (pas de jargon TST/TIB/σ dans l’UI).
 * Aucun diagnostic médical (apnée, insomnie, trouble circadien, etc.).
 */
export function buildSleepRecommendations(
  metrics: SleepMetrics,
  age?: number,
): {
  recommendations: string[]
  warnings: string[]
} {
  const recommendations: string[] = []
  const warnings: string[] = []
  const band = sleepAgeBand(age)

  switch (metrics.quantity.scientific_status) {
    case 'optimal':
      recommendations.push(optimalNightLine(band))
      break
    case 'deficit':
      recommendations.push(
        'Moins de 7 h au lit. Ce soir, au lit un peu plus tôt, à heure régulière.',
      )
      break
    case 'excess':
      // « Plus de 9 h » reste dans le repère ado (8–10 h) : ne pas l’afficher aux 13–18 ans.
      if (band !== 'teen') {
        recommendations.push('Plus de 9 h au lit. Garde la même heure de réveil.')
      }
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

  // Signaux répétés de déficit marqué — phrase courte à l’écran (fiche d’aide ailleurs).
  if (metrics.quantity.scientific_status === 'deficit' && metrics.quantity.tstHours < 5) {
    warnings.push('Nuit très courte.')
  }

  if (
    metrics.catchUp.recoveryNeeded &&
    metrics.catchUp.workdayAverageTstHours != null &&
    metrics.catchUp.workdayAverageTstHours < 5
  ) {
    warnings.push('Tu dors très peu les jours de cours ou de travail.')
  }

  return { recommendations, warnings }
}

function sleepAgeBand(age?: number): SleepAgeBand {
  if (age != null && Number.isFinite(age) && age >= 13 && age <= 18) return 'teen'
  if (age != null && Number.isFinite(age) && age >= 65) return 'senior'
  return 'adult'
}

function optimalNightLine(band: SleepAgeBand): string {
  if (band === 'teen') return 'Nuit (au lit) dans le repère de ton âge : 8 à 10 h.'
  if (band === 'senior') return 'Nuit (au lit) dans le repère de ton âge : 7 à 8 h.'
  return 'Nuit (au lit) dans le repère de ton âge : 7 à 9 h.'
}
