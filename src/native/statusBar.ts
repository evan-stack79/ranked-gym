import { Capacitor } from '@capacitor/core'

/**
 * Status bar iOS/Android : transparente, texte clair, WebView plein écran.
 * Sans overlay, iOS laisse une bande opaque au-dessus du contenu (seam moche).
 * Pair with capacitor.config.ts plugins.StatusBar.overlaysWebView = true and
 * ios.contentInset = 'never' (CSS env(safe-area-inset-*) owns padding).
 */
export async function configureNativeStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setStyle({ style: Style.Dark })
    // Transparent — the mesh / app background runs under clock & battery.
    await StatusBar.setBackgroundColor({ color: '#00000000' })
  } catch (error) {
    console.warn('[status-bar] configure failed', error)
  }
}
