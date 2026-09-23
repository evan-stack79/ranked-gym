/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_APP_URL?: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  /** Prototype BPM caméra — activer uniquement en build de test natif. */
  readonly VITE_ENABLE_CAMERA_HEART_RATE?: string
  /** Convex deployment URL (https://….convex.cloud). Unused until cutover. */
  readonly VITE_CONVEX_URL?: string
  /** When true, request Convex as primary cloud backend for profile/train/nutrition/sleep/streak. */
  readonly VITE_ENABLE_CONVEX_PRIMARY?: string
  /** Dedicated auth migration flag: enable Convex auth adapter. */
  readonly VITE_ENABLE_CONVEX_AUTH?: string
  /** Reco Training personnalisées. Unset = ON en DEV/test, OFF en prod. */
  readonly VITE_ENABLE_TRAINING_RECOMMENDATIONS?: string
  /** Validation auto de série + minuteur. Unset = ON en DEV/test, OFF en prod. */
  readonly VITE_ENABLE_AUTO_SET_VALIDATION?: string
  /** Onboarding multisport. Unset = ON en DEV/test, OFF en prod. */
  readonly VITE_ENABLE_SPORTS_ONBOARDING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
