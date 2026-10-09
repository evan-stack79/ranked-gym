/**
 * Shared Train start path — same as the bottom ▶ button.
 * Resume active draft, otherwise open the « Nouvelle séance » activity sheet.
 */
export type TrainStartSessionAction = 'resume-draft' | 'open-activity-sheet'

export function resolveTrainStartSessionAction(
  hasActiveDraft: boolean,
): TrainStartSessionAction {
  return hasActiveDraft ? 'resume-draft' : 'open-activity-sheet'
}
