import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { acquireBodyScrollLock } from '../../utils/bodyScrollLock'

interface IosSheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Sticky footer outside the scroll area (e.g. primary action above keyboard). */
  footer?: ReactNode
  /** Prevent backdrop/close while busy */
  dismissible?: boolean
  /** Leading icon or node in header */
  leading?: ReactNode
  /**
   * When true (default if footer is set), panel height follows visualViewport
   * so the sticky footer stays above the iOS keyboard.
   */
  adaptToKeyboard?: boolean
}

function readViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight
}

export function IosSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  dismissible = true,
  leading,
  adaptToKeyboard,
}: IosSheetProps) {
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const followKeyboard = adaptToKeyboard ?? footer != null
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 0 : readViewportHeight(),
  )

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(id)
    }

    setVisible(false)
    const timeout = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(timeout)
  }, [open])

  // Lock lié à `open` (pas à l’animation de démontage) — libéré dès la fermeture.
  useEffect(() => {
    if (!open) return
    return acquireBodyScrollLock()
  }, [open])

  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  useEffect(() => {
    if (!open || !followKeyboard) return
    const sync = () => setViewportHeight(readViewportHeight())
    sync()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', sync)
    viewport?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      viewport?.removeEventListener('resize', sync)
      viewport?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [open, followKeyboard])

  if (!mounted || typeof document === 'undefined') return null

  const panelMaxHeight = followKeyboard
    ? `min(${Math.max(240, viewportHeight - 8)}px, 720px)`
    : 'min(92dvh, 720px)'

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-end justify-center sm:items-center ${
        visible ? '' : 'pointer-events-none'
      }`}
      role="presentation"
    >
      <button
        type="button"
        className={`ios-sheet-backdrop absolute inset-0 bg-black/55 backdrop-blur-[18px] ${
          visible ? 'ios-sheet-backdrop--open' : ''
        } ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-label="Fermer"
        disabled={!dismissible || !visible}
        onClick={() => {
          if (dismissible) onClose()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`ios-sheet-panel relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 sm:mx-4 sm:rounded-[28px] ${
          visible ? 'ios-sheet-panel--open' : 'ios-sheet-panel--closed'
        }`}
        style={{
          maxHeight: panelMaxHeight,
          paddingBottom: footer
            ? undefined
            : 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/25 sm:hidden" aria-hidden="true" />

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-3">
          <div className="min-w-0 flex items-start gap-2.5">
            {leading}
            <div className="min-w-0">
              <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-white">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-[13px] text-[#AEAEB2]">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            className="ios-press flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#AEAEB2] disabled:opacity-40"
            aria-label="Fermer"
          >
            <span className="text-[18px] leading-none">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-1">
          {children}
        </div>

        {footer ? (
          <div
            className="shrink-0 border-t border-white/10 bg-[#1C1C1E]/95 px-5 pt-3 backdrop-blur-md"
            style={{
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
