import { Minus } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  ACCUEIL_LONG_PRESS_MOVE_PX,
  ACCUEIL_LONG_PRESS_MS,
  movementExceedsThreshold,
} from '../../utils/accueilEditGestures'
import {
  ACCUEIL_DROP_MS,
  cancelElementAnimations,
  playFlipTranslate,
} from '../../utils/accueilFlip'
import type { AccueilWidgetId } from '../../utils/accueilWidgetPrefs'

export type DragPoint = { clientX: number; clientY: number; offsetX: number; offsetY: number }

export type DropGlideFrom = {
  left: number
  top: number
  width: number
  height: number
}

interface EditableAccueilSlotProps {
  id: AccueilWidgetId
  editMode: boolean
  reducedMotion: boolean
  dragging: boolean
  exiting?: boolean
  entering?: boolean
  /** Visual rect of the floating body at drop — glide into the layout slot. */
  dropGlide?: DropGlideFrom | null
  /** Live finger offset while this slot is the drag source. */
  dragDelta?: { x: number; y: number } | null
  onEnterEdit: () => void
  onHide: (id: AccueilWidgetId) => void
  onDragStart: (id: AccueilWidgetId, point: DragPoint) => void
  onDragMove: (clientX: number, clientY: number) => void
  onDragEnd: () => void
  onDropGlideDone?: (id: AccueilWidgetId) => void
  children: ReactNode
}

/**
 * Wraps an Accueil widget for iOS-style home edit:
 * long-press to enter, wiggle / dashed outline, trash badge, drag reorder.
 *
 * While dragging, the layout slot stays as an empty placeholder and the tile
 * body is position:fixed under the finger (no sibling text ghosting under it).
 * On drop, the body glides into the slot via transform (FLIP) before wiggle resumes.
 */
export function EditableAccueilSlot({
  id,
  editMode,
  reducedMotion,
  dragging,
  exiting = false,
  entering = false,
  dropGlide = null,
  dragDelta = null,
  onEnterEdit,
  onHide,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDropGlideDone,
  children,
}: EditableAccueilSlotProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{
    timer: number | null
    startX: number
    startY: number
    pointerId: number | null
    dragging: boolean
  }>({ timer: null, startX: 0, startY: 0, pointerId: null, dragging: false })
  const [slotBox, setSlotBox] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [settling, setSettling] = useState(false)
  const dropGlideGenRef = useRef(0)

  const clearPressTimer = () => {
    const p = pressRef.current
    if (p.timer != null) {
      window.clearTimeout(p.timer)
      p.timer = null
    }
  }

  const endDrag = (pointerId: number | null) => {
    clearPressTimer()
    const p = pressRef.current
    const wasDragging = p.dragging
    p.dragging = false
    p.pointerId = null
    if (pointerId != null) {
      try {
        rootRef.current?.releasePointerCapture(pointerId)
      } catch {
        /* ignore */
      }
    }
    if (wasDragging) onDragEnd()
  }

  useEffect(() => () => clearPressTimer(), [])

  // Remount mid-drag: re-sync local press flag from parent dragging prop.
  useEffect(() => {
    if (dragging) {
      pressRef.current.dragging = true
    }
  }, [dragging])

  // Parent clearDrag (sheet open / exit) must drop local press + slot box.
  useLayoutEffect(() => {
    if (!dragging) {
      pressRef.current.dragging = false
      setSlotBox(null)
      return
    }
    const el = rootRef.current
    if (!el) return
    // Prefer the pre-drag measure from pointerdown; only fill if missing.
    setSlotBox((prev) => {
      if (prev) return prev
      const r = el.getBoundingClientRect()
      return { left: r.left, top: r.top, width: r.width, height: r.height }
    })
  }, [dragging])

  // Drop glide: invert from the last floating rect → play into the layout slot.
  useLayoutEffect(() => {
    if (!dropGlide || reducedMotion) {
      if (!dropGlide) setSettling(false)
      return
    }
    const body = bodyRef.current
    const root = rootRef.current
    if (!body || !root) {
      onDropGlideDone?.(id)
      return
    }

    const gen = ++dropGlideGenRef.current
    setSettling(true)

    const to = root.getBoundingClientRect()
    const dx = dropGlide.left - to.left
    const dy = dropGlide.top - to.top

    cancelElementAnimations(body)
    const anim = playFlipTranslate(body, dx, dy, {
      ms: ACCUEIL_DROP_MS,
      fromScale: 1.04,
      toScale: 1,
    })

    const done = () => {
      if (dropGlideGenRef.current !== gen) return
      setSettling(false)
      onDropGlideDone?.(id)
    }

    if (!anim) {
      done()
      return
    }
    anim.finished.then(done).catch(done)
  }, [dropGlide, reducedMotion, id, onDropGlideDone])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-accueil-tile-trash]')) return

    pressRef.current.startX = e.clientX
    pressRef.current.startY = e.clientY
    pressRef.current.pointerId = e.pointerId
    pressRef.current.dragging = false
    clearPressTimer()

    if (editMode) {
      const rect = rootRef.current?.getBoundingClientRect()
      if (rect) {
        setSlotBox({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
      pressRef.current.dragging = true
      onDragStart(id, {
        clientX: e.clientX,
        clientY: e.clientY,
        offsetX: rect ? e.clientX - rect.left : 0,
        offsetY: rect ? e.clientY - rect.top : 0,
      })
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
    endDrag(e.pointerId)
  }

  // Lost capture (sheet / scroll / OS) must clear drag.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onLost = () => {
      if (pressRef.current.dragging) endDrag(pressRef.current.pointerId)
    }
    el.addEventListener('lostpointercapture', onLost)
    return () => el.removeEventListener('lostpointercapture', onLost)
  })

  const dx = dragDelta?.x ?? 0
  const dy = dragDelta?.y ?? 0
  // While dragging: body is position:fixed under the finger; the layout hole
  // is an empty placeholder so sibling FLIP text never ghosts underneath.
  const floating: CSSProperties | undefined =
    dragging && slotBox && !reducedMotion
      ? {
          position: 'fixed',
          left: slotBox.left + dx,
          top: slotBox.top + dy,
          width: slotBox.width,
          height: slotBox.height,
          zIndex: 40,
          margin: 0,
          transform: 'scale(1.04)',
          transition: 'none',
          boxShadow: '0 16px 36px rgb(0 0 0 / 0.55)',
          pointerEvents: 'none',
        }
      : dragging && !reducedMotion
        ? // One frame before measure — keep out of layout flow, invisible.
          {
            position: 'fixed',
            left: -9999,
            top: -9999,
            visibility: 'hidden',
            pointerEvents: 'none',
          }
        : undefined

  const rootStyle: CSSProperties | undefined =
    dragging && slotBox
      ? { minHeight: slotBox.height, height: slotBox.height }
      : undefined

  const wiggling =
    editMode &&
    !reducedMotion &&
    !dragging &&
    !settling &&
    !dropGlide &&
    !exiting &&
    !entering

  return (
    <div
      ref={rootRef}
      className={[
        'accueil-edit-slot',
        editMode ? 'accueil-edit-slot--editing' : '',
        wiggling ? 'accueil-edit-slot--wiggle' : '',
        editMode && reducedMotion ? 'accueil-edit-slot--dashed' : '',
        dragging ? 'accueil-edit-slot--dragging' : '',
        exiting ? 'accueil-edit-slot--exiting' : '',
        entering ? 'accueil-edit-slot--entering' : '',
        settling ? 'accueil-edit-slot--settling' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
      data-accueil-edit-slot={id}
      data-accueil-editing={editMode ? '1' : '0'}
      data-accueil-dragging={dragging ? '1' : '0'}
      data-accueil-exiting={exiting ? '1' : '0'}
      data-accueil-entering={entering ? '1' : '0'}
      data-accueil-settling={settling ? '1' : '0'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {dragging ? (
        <div
          className="accueil-edit-slot__placeholder"
          aria-hidden="true"
          data-accueil-drag-placeholder={id}
          style={
            slotBox
              ? { minHeight: slotBox.height, height: slotBox.height }
              : undefined
          }
        />
      ) : null}
      <div
        ref={bodyRef}
        className={[
          'accueil-edit-slot__body',
          dragging && !reducedMotion ? 'accueil-edit-slot__body--floating' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={floating}
        data-accueil-edit-body={id}
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
        {children}
      </div>
    </div>
  )
}
