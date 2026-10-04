import { describe, expect, it, vi } from 'vitest'
import {
  applyWaitingUpdate,
  hasWaitingWorker,
  requestSkipWaiting,
  subscribeVisibilityUpdate,
} from './pwaUpdate'

describe('pwaUpdate', () => {
  it('détecte un worker en attente', () => {
    expect(hasWaitingWorker({ waiting: {} as ServiceWorker })).toBe(true)
    expect(hasWaitingWorker({ waiting: null })).toBe(false)
    expect(hasWaitingWorker(null)).toBe(false)
    expect(hasWaitingWorker(undefined)).toBe(false)
  })

  it('envoie SKIP_WAITING (Workbox / vite-plugin-pwa)', () => {
    const postMessage = vi.fn()
    requestSkipWaiting({ postMessage })
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('applyWaitingUpdate no-op sans waiting', () => {
    const reload = vi.fn()
    expect(applyWaitingUpdate({ waiting: null }, { reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('applyWaitingUpdate skipWaiting puis recharge (controllerchange)', () => {
    const postMessage = vi.fn()
    const reload = vi.fn()
    let listener: (() => void) | undefined
    const remove = vi.fn()

    const ok = applyWaitingUpdate(
      { waiting: { postMessage } as unknown as ServiceWorker },
      {
        reload,
        addControllerChangeListener: (cb) => {
          listener = cb
          return remove
        },
        scheduleFallbackReload: () => () => undefined,
      },
    )

    expect(ok).toBe(true)
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()

    listener?.()
    expect(reload).toHaveBeenCalledTimes(1)

    listener?.()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalled()
  })

  it('applyWaitingUpdate recharge via fallback si pas de controllerchange', () => {
    const postMessage = vi.fn()
    const reload = vi.fn()
    let fallback: (() => void) | undefined

    applyWaitingUpdate(
      { waiting: { postMessage } as unknown as ServiceWorker },
      {
        reload,
        addControllerChangeListener: () => () => undefined,
        scheduleFallbackReload: (cb) => {
          fallback = cb
          return () => undefined
        },
      },
    )

    fallback?.()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('visibilitychange visible → registration.update()', async () => {
    const update = vi.fn(async () => undefined)
    const registration = { update, waiting: null } as unknown as ServiceWorkerRegistration
    const onAfterUpdate = vi.fn()

    type VisDoc = {
      visibilityState: DocumentVisibilityState
      addEventListener: (type: string, listener: () => void) => void
      removeEventListener: (type: string, listener: () => void) => void
    }

    let handler: (() => void) | undefined
    const doc: VisDoc = {
      visibilityState: 'hidden',
      addEventListener: (_type, listener) => {
        handler = listener
      },
      removeEventListener: vi.fn(),
    }

    const stop = subscribeVisibilityUpdate(async () => registration, {
      document: doc,
      onAfterUpdate,
    })

    handler?.()
    await Promise.resolve()
    expect(update).not.toHaveBeenCalled()

    doc.visibilityState = 'visible'
    handler?.()
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1)
      expect(onAfterUpdate).toHaveBeenCalledWith(registration)
    })

    stop()
    expect(doc.removeEventListener).toHaveBeenCalled()
  })
})
