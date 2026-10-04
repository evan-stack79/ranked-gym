import { useCallback, useEffect, useRef, useState } from 'react'
import { formatAppVersionLabel, getAppBuildId } from '../pwa/appBuildId'
import {
  applyWaitingUpdate,
  getServiceWorkerRegistration,
  hasWaitingWorker,
  subscribeVisibilityUpdate,
  watchWaitingWorker,
} from '../pwa/pwaUpdate'

/**
 * Pastille de version + détection d’un SW en attente.
 * Le contrôle `visibilitychange → update()` tourne dès le montage
 * (à brancher aussi via `usePwaLifecycle` au niveau app).
 */
export function usePwaUpdate() {
  const [updateReady, setUpdateReady] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    let cancelled = false
    let stopVisibility: (() => void) | undefined
    let stopWaiting: (() => void) | undefined

    void (async () => {
      const registration = await getServiceWorkerRegistration()
      if (cancelled || !registration) return

      registrationRef.current = registration
      setUpdateReady(hasWaitingWorker(registration))
      stopWaiting = watchWaitingWorker(registration, (waiting) => {
        if (!cancelled) setUpdateReady(waiting)
      })
      stopVisibility = subscribeVisibilityUpdate(async () => registration, {
        onAfterUpdate: (reg) => {
          if (!cancelled) setUpdateReady(hasWaitingWorker(reg))
        },
      })

      try {
        await registration.update()
      } catch {
        /* hors-ligne */
      }
      if (!cancelled) setUpdateReady(hasWaitingWorker(registration))
    })()

    return () => {
      cancelled = true
      stopVisibility?.()
      stopWaiting?.()
    }
  }, [])

  const applyUpdate = useCallback(() => {
    const registration = registrationRef.current
    if (!registration) return
    applyWaitingUpdate(registration)
  }, [])

  return {
    buildId: getAppBuildId(),
    buildLabel: formatAppVersionLabel(),
    updateReady,
    applyUpdate,
  }
}

/**
 * Écoute silencieuse au premier plan (pas d’UI).
 * À monter une fois dans l’app pour forcer `registration.update()`.
 */
export function usePwaLifecycle() {
  useEffect(() => {
    let cancelled = false
    let stopVisibility: (() => void) | undefined

    void (async () => {
      const registration = await getServiceWorkerRegistration()
      if (cancelled || !registration) return

      stopVisibility = subscribeVisibilityUpdate(async () => registration)

      try {
        await registration.update()
      } catch {
        /* hors-ligne */
      }
    })()

    return () => {
      cancelled = true
      stopVisibility?.()
    }
  }, [])
}
