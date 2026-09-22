import { useEffect, useRef, useState, type RefObject } from 'react'

export type BottomNavMode = 'expanded' | 'compact'

interface UseAdaptiveBottomNavOptions {
  mainRef: RefObject<HTMLElement | null>
  resetKey: string
}

function isEditableElement(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly
  }
  if (element instanceof HTMLSelectElement) return !element.disabled
  return element instanceof HTMLElement && element.isContentEditable
}

function viewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight
}

export function useAdaptiveBottomNav({ mainRef, resetKey }: UseAdaptiveBottomNavOptions) {
  const [mode, setMode] = useState<BottomNavMode>('expanded')
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const lastScrollTop = useRef(0)
  const downwardDistance = useRef(0)
  const upwardDistance = useRef(0)
  const frame = useRef<number | null>(null)
  const viewportReference = useRef(0)

  const expand = () => {
    downwardDistance.current = 0
    upwardDistance.current = 0
    setMode('expanded')
  }

  useEffect(() => {
    expand()
    const main = mainRef.current
    if (!main) return

    lastScrollTop.current = Math.max(0, main.scrollTop)
    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null
        const current = Math.max(0, main.scrollTop)
        const delta = current - lastScrollTop.current
        lastScrollTop.current = current

        if (current <= 4) {
          expand()
          return
        }
        if (delta > 0) {
          downwardDistance.current += delta
          upwardDistance.current = 0
          if (downwardDistance.current >= 52) setMode('compact')
        } else if (delta < 0) {
          upwardDistance.current += -delta
          downwardDistance.current = 0
          if (upwardDistance.current >= 22) setMode('expanded')
        }
      })
    }

    main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      main.removeEventListener('scroll', onScroll)
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current)
        frame.current = null
      }
    }
  }, [mainRef, resetKey])

  useEffect(() => {
    const viewport = window.visualViewport
    viewportReference.current = viewportHeight()

    const resetViewport = () => {
      setKeyboardOpen(false)
      viewportReference.current = viewportHeight()
      expand()
    }

    const syncKeyboard = () => {
      const active = isEditableElement(document.activeElement)
      const height = viewportHeight()
      const reference = viewportReference.current || height
      const significantDrop = height < reference - Math.max(120, reference * 0.15)
      setKeyboardOpen(active && significantDrop)
      if (!active) viewportReference.current = height
    }

    const onFocusIn = () => window.requestAnimationFrame(syncKeyboard)
    const onFocusOut = () => window.requestAnimationFrame(() => {
      if (!isEditableElement(document.activeElement)) {
        setKeyboardOpen(false)
        viewportReference.current = viewportHeight()
        expand()
      } else {
        syncKeyboard()
      }
    })
    const onViewportResize = () => window.requestAnimationFrame(syncKeyboard)
    const onOrientationChange = () => window.requestAnimationFrame(resetViewport)

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    viewport?.addEventListener('resize', onViewportResize)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      viewport?.removeEventListener('resize', onViewportResize)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [])

  return {
    mode,
    keyboardOpen,
    expand,
  }
}
