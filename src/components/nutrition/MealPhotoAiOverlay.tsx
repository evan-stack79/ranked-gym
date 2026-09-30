import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { acquireBodyScrollLock } from '../../utils/bodyScrollLock'
import { MealPhotoAiLoadingState } from './MealPhotoAiLoadingState'

export type MealPhotoAiOverlayProps = {
  open: boolean
  previewUrl?: string | null
}

export function MealPhotoAiOverlay({ open, previewUrl = null }: MealPhotoAiOverlayProps) {
  useEffect(() => {
    if (!open) return
    return acquireBodyScrollLock()
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="meal-photo-ai-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-photo-ai-title"
      aria-busy="true"
    >
      <div className="meal-photo-ai-overlay__card">
        <p className="meal-photo-ai-overlay__kicker">Photo IA</p>
        <h2 id="meal-photo-ai-title" className="meal-photo-ai-overlay__title">
          Analyse du repas
        </h2>
        <MealPhotoAiLoadingState previewUrl={previewUrl} />
      </div>
    </div>,
    document.body,
  )
}
