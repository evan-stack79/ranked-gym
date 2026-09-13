import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { acquireBodyScrollLock } from '../../utils/bodyScrollLock'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
// Les transitions activité → catalogue → saisie partagent leur déclencheur externe.
let returnFocus: HTMLElement | null = null

/** Focus et mouvement propres aux sheets Train ; aucun effet sur IosSheet partagé. */
export function TrainSheet({
  open, onClose, title, subtitle, children, dismissible = true, leading,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  dismissible?: boolean
  leading?: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
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
      // Une sheet suivante peut déjà être ouverte : ne pas lui voler le focus.
      if (!document.querySelector('.train-sheet [role="dialog"]') && returnFocus?.isConnected) returnFocus.focus()
    }
  }, [open])

  if (!mounted) return null
  return createPortal(
    <div
      className={`train-sheet fixed inset-0 z-[100] flex items-end justify-center sm:items-center ${
        visible ? '' : 'pointer-events-none'
      }`}
    >
      <button
        type="button" tabIndex={-1} aria-label="Fermer"
        className={`ios-sheet-backdrop absolute inset-0 bg-black/55 backdrop-blur-[18px] ${
          visible ? 'ios-sheet-backdrop--open' : ''
        } ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        disabled={!dismissible || !visible}
        onClick={() => {
          if (dismissible) onClose()
        }}
      />
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`ios-sheet-panel relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/12 bg-[#1C1C1E] sm:mx-4 sm:rounded-[28px] ${visible ? 'ios-sheet-panel--open' : 'ios-sheet-panel--closed'}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {leading}
            <div className="min-w-0">
              <h2 id={titleId} className="text-[17px] font-semibold text-white">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13px] text-[#8E8E93]">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={!dismissible} aria-label="Fermer"
            className="ios-press flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#8E8E93] disabled:opacity-40">
            <span className="text-[18px] leading-none">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-1">{children}</div>
      </div>
    </div>, document.body,
  )
}
