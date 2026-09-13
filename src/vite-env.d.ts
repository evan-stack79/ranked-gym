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
  /** When true, request Convex as primary cloud backend. Phase A ignores this for I/O. */
  readonly VITE_ENABLE_CONVEX_PRIMARY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
