import type { LocalActivityItem } from '../data/localActivityFeed'

export const ANONYMOUS_ATHLETE_LABEL = 'Athlète Furtif'

/** Pseudo affiché dans le feed — masqué pour les autres si Mode Furtif actif. */
export function getFeedDisplayName(item: LocalActivityItem): string {
  if (item.isGhostModeEnabled && !item.isSelf) {
    return ANONYMOUS_ATHLETE_LABEL
  }
  return item.user
}

/** Carte anonymisée pour les autres utilisateurs. */
export function isAnonymousToViewer(item: LocalActivityItem): boolean {
  return item.isGhostModeEnabled && !item.isSelf
}

/** L'utilisateur voit sa propre activité masquée pour les autres. */
export function isSelfGhostPreview(item: LocalActivityItem): boolean {
  return item.isGhostModeEnabled && Boolean(item.isSelf)
}
