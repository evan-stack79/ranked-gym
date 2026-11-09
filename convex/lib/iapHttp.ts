import type { GenericActionCtx } from 'convex/server'
import { internal } from '../_generated/api'
import { readSubscriptionEnv } from './subscriptionEnv'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * POST /iap/apple/notifications — Apple ASN V2.
 * Auth = signature JWS du signedPayload ; traitement via action Node (QA M3).
 */
export async function handleAppleNotification(
  ctx: GenericActionCtx<any>,
  request: Request,
): Promise<Response> {
  let body: { signedPayload?: string }
  try {
    body = (await request.json()) as { signedPayload?: string }
  } catch {
    return json(400, { error: 'invalid_json' })
  }
  if (!body.signedPayload || typeof body.signedPayload !== 'string') {
    return json(400, { error: 'missing_signed_payload' })
  }

  try {
    const result = await ctx.runAction(
      internal.subscriptionsActions.ingestAndProcessAppleNotification,
      { signedPayload: body.signedPayload },
    )
    return json(200, { ok: true, ...result })
  } catch (err) {
    return json(401, {
      error: 'jws_invalid_or_apply_failed',
      detail: err instanceof Error ? err.message : 'verify_failed',
    })
  }
}

/**
 * POST /iap/google/rtdn — Pub/Sub push.
 * JWT OIDC requis (audience + issuer Google + email SA) — QA m1.
 */
export async function handleGoogleRtdn(
  ctx: GenericActionCtx<any>,
  request: Request,
): Promise<Response> {
  const audience = readSubscriptionEnv('GOOGLE_RTDN_AUDIENCE')?.trim()
  const expectedEmail = readSubscriptionEnv('GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL')?.trim()
  const deployEnv = (readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production').toLowerCase()

  if (!audience || !expectedEmail) {
    if (deployEnv === 'production') {
      return json(503, { error: 'google_rtdn_not_configured' })
    }
  } else {
    const auth = request.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) {
      return json(401, { error: 'missing_bearer' })
    }
    const token = auth.slice('Bearer '.length).trim()
    if (!token) return json(401, { error: 'invalid_bearer' })
    try {
      await ctx.runAction(internal.subscriptionsActions.verifyRtdnBearerForHttp, {
        bearerToken: token,
        audience,
        expectedEmail,
      })
    } catch (err) {
      return json(401, {
        error: 'oidc_invalid',
        detail: err instanceof Error ? err.message : 'oidc',
      })
    }
  }

  let body: {
    message?: { messageId?: string; data?: string; attributes?: Record<string, string> }
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  const messageId = body.message?.messageId
  if (!messageId) return json(400, { error: 'missing_message_id' })

  try {
    const result = await ctx.runAction(internal.subscriptionsActions.ingestAndProcessGoogleRtdn, {
      environment: readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production',
      messageId,
      notificationType: body.message?.attributes?.type ?? 'RTDN',
      dataB64: body.message?.data,
    })
    return json(200, { ok: true, ...result })
  } catch (err) {
    return json(400, {
      error: 'rtdn_apply_failed',
      detail: err instanceof Error ? err.message : 'error',
    })
  }
}
