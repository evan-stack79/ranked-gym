/**
 * OP-d prep — CORS whitelist for partner-tool origin (ARCHI_OUTIL_PARTENAIRE §2).
 * Ranked Pro IAP — ARCHI_ABONNEMENT_PRO §4/5 (/iap/*).
 *
 * Partner caisse mutations remain on Convex functions with partnerSessionToken;
 * this HTTP router only exposes health + CORS preflight scaffolding for a future
 * edge wrapper. Set PARTNER_TOOL_ORIGIN in Convex env before live VPS cutover.
 *
 * IAP secrets (Apple/Google) : Convex dashboard only — never VITE_* / never git.
 */
import { httpRouter } from 'convex/server'
import { api } from './_generated/api'
import { httpAction } from './_generated/server'
import { partnerToolCorsHeaders, getPartnerToolAllowedOrigins } from './lib/partnerCors'
import { handleAppleNotification, handleGoogleRtdn } from './lib/iapHttp'

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

http.route({
  path: '/iap/apple/notifications',
  method: 'POST',
  handler: httpAction(async (ctx, request) => handleAppleNotification(ctx, request)),
})

http.route({
  path: '/iap/google/rtdn',
  method: 'POST',
  handler: httpAction(async (ctx, request) => handleGoogleRtdn(ctx, request)),
})

http.route({
  path: '/iap/verify',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let body: {
      sessionToken?: string
      platform?: 'apple' | 'google'
      signedTransaction?: string
      signedRenewalInfo?: string
      purchaseToken?: string
      productId?: string
      basePlanId?: string
      purchaseAttemptId?: string
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!body.sessionToken) {
      return new Response(JSON.stringify({ error: 'missing_session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    try {
      if (body.platform === 'apple') {
        if (!body.signedTransaction) {
          return new Response(JSON.stringify({ error: 'missing_signed_transaction' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const result = await ctx.runAction(api.subscriptionsActions.verifyApplePurchase, {
          sessionToken: body.sessionToken,
          signedTransaction: body.signedTransaction,
          signedRenewalInfo: body.signedRenewalInfo,
          purchaseAttemptId: body.purchaseAttemptId as any,
        })
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (body.platform === 'google') {
        if (!body.purchaseToken || !body.productId) {
          return new Response(JSON.stringify({ error: 'missing_google_fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const result = await ctx.runAction(api.subscriptionsActions.verifyGooglePurchase, {
          sessionToken: body.sessionToken,
          purchaseToken: body.purchaseToken,
          productId: body.productId,
          basePlanId: body.basePlanId,
          purchaseAttemptId: body.purchaseAttemptId as any,
        })
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: 'unknown_platform' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'verify_failed',
          detail: err instanceof Error ? err.message : 'error',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }),
})

export default http
