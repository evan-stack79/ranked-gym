import type { LocalActivityItem } from '../data/localActivityFeed'

/** Texte d'activité affiché — le serveur ne renvoie que des labels lissés, jamais de GPS. */
export function formatActivityAction(item: LocalActivityItem, areaName: string): string {
  if (item.distanceLabel) {
    return `${item.action} · ${item.distanceLabel}`
  }

  if (item.isGhostModeEnabled || !item.hasLocation) {
    return item.action
  }

  const zone = areaName.trim() || 'ta zone'

  if (item.locationStyle === 'near') {
    return `${item.action} près de ${zone}`
  }

  return `${item.action} · ${zone}`
}
