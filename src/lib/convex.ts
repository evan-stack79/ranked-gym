import { ConvexReactClient } from 'convex/react'
import { safeError } from '../utils/safeLog'

const PLACEHOLDER_MARKERS = ['YOUR_DEPLOYMENT', 'YOUR_CONVEX', 'example.convex', 'undefined', 'null']

function sanitizeEnvValue(raw: string | undefined): string {
  if (!raw) return ''
  let s = raw.trim()
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
  const md = s.match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i)
  if (md) s = md[1]
  const wrapped = s.match(/^\((https?:\/\/[^)\s]+)\)$/i)
  if (wrapped) s = wrapped[1]
  return s.replace(/^["'`]+|["'`]+$/g, '').trim()
}

const url = sanitizeEnvValue(import.meta.env.VITE_CONVEX_URL as string | undefined)

function isValidHttpUrl(raw: string): boolean {
  if (!raw) return false
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase()
  return PLACEHOLDER_MARKERS.some((m) => lower.includes(m.toLowerCase()))
}

/** True only when a real Convex deployment URL is injected at Vite build time. */
export function isConvexConfigured(): boolean {
  return url.length > 8 && isValidHttpUrl(url) && !looksLikePlaceholder(url)
}

let client: ConvexReactClient | null = null
let clientInitFailed = false

export function getConvex(): ConvexReactClient {
  if (!isConvexConfigured()) {
    throw new Error(
      'Convex non configuré. Ajoute VITE_CONVEX_URL au build (voir docs/CONVEX_SETUP.md).',
    )
  }
  if (clientInitFailed) {
    throw new Error('Client Convex invalide — vérifie VITE_CONVEX_URL (https://….convex.cloud).')
  }
  if (!client) {
    try {
      client = new ConvexReactClient(url)
    } catch (e) {
      clientInitFailed = true
      safeError('[convex] createClient failed', e)
      throw new Error('URL Convex invalide. Format attendu : https://TON_DEPLOYMENT.convex.cloud')
    }
  }
  return client
}

export function getConvexConfigError(): string | null {
  if (isConvexConfigured()) return null
  if (!url) {
    return 'Variable Convex absente au build. Ajoute VITE_CONVEX_URL (docs/CONVEX_SETUP.md).'
  }
  if (!isValidHttpUrl(url)) {
    return `VITE_CONVEX_URL invalide : « ${url} ». Utilise https://TON_DEPLOYMENT.convex.cloud`
  }
  return 'Configuration Convex incomplète (voir docs/CONVEX_SETUP.md).'
}

export function getConvexConfigDebug(): { url: string; configured: boolean } {
  return {
    url: url ? (isValidHttpUrl(url) ? url : '(URL invalide)') : '(vide)',
    configured: isConvexConfigured(),
  }
}
