/**
 * Abstract transactional email sender.
 * Provider + credentials come from server env only — never hardcoded, never VITE_*.
 *
 * Required env (Convex dashboard / scripts):
 * - EMAIL_PROVIDER   (opaque name Evan chooses)
 * - EMAIL_API_KEY
 * - EMAIL_API_URL    (HTTPS endpoint that accepts the JSON payload below)
 * - AUTH_EMAIL_FROM
 *
 * Payload POSTed to EMAIL_API_URL:
 * { provider, from, to, subject, text, html }
 * Authorization: Bearer EMAIL_API_KEY
 */

export type TransactionalEmailInput = {
  toEmail: string
  subject: string
  text: string
  html: string
}

export type TransactionalEmailResult =
  | { ok: true; provider: string; messageId?: string }
  | {
      ok: false
      code:
        | 'EMAIL_PROVIDER_NOT_CONFIGURED'
        | 'EMAIL_PROVIDER_REJECTED'
        | 'EMAIL_PROVIDER_NETWORK'
        | 'EMAIL_PROVIDER_UNKNOWN'
    }

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

export function isTransactionalEmailConfigured(): boolean {
  const provider = readEnv('EMAIL_PROVIDER')?.trim()
  const apiKey = readEnv('EMAIL_API_KEY')?.trim()
  const apiUrl = readEnv('EMAIL_API_URL')?.trim()
  const from = readEnv('AUTH_EMAIL_FROM')?.trim()
  return Boolean(provider && apiKey && apiUrl && from)
}

function classifyEmailError(error: unknown): TransactionalEmailResult {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection')
  ) {
    return { ok: false, code: 'EMAIL_PROVIDER_NETWORK' }
  }
  return { ok: false, code: 'EMAIL_PROVIDER_UNKNOWN' }
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<TransactionalEmailResult> {
  const provider = readEnv('EMAIL_PROVIDER')?.trim()
  const apiKey = readEnv('EMAIL_API_KEY')?.trim()
  const apiUrl = readEnv('EMAIL_API_URL')?.trim()
  const from = readEnv('AUTH_EMAIL_FROM')?.trim()
  if (!provider || !apiKey || !apiUrl || !from) {
    return { ok: false, code: 'EMAIL_PROVIDER_NOT_CONFIGURED' }
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        provider,
        from,
        to: input.toEmail,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    })
    if (!response.ok) {
      return { ok: false, code: 'EMAIL_PROVIDER_REJECTED' }
    }
    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null
    return {
      ok: true,
      provider,
      messageId: typeof payload?.id === 'string' ? payload.id : undefined,
    }
  } catch (error) {
    return classifyEmailError(error)
  }
}
