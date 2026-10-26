import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Shell natif Ranked Gym — fondation uniquement.
 * PWA web inchangée (Vite + vite-plugin-pwa).
 * Aucun plugin HealthKit / Health Connect à ce stade.
 */
const config: CapacitorConfig = {
  appId: 'com.rankedgym.app',
  appName: 'Ranked Gym',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: {
    androidScheme: 'https',
    // Do not allow the WebView to navigate to arbitrary third-party origins.
    // Deep links / auth returns stay on the app origin or system browser.
    allowNavigation: [],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      // Overlay = status bar transparente ; le mesh remonte sous l’heure / batterie.
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#000000',
    // Info.plist (Capacitor sync) — Pump Check / VictoryCamera (déjà utilisés côté web)
    // NSCameraUsageDescription: Ranked Gym utilise la caméra pour ton Pump Check post-séance.
    // NSPhotoLibraryAddUsageDescription: Ranked Gym enregistre ta carte Pump Check dans ta galerie.
  },
  android: {
    allowMixedContent: false,
    // MASVS: backup disabled in AndroidManifest (allowBackup=false + extraction rules).
  },
}

export default config
