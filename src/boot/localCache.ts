import { collectLocalBackup, hasMeaningfulCloudData } from '../services/cloudBackup'
import { hasCompletedNutritionOnboarding } from '../services/nutritionStorage'

export function hasUsableLocalCache(): boolean {
  try {
    if (hasCompletedNutritionOnboarding()) return true
    return hasMeaningfulCloudData(collectLocalBackup())
  } catch {
    return false
  }
}
