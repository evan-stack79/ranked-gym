/** @vitest-environment jsdom */
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BootIssueScreen, RecoverableRetryBar } from './BootIssueScreen'
import {
  USER_BLOCKING_LOAD_TITLE,
  USER_RETRY_LABEL,
  containsForbiddenBootCopy,
} from '../../boot/bootUiCopy'

describe('BootIssueScreen', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('montre un message utilisateur + Réessayer, jamais de stack', () => {
    const onRetry = vi.fn()
    act(() => {
      root.render(
        <StrictMode>
          <BootIssueScreen kind="blocking" onRetry={onRetry} />
        </StrictMode>,
      )
    })
    expect(host.textContent).toContain(USER_BLOCKING_LOAD_TITLE)
    expect(host.textContent).toContain(USER_RETRY_LABEL)
    expect(containsForbiddenBootCopy(host.textContent ?? '')).toBeNull()
    expect(host.textContent ?? '').not.toMatch(/Error|stack|Convex|Supabase/i)
    act(() => {
      host.querySelector('button')?.click()
    })
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('barre récupérable conserve le cache visuel et propose Réessayer', () => {
    const onRetry = vi.fn()
    act(() => {
      root.render(
        <StrictMode>
          <RecoverableRetryBar onRetry={onRetry} />
        </StrictMode>,
      )
    })
    expect(host.querySelector('[data-boot-retry-bar="1"]')).not.toBeNull()
    expect(host.textContent).toContain(USER_RETRY_LABEL)
  })
})
