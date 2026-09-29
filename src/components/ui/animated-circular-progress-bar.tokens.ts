/** Magic UI Animated Circular Progress Bar — 1s ease on stroke-dasharray. */

export const ANIMATED_CIRCULAR_PROGRESS_DURATION = '1s'
export const ANIMATED_CIRCULAR_PROGRESS_EASING = 'ease'

export function circularProgressTransition(animated: boolean): string {
  if (!animated) return 'none'
  return `stroke-dasharray ${ANIMATED_CIRCULAR_PROGRESS_DURATION} ${ANIMATED_CIRCULAR_PROGRESS_EASING}, transform ${ANIMATED_CIRCULAR_PROGRESS_DURATION} ${ANIMATED_CIRCULAR_PROGRESS_EASING}`
}
