/**
 * Canonical Content-Security-Policy for Ranked Gym (web + Capacitor WebView).
 *
 * Allowlist is derived from actual client call sites:
 * - Supabase (REST/Auth/Storage/Functions + Realtime WS)
 * - Convex (HTTPS + WSS + *.convex.site file URLs) when VITE_CONVEX_URL is set
 * - Google Maps JS Places loader
 * - Photon / Nominatim geocoding
 * - Open Food Facts product search
 *
 * Keep in sync with `public/_headers`, `index.html` meta CSP, and
 * `functions/_middleware.ts` — enforced by `cspPolicy.test.ts`.
 */

/** Directives that apply in both HTTP header and <meta http-equiv> CSP. */
export const CSP_META_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  // Boot script is external (`/boot-t0.js`); Maps JS is the only third-party script host.
  "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
  // React inline styles + boot splash <style> in index.html.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co https://*.convex.cloud https://*.convex.site",
  "font-src 'self'",
  [
    "connect-src 'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.convex.cloud',
    'wss://*.convex.cloud',
    'https://*.convex.site',
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://photon.komoot.io',
    'https://nominatim.openstreetmap.org',
    'https://world.openfoodfacts.org',
  ].join(' '),
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'none'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
] as const

/** Header-only: frame-ancestors is ignored in meta CSP. */
export const CSP_HEADER_ONLY_DIRECTIVES = ["frame-ancestors 'none'"] as const

export const CSP_HEADER_VALUE = [...CSP_META_DIRECTIVES, ...CSP_HEADER_ONLY_DIRECTIVES].join('; ')

export const CSP_META_VALUE = CSP_META_DIRECTIVES.join('; ')

/** Domains the app is allowed to connect to (for policy smoke tests). */
export const CSP_CONNECT_ALLOWLIST = [
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'https://*.convex.cloud',
  'wss://*.convex.cloud',
  'https://*.convex.site',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://photon.komoot.io',
  'https://nominatim.openstreetmap.org',
  'https://world.openfoodfacts.org',
] as const

/** Hosts / markers that must never appear anywhere in the CSP. */
export const CSP_FORBIDDEN_HOST_MARKERS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'googletagmanager.com',
  'google-analytics.com',
  'facebook.net',
  'doubleclick.net',
] as const

/** Markers forbidden specifically inside script-src (style-src may use unsafe-inline). */
export const CSP_SCRIPT_SRC_FORBIDDEN = [
  "'unsafe-inline'",
  "'unsafe-eval'",
  'data:',
  'blob:',
] as const

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_HEADER_VALUE,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
  // Pages / Workers are HTTPS-only in production.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
} as const
