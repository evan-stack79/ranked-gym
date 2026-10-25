/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setOverlaysWebView = vi.fn(async () => undefined)
const setStyle = vi.fn(async () => undefined)
const setBackgroundColor = vi.fn(async () => undefined)

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
  },
}))

vi.mock('@capacitor/status-bar', () => ({
  Style: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
  StatusBar: {
    setOverlaysWebView,
    setStyle,
    setBackgroundColor,
  },
}))

describe('configureNativeStatusBar', () => {
  beforeEach(() => {
    setOverlaysWebView.mockClear()
    setStyle.mockClear()
    setBackgroundColor.mockClear()
  })

  it('active l’overlay transparent + style sombre (texte clair)', async () => {
    const { configureNativeStatusBar } = await import('./statusBar')
    await configureNativeStatusBar()
    expect(setOverlaysWebView).toHaveBeenCalledWith({ overlay: true })
    expect(setStyle).toHaveBeenCalledWith({ style: 'DARK' })
    expect(setBackgroundColor).toHaveBeenCalledWith({ color: '#00000000' })
  })
})
