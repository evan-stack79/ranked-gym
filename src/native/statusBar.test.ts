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
  StatusBar: {
    setOverlaysWebView,
    setStyle,
    setBackgroundColor,
  },
  Style: { Dark: 'DARK' },
}))

describe('configureNativeStatusBar', () => {
  beforeEach(() => {
    setOverlaysWebView.mockClear()
    setStyle.mockClear()
    setBackgroundColor.mockClear()
  })

  it('overlays the WebView with a transparent dark status bar on native', async () => {
    const { configureNativeStatusBar } = await import('./statusBar')
    await configureNativeStatusBar()
    expect(setOverlaysWebView).toHaveBeenCalledWith({ overlay: true })
    expect(setStyle).toHaveBeenCalledWith({ style: 'DARK' })
    expect(setBackgroundColor).toHaveBeenCalledWith({ color: '#00000000' })
  })
})
