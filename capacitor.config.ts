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
  },
  ios: {
    contentInset: 'automatic',
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
