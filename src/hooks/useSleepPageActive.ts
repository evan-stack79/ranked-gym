import { useEffect, useState } from 'react'

/**
 * True when the sleep UI should keep looping Lottie (page visible + app foreground).
 * Listens to visibilitychange and Capacitor App appStateChange.
 */
export function useSleepPageActive(): boolean {
  const [active, setActive] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )

  useEffect(() => {
    const syncDoc = () => {
      setActive(document.visibilityState !== 'hidden')
    }
    syncDoc()
    document.addEventListener('visibilitychange', syncDoc)

    let removeApp: (() => void) | undefined
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          setActive(Boolean(isActive) && document.visibilityState !== 'hidden')
        })
        removeApp = () => {
          void handle.remove()
        }
      } catch {
        // Web / plugin absent — visibilitychange only.
      }
    })()

    return () => {
      document.removeEventListener('visibilitychange', syncDoc)
      removeApp?.()
    }
  }, [])

  return active
}
