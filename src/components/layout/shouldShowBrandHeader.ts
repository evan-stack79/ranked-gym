import type { TabId } from '../../types'

/** Barre marque Ranked Gym : sticky uniquement sur Nutrition (`nutrition`) et Train (`training`). */
export function shouldShowBrandHeader(activeTab: TabId, chromeHidden = false): boolean {
  if (chromeHidden) return false
  return activeTab === 'nutrition' || activeTab === 'training'
}
