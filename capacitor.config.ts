import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Shell natif Ranked Gym — fondation uniquement.
 * PWA web inchangée (Vite + vite-plugin-pwa).
 * Aucun plugin HealthKit / Health Connect à ce stade.
 *
 * iOS safe-area / Dynamic Island :
 * - `contentInset: 'never'` — le WebView est plein écran ; CSS
 *   `env(safe-area-inset-*)` + `viewport-fit=cover` gèrent haut ET bas.
 *   `automatic` (défaut Cap) inset le scrollView sans exposer correctement
 *   les env() aux éléments fixed/sticky → contenu sous l’heure / Dynamic Island.
 * - StatusBar.overlaysWebView — pas de bande opaque au-dessus du mesh.
 * Ces valeurs vivent ICI (source de vérité) : `npx cap sync ios` les recopie
 * dans le projet natif. Ne jamais re-basculer en `automatic` sans tests IPA.
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
    // Ranked Pro — finaliser seulement après validation Convex (ARCHI AB-a).
    NativePurchases: {
      autoFinishTransactions: false,
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
