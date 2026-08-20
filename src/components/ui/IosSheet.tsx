import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface IosSheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Prevent backdrop/close while busy */
  dismissible?: boolean
  /** Leading icon or node in header */
  leading?: ReactNode
}

export function IosSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  dismissible = true,
  leading,
}: IosSheetProps) {
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(id)
    }

    setVisible(false)
    const timeout = window.setTimeout(() => setMounted(false), 320)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted || !dismissible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted, dismissible, onClose])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className={`ios-sheet-backdrop absolute inset-0 bg-black/55 backdrop-blur-[18px] transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Fermer"
        disabled={!dismissible}
        onClick={() => {
          if (dismissible) onClose()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`ios-sheet-panel relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/12 bg-[#1C1C1E]/96 sm:mx-4 sm:rounded-[28px] ${
          visible ? 'ios-sheet-panel--open' : 'ios-sheet-panel--closed'
        }`}
        style={{
          boxShadow:
            '0 -12px 40px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.1)',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
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
              {subtitle && <p className="mt-0.5 text-[13px] text-[#8E8E93]">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            className="ios-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#8E8E93] disabled:opacity-40"
            aria-label="Fermer"
          >
            <span className="text-[18px] leading-none">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
