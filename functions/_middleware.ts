/**
 * Cloudflare Pages middleware — garantit text/html pour la SPA
 * sans écraser les MIME des assets (/assets/*, *.js, *.css…),
 * et applique les en-têtes de durcissement (CSP / HSTS / …).
 *
 * CSP value must stay in sync with `src/security/cspPolicy.ts`
 * (enforced by unit tests — Pages functions cannot import from src/).
 */
interface Env {
  ASSETS?: { fetch: (req: Request) => Promise<Response> }
}

/** Keep aligned with SECURITY_HEADERS in src/security/cspPolicy.ts */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.supabase.co https://*.convex.cloud https://*.convex.site; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://maps.googleapis.com https://maps.gstatic.com https://photon.komoot.io https://nominatim.openstreetmap.org https://world.openfoodfacts.org; media-src 'self' blob: mediastream:; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; manifest-src 'self'; upgrade-insecure-requests; frame-ancestors 'none'",
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next()
  const url = new URL(context.request.url)
  const path = url.pathname

  const headers = new Headers(response.headers)

  // Security headers on every response (assets included).
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }

  // Assets statiques : laisser Cloudflare détecter le bon Content-Type
  if (
    path.startsWith('/assets/') ||
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.png') ||
    path.endsWith('.svg') ||
    path.endsWith('.webmanifest') ||
    path.endsWith('.ico') ||
    path.startsWith('/workbox-')
  ) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  headers.set('Content-Type', 'text/html; charset=UTF-8')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
