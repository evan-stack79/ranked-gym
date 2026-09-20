import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { acquireBodyScrollLock } from '../../utils/bodyScrollLock'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
// Les transitions activité → catalogue → saisie partagent leur déclencheur externe.
let returnFocus: HTMLElement | null = null

const SWIPE_CLOSE_PX = 88

/** Focus et mouvement propres aux sheets Train ; aucun effet sur IosSheet partagé. */
export function TrainSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  dismissible = true,
  leading,
  headerActions,
  tone = 'default',
  overlay,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  dismissible?: boolean
  leading?: ReactNode
  headerActions?: ReactNode
  tone?: 'default' | 'graphite'
  overlay?: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  const dragRef = useRef({ active: false, startY: 0, dy: 0 })
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const graphite = tone === 'graphite'

  useEffect(() => {
    closeRef.current = onClose
    dismissibleRef.current = dismissible
  }, [onClose, dismissible])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timeout = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (previous && previous !== document.body && !previous.closest('.train-sheet')) returnFocus = previous
    const release = acquireBodyScrollLock()
    const focusables = () => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(el => el.getClientRects().length > 0 && !el.closest('[inert]'))
    const frame = requestAnimationFrame(() => {
      setVisible(true)
      if (!panel.contains(document.activeElement)) (focusables()[0] ?? panel).focus()
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const elements = focusables()
      const first = elements[0] ?? panel
      const last = elements.at(-1) ?? panel
      if (!panel.contains(document.activeElement) || document.activeElement === panel) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      setVisible(false)
      release()
      window.removeEventListener('keydown', onKey)
      // Ne pas voler le focus d’une autre sheet Train déjà ouverte.
      const otherSheet = [...document.querySelectorAll('.train-sheet [role="dialog"]')]
        .some((el) => el !== panel)
      if (!otherSheet && returnFocus?.isConnected) returnFocus.focus()
    }
  }, [open, mounted])

  const clearDragTransform = () => {
    const panel = panelRef.current
    if (!panel) return
    panel.style.transform = ''
    panel.style.transition = ''
  }

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dismissible || !visible) return
    if (event.button !== 0) return
    const target = event.target
    if (target instanceof Element && target.closest('button, a, input, textarea, select, [role="menu"]')) {
      return
    }
    dragRef.current = { active: true, startY: event.clientY, dy: 0 }
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dy = Math.max(0, event.clientY - dragRef.current.startY)
    dragRef.current.dy = dy
    const panel = panelRef.current
    if (!panel) return
    panel.style.transition = 'none'
    panel.style.transform = `translate3d(0, ${dy}px, 0)`
  }

  const onHandlePointerUp = () => {
    if (!dragRef.current.active) return
    const dy = dragRef.current.dy
    dragRef.current.active = false
    if (dy >= SWIPE_CLOSE_PX && dismissibleRef.current) {
      clearDragTransform()
      closeRef.current()
      return
    }
    clearDragTransform()
  }

  if (!mounted) return null
  return createPortal(
    <div
      className={`train-sheet fixed inset-0 z-[100] flex justify-center ${
        graphite ? 'train-sheet--graphite items-end' : 'items-end sm:items-center'
      } ${visible ? '' : 'pointer-events-none'}`}
      data-train-sheet-tone={tone}
    >
      <button
        type="button" tabIndex={-1} aria-label="Fermer"
        className={`ios-sheet-backdrop absolute inset-0 bg-black/55 ${
          graphite ? '' : 'backdrop-blur-[18px]'
        } ${
          visible ? 'ios-sheet-backdrop--open' : ''
        } ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        disabled={!dismissible || !visible}
        onClick={() => {
          if (dismissible) onClose()
        }}
      />
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`ios-sheet-panel relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] ${
          graphite
            ? 'max-h-[min(92dvh,720px)] min-h-[min(52dvh,520px)] border border-[#161618] sm:mx-0'
            : 'max-h-[min(92dvh,720px)] border border-white/10 sm:mx-4 sm:rounded-[28px]'
        } ${visible ? 'ios-sheet-panel--open' : 'ios-sheet-panel--closed'}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div
          data-sheet-handle
          className="flex shrink-0 touch-none flex-col"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div
            className={`mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25 ${graphite ? '' : 'sm:hidden'}`}
            aria-hidden="true"
          />
          <div className="flex items-start justify-between gap-2 px-5 pb-2 pt-3">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {leading}
              <div className="min-w-0">
                <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-white">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[13px] text-[#AEAEB2]">{subtitle}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-start">
              {headerActions}
              <button type="button" onClick={onClose} disabled={!dismissible} aria-label="Fermer"
                className={`ios-press flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[#AEAEB2] disabled:opacity-40 ${
                  graphite
                    ? 'text-[22px] leading-none'
                    : 'rounded-full border border-white/10 bg-white/5 text-[18px] leading-none'
                }`}>
                ×
              </button>
            </div>
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-1"
          data-sheet-scroll
          inert={overlay ? true : undefined}
        >
          {children}
        </div>
        {overlay ? (
          <div className={`absolute inset-0 z-20 overflow-y-auto overscroll-contain px-5 ${graphite ? 'bg-[#070708]' : 'bg-[var(--color-card)]'}`}>
            {overlay}
          </div>
        ) : null}
      </div>
    </div>, document.body,
  )
}
