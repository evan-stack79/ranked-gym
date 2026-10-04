/**
 * Mise à jour PWA — logique pure testable, compatible vite-plugin-pwa (Workbox).
 * Le SW généré écoute `postMessage({ type: 'SKIP_WAITING' })`.
 */

export function hasWaitingWorker(
  registration: Pick<ServiceWorkerRegistration, 'waiting'> | null | undefined,
): boolean {
  return Boolean(registration?.waiting)
}

export function requestSkipWaiting(worker: Pick<ServiceWorker, 'postMessage'>): void {
  worker.postMessage({ type: 'SKIP_WAITING' })
}

type ApplyWaitingUpdateOptions = {
  reload?: () => void
  addControllerChangeListener?: (listener: () => void) => () => void
  scheduleFallbackReload?: (cb: () => void, ms: number) => () => void
  fallbackReloadMs?: number
}

/**
 * Active le SW en attente puis recharge la page.
 * Retourne false s’il n’y a rien à appliquer.
 */
export function applyWaitingUpdate(
  registration: Pick<ServiceWorkerRegistration, 'waiting'>,
  options: ApplyWaitingUpdateOptions = {},
): boolean {
  const waiting = registration.waiting
  if (!waiting) return false

  const reload = options.reload ?? (() => {
    window.location.reload()
  })
  const fallbackReloadMs = options.fallbackReloadMs ?? 600

  let done = false
  const finish = () => {
    if (done) return
    done = true
    removeControllerListener?.()
    cancelFallback?.()
    reload()
  }

  const addListener =
    options.addControllerChangeListener ??
    ((listener: () => void) => {
      navigator.serviceWorker.addEventListener('controllerchange', listener)
      return () => navigator.serviceWorker.removeEventListener('controllerchange', listener)
    })

  const scheduleFallback =
    options.scheduleFallbackReload ??
    ((cb: () => void, ms: number) => {
      const id = window.setTimeout(cb, ms)
      return () => window.clearTimeout(id)
    })

  const removeControllerListener = addListener(finish)
  const cancelFallback = scheduleFallback(finish, fallbackReloadMs)

  requestSkipWaiting(waiting)
  return true
}

type VisibilityUpdateOptions = {
  document?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  onAfterUpdate?: (registration: ServiceWorkerRegistration | undefined) => void
}

/**
 * Au retour au premier plan : `registration.update()` pour découvrir un nouveau SW.
 */
export function subscribeVisibilityUpdate(
  getRegistration: () => Promise<ServiceWorkerRegistration | undefined>,
  options: VisibilityUpdateOptions = {},
): () => void {
  const doc = options.document ?? document

  const onVisibilityChange = () => {
    if (doc.visibilityState !== 'visible') return
    void (async () => {
      let registration: ServiceWorkerRegistration | undefined
      try {
        registration = await getRegistration()
        if (registration) {
          await registration.update()
        }
      } catch {
        /* hors-ligne ou SW indisponible */
      }
      options.onAfterUpdate?.(registration)
    })()
  }

  doc.addEventListener('visibilitychange', onVisibilityChange)
  return () => doc.removeEventListener('visibilitychange', onVisibilityChange)
}

/**
 * Suit `updatefound` / `statechange` pour savoir si un SW est en attente.
 */
export function watchWaitingWorker(
  registration: ServiceWorkerRegistration,
  onWaitingChange: (waiting: boolean) => void,
): () => void {
  const emit = () => onWaitingChange(hasWaitingWorker(registration))
  emit()

  const cleanups: Array<() => void> = []

  const onUpdateFound = () => {
    const installing = registration.installing
    if (!installing) {
      emit()
      return
    }
    const onStateChange = () => {
      emit()
    }
    installing.addEventListener('statechange', onStateChange)
    cleanups.push(() => installing.removeEventListener('statechange', onStateChange))
  }

  registration.addEventListener('updatefound', onUpdateFound)
  cleanups.push(() => registration.removeEventListener('updatefound', onUpdateFound))

  return () => {
    for (const stop of cleanups) stop()
  }
}

export async function getServiceWorkerRegistration(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined
  }
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? undefined
  } catch {
    return undefined
  }
}
