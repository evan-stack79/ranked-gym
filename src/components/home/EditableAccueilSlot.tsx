import { Minus } from 'lucide-react'
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  ACCUEIL_LONG_PRESS_MOVE_PX,
  ACCUEIL_LONG_PRESS_MS,
  movementExceedsThreshold,
} from '../../utils/accueilEditGestures'
import type { AccueilWidgetId } from '../../utils/accueilWidgetPrefs'

interface EditableAccueilSlotProps {
  id: AccueilWidgetId
  editMode: boolean
  reducedMotion: boolean
  dragging: boolean
  onEnterEdit: () => void
  onHide: (id: AccueilWidgetId) => void
  onDragStart: (id: AccueilWidgetId, clientX: number, clientY: number) => void
  onDragMove: (clientX: number, clientY: number) => void
  onDragEnd: () => void
  children: ReactNode
}

/**
 * Wraps an Accueil widget for iOS-style home edit:
 * long-press to enter, wiggle / dashed outline, trash badge, drag reorder.
 */
export function EditableAccueilSlot({
  id,
  editMode,
  reducedMotion,
  dragging,
  onEnterEdit,
  onHide,
  onDragStart,
  onDragMove,
  onDragEnd,
  children,
}: EditableAccueilSlotProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{
    timer: number | null
    startX: number
    startY: number
    pointerId: number | null
    dragging: boolean
  }>({ timer: null, startX: 0, startY: 0, pointerId: null, dragging: false })

  const clearPressTimer = () => {
    const p = pressRef.current
    if (p.timer != null) {
      window.clearTimeout(p.timer)
      p.timer = null
    }
  }

  useEffect(() => () => clearPressTimer(), [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // Trash / add chrome handle their own clicks
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-accueil-tile-trash]')) return

    pressRef.current.startX = e.clientX
    pressRef.current.startY = e.clientY
    pressRef.current.pointerId = e.pointerId
    pressRef.current.dragging = false
    clearPressTimer()

    if (editMode) {
      pressRef.current.dragging = true
      onDragStart(id, e.clientX, e.clientY)
      try {
        rootRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      return
    }

    pressRef.current.timer = window.setTimeout(() => {
      pressRef.current.timer = null
      onEnterEdit()
    }, ACCUEIL_LONG_PRESS_MS)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pressRef.current
    if (p.pointerId !== e.pointerId) return

    if (!editMode && p.timer != null) {
      if (
        movementExceedsThreshold(
          p.startX,
          p.startY,
          e.clientX,
          e.clientY,
          ACCUEIL_LONG_PRESS_MOVE_PX,
        )
      ) {
        clearPressTimer()
      }
      return
    }

    if (editMode && p.dragging) {
      onDragMove(e.clientX, e.clientY)
    }
  }

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pressRef.current
    if (p.pointerId !== e.pointerId) return
    clearPressTimer()
    if (editMode && p.dragging) {
      onDragEnd()
    }
    p.dragging = false
    p.pointerId = null
    try {
      rootRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={rootRef}
      className={[
        'accueil-edit-slot',
        editMode ? 'accueil-edit-slot--editing' : '',
        editMode && !reducedMotion ? 'accueil-edit-slot--wiggle' : '',
        editMode && reducedMotion ? 'accueil-edit-slot--dashed' : '',
        dragging ? 'accueil-edit-slot--dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-accueil-edit-slot={id}
      data-accueil-editing={editMode ? '1' : '0'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {editMode ? (
        <button
          type="button"
          className="accueil-edit-slot__trash"
          aria-label="Masquer ce bloc"
          data-accueil-tile-trash={id}
          onClick={(ev) => {
            ev.stopPropagation()
            onHide(id)
          }}
          onPointerDown={(ev) => ev.stopPropagation()}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </button>
      ) : null}
      <div className="accueil-edit-slot__body">{children}</div>
    </div>
  )
}
