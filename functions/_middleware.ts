/**
 * Cloudflare Pages middleware — garantit text/html pour la SPA
 * sans écraser les MIME des assets (/assets/*, *.js, *.css…).
 */
interface Env {
  ASSETS?: { fetch: (req: Request) => Promise<Response> }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next()
  const url = new URL(context.request.url)
  const path = url.pathname

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
    return response
  }

  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'text/html; charset=UTF-8')
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
