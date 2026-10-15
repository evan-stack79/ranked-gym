/**
 * Client : confirmation e-mail Convex par code 6 chiffres (B9-01).
 * Envoi via mailer abstrait serveur — jamais de provider hardcodé côté app.
 */
import { api } from '../../convex/_generated/api'
import { isConvexConfigured, getConvex } from '../lib/convex'
import { getConvexSessionToken } from './convexAuthService'
import { safeWarn } from '../utils/safeLog'

export const EMAIL_PROVIDER_NOT_CONFIGURED_MESSAGE =
  'Confirmation e-mail indisponible. Contacte-nous.'

export const EMAIL_CODE_BLOCKED_MESSAGE = 'Trop d’essais, réessaie dans 1 h'

export const EMAIL_CODE_INVALID_MESSAGE = 'Code incorrect. Réessaie.'

export const EMAIL_CODE_EXPIRED_MESSAGE = 'Code expiré. Demande un nouveau code.'

export class EmailProviderNotConfiguredError extends Error {
  constructor() {
    super(EMAIL_PROVIDER_NOT_CONFIGURED_MESSAGE)
    this.name = 'EmailProviderNotConfiguredError'
  }
}

export class EmailCodeBlockedError extends Error {
  constructor(message = EMAIL_CODE_BLOCKED_MESSAGE) {
    super(message)
    this.name = 'EmailCodeBlockedError'
  }
}

export class EmailCodeInvalidError extends Error {
  constructor(message = EMAIL_CODE_INVALID_MESSAGE) {
    super(message)
    this.name = 'EmailCodeInvalidError'
  }
}

export type EmailConfirmationState = {
  email: string
  emailConfirmed: boolean
  mailerConfigured: boolean
}

async function requireSessionToken(): Promise<string> {
  const token = await getConvexSessionToken()
  if (!token) throw new EmailCodeInvalidError('Session requise')
  return token
}

export async function fetchEmailConfirmationState(): Promise<EmailConfirmationState | null> {
  if (!isConvexConfigured()) return null
  try {
    const sessionToken = await getConvexSessionToken()
    if (!sessionToken) return null
    return (await getConvex().query(api.emailVerification.getEmailConfirmationState, {
      sessionToken,
    })) as EmailConfirmationState
  } catch (error) {
    safeWarn('[email-verify] getEmailConfirmationState failed', error)
    return null
  }
}

export async function requestEmailVerificationCode(): Promise<{ expiresAt: number }> {
  if (!isConvexConfigured()) throw new EmailProviderNotConfiguredError()
  const sessionToken = await requireSessionToken()
  try {
    const result = (await getConvex().action(
      api.emailVerification.requestEmailVerificationCode,
      { sessionToken },
    )) as { ok: true; expiresAt: number }
    return { expiresAt: result.expiresAt }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('EMAIL_PROVIDER_NOT_CONFIGURED')) {
      throw new EmailProviderNotConfiguredError()
    }
    if (
      message.includes('EMAIL_CODE_HOUR_BLOCKED') ||
      message.includes('EMAIL_CODE_BLOCKED')
    ) {
      throw new EmailCodeBlockedError()
    }
    safeWarn('[email-verify] request code failed', error)
    throw new EmailCodeInvalidError('Envoi du code impossible. Réessaie.')
  }
}

export async function verifyEmailVerificationCode(code: string): Promise<void> {
  if (!isConvexConfigured()) throw new EmailProviderNotConfiguredError()
  const sessionToken = await requireSessionToken()
  const trimmed = code.trim()
  if (!/^\d{6}$/.test(trimmed)) {
    throw new EmailCodeInvalidError()
  }
  try {
    await getConvex().action(api.emailVerification.verifyEmailVerificationCode, {
      sessionToken,
      code: trimmed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (
      message.includes('EMAIL_CODE_HOUR_BLOCKED') ||
      message.includes('EMAIL_CODE_BLOCKED')
    ) {
      throw new EmailCodeBlockedError()
    }
    if (message.includes('EMAIL_CODE_EXPIRED')) {
      throw new EmailCodeInvalidError(EMAIL_CODE_EXPIRED_MESSAGE)
    }
    if (message.includes('EMAIL_CODE_INVALID')) throw new EmailCodeInvalidError()
    safeWarn('[email-verify] verify failed', error)
    throw new EmailCodeInvalidError()
  }
}
