import { collectLocalBackup, hasMeaningfulCloudData } from '../services/cloudBackup'
import { hasCompletedNutritionOnboarding } from '../services/nutritionStorage'

export type BootIssueKind = 'recoverable' | 'blocking'

export function hasUsableLocalCache(): boolean {
  try {
    if (hasCompletedNutritionOnboarding()) return true
    return hasMeaningfulCloudData(collectLocalBackup())
  } catch {
    return false
  }
}

export function classifyHydrateFailure(input: {
  hasProfile: boolean
  hasLocalCache: boolean
}): BootIssueKind {
  if (input.hasProfile || input.hasLocalCache) return 'recoverable'
  return 'blocking'
}
