import { Capacitor } from '@capacitor/core'

/**
 * Status bar iOS/Android : transparente, texte clair, WebView plein écran.
 * Sans overlay, iOS laisse une bande opaque au-dessus du contenu (seam moche).
 */
export async function configureNativeStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setStyle({ style: Style.Dark })
    // Transparent — le mesh / fond app passe sous l’heure et la batterie.
    await StatusBar.setBackgroundColor({ color: '#00000000' })
  } catch (error) {
    console.warn('[status-bar] configure failed', error)
  }
}
