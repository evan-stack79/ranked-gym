/** Libellé canonique de l’axe radar — ne jamais utiliser « Égularité » / « Egularité ». */
export const RADAR_REGULARITY_LABEL = 'Régularité'

const TYPO_PATTERNS = [/^égularité$/i, /^egularité$/i, /^égularite$/i, /^egularite$/i]

/** Normalise toute variante fautive vers le libellé officiel. */
export function normalizeRadarRegularityLabel(label: string): string {
  const trimmed = label.trim()
  if (TYPO_PATTERNS.some((p) => p.test(trimmed))) return RADAR_REGULARITY_LABEL
  if (trimmed.toLowerCase().includes('gularit') && !trimmed.startsWith('Rég')) {
    return RADAR_REGULARITY_LABEL
  }
  return trimmed
}

export const RADAR_AXIS_LABELS = {
  upper: 'Upper',
  lower: 'Lower',
  force: 'Force',
  volume: 'Volume',
  regularity: RADAR_REGULARITY_LABEL,
} as const
