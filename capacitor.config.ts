import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rankedgym.app',
  appName: 'Ranked Gym',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    // Info.plist (Capacitor sync) — Pump Check / VictoryCamera
    // NSCameraUsageDescription: Ranked Gym utilise la caméra pour ton Pump Check post-séance.
    // NSPhotoLibraryAddUsageDescription: Ranked Gym enregistre ta carte Pump Check dans ta galerie.
  },
}

export default config
