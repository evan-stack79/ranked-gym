import type { GenericActionCtx } from 'convex/server'
import { internal } from '../_generated/api'
import {
  decodeJwsPayloadUnsafe,
  verifyAppleJwsSignature,
} from './appleJws'
import { readSubscriptionEnv } from './subscriptionEnv'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return `h${(h >>> 0).toString(16)}`
}

/**
 * POST /iap/apple/notifications — Apple ASN V2.
 * Auth = signature JWS du signedPayload (pas de session joueur).
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
    await verifyAppleJwsSignature(body.signedPayload)
  } catch (err) {
    return json(401, {
      error: 'jws_invalid',
      detail: err instanceof Error ? err.message : 'verify_failed',
    })
  }

  const outer = decodeJwsPayloadUnsafe(body.signedPayload) as {
    notificationType?: string
    notificationUUID?: string
    data?: { environment?: string }
  }
  if (!outer.notificationUUID) return json(400, { error: 'missing_notification_uuid' })

  const environment = (outer.data?.environment ?? 'Production').toLowerCase()
  const result = await ctx.runMutation(internal.subscriptions.ingestAppleNotification, {
    environment,
    notificationUUID: outer.notificationUUID,
    notificationType: outer.notificationType ?? 'UNKNOWN',
    payloadHash: simpleHash(body.signedPayload),
  })

  return json(200, { ok: true, ...result })
}

/**
 * POST /iap/google/rtdn — Pub/Sub push.
 * JWT OIDC requis en prod quand GOOGLE_RTDN_* est configuré (JWKS complet = suite AB-e).
 */
export async function handleGoogleRtdn(
  ctx: GenericActionCtx<any>,
  request: Request,
): Promise<Response> {
  const audience = readSubscriptionEnv('GOOGLE_RTDN_AUDIENCE')
  const expectedEmail = readSubscriptionEnv('GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL')
  const auth = request.headers.get('Authorization') ?? ''
  if (audience && expectedEmail) {
    if (!auth.startsWith('Bearer ')) {
      return json(401, { error: 'missing_bearer' })
    }
    const token = auth.slice('Bearer '.length)
    if (!token || token.length < 20) return json(401, { error: 'invalid_bearer' })
  } else if ((readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production') === 'production') {
    return json(503, { error: 'google_rtdn_not_configured' })
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

  const result = await ctx.runMutation(internal.subscriptions.ingestGoogleRtdn, {
    environment: readSubscriptionEnv('SUBSCRIPTION_DEPLOY_ENV') ?? 'production',
    messageId,
    notificationType: body.message?.attributes?.type ?? 'RTDN',
    payloadHash: simpleHash(body.message?.data ?? messageId),
  })

  return json(200, { ok: true, ...result })
}
