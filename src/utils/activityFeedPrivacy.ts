import type { LocalActivityItem } from '../data/localActivityFeed'

/** Texte d'activité affiché — masque la localisation si mode furtif actif. */
export function formatActivityAction(item: LocalActivityItem, areaName: string): string {
  if (item.isGhostModeEnabled || !item.hasLocation) {
    return item.action
  }

  const zone = areaName.trim() || 'ta zone'

  if (item.locationStyle === 'near') {
    return `${item.action} près de ${zone}`
  }

  return `${item.action} · ${zone}`
}
