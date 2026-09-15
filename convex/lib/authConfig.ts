const DEFAULT_RESET_TOKEN_TTL_MINUTES = 30
const DEFAULT_SESSION_TTL_HOURS = 24 * 30

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function getResetTokenTtlMinutes(): number {
  return parsePositiveInt(readEnv('CONVEX_AUTH_RESET_TOKEN_TTL_MIN')) ?? DEFAULT_RESET_TOKEN_TTL_MINUTES
}

export function getSessionTtlMs(): number {
  const hours = parsePositiveInt(readEnv('CONVEX_AUTH_SESSION_TTL_HOURS')) ?? DEFAULT_SESSION_TTL_HOURS
  return hours * 60 * 60 * 1000
}

export function getResetRedirectBaseUrl(): string {
  return readEnv('CONVEX_AUTH_RESET_REDIRECT_URL')?.trim() || ''
}

export function isPublicSignupAllowed(): boolean {
  return parseBooleanFlag(readEnv('CONVEX_ALLOW_PUBLIC_SIGNUP'))
}
