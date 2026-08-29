/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_APP_URL?: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  /** Prototype BPM caméra — activer uniquement en build de test natif. */
  readonly VITE_ENABLE_CAMERA_HEART_RATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
