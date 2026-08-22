import type { LocalActivityItem } from '../data/localActivityFeed'

const GHOST_ARENA_LABEL = 'Dans l’arène'

/** Texte d'activité affiché — masque la localisation si mode furtif actif. */
export function formatActivityAction(item: LocalActivityItem, areaName: string): string {
  const zone = areaName.trim() || 'ta zone'

  if (item.isGhostModeEnabled) {
    if (!item.hasLocation) return item.action
    return `${item.action} · ${GHOST_ARENA_LABEL}`
  }

  if (!item.hasLocation) return item.action

  if (item.locationStyle === 'near') {
    return `${item.action} près de ${zone}`
  }

  return `${item.action} · ${zone}`
}

export { GHOST_ARENA_LABEL }
