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
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    // Info.plist (Capacitor sync) — Pump Check / VictoryCamera (déjà utilisés côté web)
    // NSCameraUsageDescription: Ranked Gym utilise la caméra pour ton Pump Check post-séance.
    // NSPhotoLibraryAddUsageDescription: Ranked Gym enregistre ta carte Pump Check dans ta galerie.
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
