import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isSafeExternalNavigationUrl,
  openExternalUrlSafely,
} from './safeExternalNavigation'

describe('isSafeExternalNavigationUrl', () => {
  it('allows https URLs', () => {
    expect(isSafeExternalNavigationUrl('https://ranked-gym.pages.dev/path')).toBe(true)
  })

  it('allows localhost http for web dev', () => {
    expect(isSafeExternalNavigationUrl('http://localhost:5173/')).toBe(true)
    expect(isSafeExternalNavigationUrl('http://127.0.0.1:5173/')).toBe(true)
  })

  it('rejects dangerous and native-only schemes', () => {
    expect(isSafeExternalNavigationUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalNavigationUrl('data:text/html,hi')).toBe(false)
    expect(isSafeExternalNavigationUrl('capacitor://localhost')).toBe(false)
    expect(isSafeExternalNavigationUrl('ionic://localhost')).toBe(false)
    expect(isSafeExternalNavigationUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeExternalNavigationUrl('http://evil.example.com')).toBe(false)
  })
})

describe('openExternalUrlSafely', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens allowed URLs with noopener/noreferrer', () => {
    const open = vi.fn(() => ({ opener: 'set-me' }) as unknown as Window)
    vi.stubGlobal('open', open)
    expect(openExternalUrlSafely('https://example.com')).toBe(true)
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })

  it('does not navigate for blocked URLs', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    expect(openExternalUrlSafely('javascript:alert(1)')).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
