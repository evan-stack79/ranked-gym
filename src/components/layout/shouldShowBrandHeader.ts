import type { TabId } from '../../types'

/** Barre marque Ranked Gym : sticky uniquement sur Nutrition (`nutrition`) et Train (`training`). */
export function shouldShowBrandHeader(
  activeTab: TabId,
  chromeHidden = false,
  contentFullBleed = false,
): boolean {
  if (chromeHidden || contentFullBleed) return false
  return activeTab === 'nutrition' || activeTab === 'training'
}
