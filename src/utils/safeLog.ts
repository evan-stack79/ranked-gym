const SENSITIVE_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'password',
  'session',
  'authorization',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'coords',
  'coord',
  'email',
  'phone',
  'gym_payload',
  'origin_lat',
  'origin_lng',
])

function redactValue(key: string, value: unknown): unknown {
  const lower = key.toLowerCase()
  if (SENSITIVE_KEYS.has(lower) || lower.includes('token') || lower.includes('secret')) {
    return '[redacted]'
  }
  if (typeof value === 'string' && value.length > 120) {
    return `${value.slice(0, 40)}…[truncated]`
  }
  return value
}

function redactUnknown(input: unknown): unknown {
  if (input instanceof Error) {
    return { name: input.name, message: input.message }
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactUnknown(item))
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = typeof value === 'object' && value !== null ? redactUnknown(value) : redactValue(key, value)
    }
    return out
  }
  return input
}

function emit(scope: string, level: 'error' | 'warn', payload: unknown): void {
  const safe = redactUnknown(payload)
  if (import.meta.env.DEV) {
    console[level](scope, safe)
    return
  }
  console[level](scope, typeof safe === 'string' ? safe : JSON.stringify(safe))
}

export function safeError(scope: string, error: unknown): void {
  emit(scope, 'error', error)
}

export function safeWarn(scope: string, message?: unknown): void {
  emit(scope, 'warn', message ?? scope)
}
