/**
 * OP-d prep — CORS whitelist for partner-tool origin (ARCHI_OUTIL_PARTENAIRE §2).
 * Marketing Ranked Gym origin is intentionally NOT allowed here.
 *
 * Partner caisse mutations remain on Convex functions with partnerSessionToken;
 * this HTTP router only exposes health + CORS preflight scaffolding for a future
 * edge wrapper. Set PARTNER_TOOL_ORIGIN in Convex env before live VPS cutover.
 */
import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { partnerToolCorsHeaders, getPartnerToolAllowedOrigins } from './lib/partnerCors'

const http = httpRouter()

http.route({
  path: '/partner-tool/health',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('Origin')
    const headers = partnerToolCorsHeaders(origin)
    return new Response(
      JSON.stringify({
        ok: true,
        service: 'ranked-gym-partner-tool',
        allowedOriginsConfigured: getPartnerToolAllowedOrigins().length,
      }),
      {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      },
    )
  }),
})

http.route({
  path: '/partner-tool/health',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get('Origin')
    return new Response(null, {
      status: 204,
      headers: partnerToolCorsHeaders(origin),
    })
  }),
})

export default http
