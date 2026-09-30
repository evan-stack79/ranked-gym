type PasswordResetEmailInput = {
  toEmail: string
  resetLink: string
}

export type PasswordResetEmailResult =
  | {
      ok: true
      provider: 'resend'
      messageId?: string
    }
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

export function isPasswordResetEmailConfigured(): boolean {
  const apiKey = readEnv('RESEND_API_KEY')?.trim()
  const from = readEnv('AUTH_EMAIL_FROM')?.trim()
  return Boolean(apiKey && from)
}

function classifyEmailError(error: unknown): PasswordResetEmailResult {
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

function renderResetEmailHtml(resetLink: string): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#070708;color:#f5f5f7;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#111113;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px">
    <p style="margin:0 0 12px;font-size:14px;color:#aeaeb2;">Ranked Gym</p>
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.2;color:#ffffff;">Réinitialise ton mot de passe</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#f2f2f7;">
      Tu as demandé un nouveau mot de passe. Clique sur le bouton ci-dessous pour continuer.
    </p>
    <p style="margin:0 0 22px;">
      <a href="${resetLink}" style="display:inline-block;background:#e22400;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 16px;border-radius:10px;">
        Définir un nouveau mot de passe
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#aeaeb2;">
      Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :
    </p>
    <p style="margin:0 0 14px;font-size:12px;line-height:1.5;word-break:break-all;color:#c7c7cc;">
      ${resetLink}
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#8e8e93;">
      Si tu n’es pas à l’origine de cette demande, tu peux ignorer cet email.
    </p>
  </div>
</div>`
}

function renderResetEmailText(resetLink: string): string {
  return [
    'Ranked Gym — Réinitialisation du mot de passe',
    '',
    'Tu as demandé un nouveau mot de passe.',
    `Ouvre ce lien : ${resetLink}`,
    '',
    'Si tu n’es pas à l’origine de cette demande, ignore cet email.',
  ].join('\n')
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<PasswordResetEmailResult> {
  const apiKey = readEnv('RESEND_API_KEY')?.trim()
  const from = readEnv('AUTH_EMAIL_FROM')?.trim()
  if (!apiKey || !from) {
    return { ok: false, code: 'EMAIL_PROVIDER_NOT_CONFIGURED' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.toEmail],
        subject: 'Ranked Gym — Réinitialisation du mot de passe',
        html: renderResetEmailHtml(input.resetLink),
        text: renderResetEmailText(input.resetLink),
      }),
    })

    if (!response.ok) {
      return { ok: false, code: 'EMAIL_PROVIDER_REJECTED' }
    }

    const payload = (await response.json().catch(() => null)) as { id?: unknown } | null
    return {
      ok: true,
      provider: 'resend',
      messageId: typeof payload?.id === 'string' ? payload.id : undefined,
    }
  } catch (error) {
    return classifyEmailError(error)
  }
}
