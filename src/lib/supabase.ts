import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { AUTH_STORAGE_KEY, getSecureAuthStorage } from '../services/secureAuthStorage'
import { safeError } from '../utils/safeLog'

const PLACEHOLDER_MARKERS = ['YOUR_PROJECT', 'YOUR_SUPABASE', 'example.supabase.co', 'undefined', 'null']

/** Nettoie les collages depuis le chat (Markdown, guillemets, caractères invisibles). */
function sanitizeEnvValue(raw: string | undefined): string {
  if (!raw) return ''
  let s = raw.trim()
  // Zero-width / format chars (ex. U+2060 collé depuis Cursor/Slack)
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
  // Lien Markdown [texte](https://…)
  const md = s.match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i)
  if (md) s = md[1]
  // URL entre parenthèses seules
  const wrapped = s.match(/^\((https?:\/\/[^)\s]+)\)$/i)
  if (wrapped) s = wrapped[1]
  return s.replace(/^["'`]+|["'`]+$/g, '').trim()
}

const url = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anonKey = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

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

/** True seulement si URL https valide + clé anon présente (injectées au build Vite). */
export function isSupabaseConfigured(): boolean {
  return (
    url.length > 8 &&
    anonKey.length > 20 &&
    isValidHttpUrl(url) &&
    !looksLikePlaceholder(url) &&
    !looksLikePlaceholder(anonKey)
  )
}

let client: SupabaseClient<Database> | null = null
let clientInitFailed = false

export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configuré. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY au build Cloudflare.',
    )
  }
  if (clientInitFailed) {
    throw new Error('Client Supabase invalide — vérifie VITE_SUPABASE_URL (https://…supabase.co).')
  }
  if (!client) {
    try {
      client = createClient<Database>(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: getSecureAuthStorage(),
          storageKey: AUTH_STORAGE_KEY,
        },
      })
    } catch (e) {
      clientInitFailed = true
      safeError('[supabase] createClient failed', e)
      throw new Error(
        'URL Supabase invalide. Format attendu : https://TON_REF.supabase.co',
      )
    }
  }
  return client
}

export function getSupabaseConfigError(): string | null {
  if (isSupabaseConfigured()) return null

  if (!url && !anonKey) {
    return 'Variables Supabase absentes au build. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Cloudflare (Production) puis redéploie.'
  }
  if (!isValidHttpUrl(url)) {
    const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
    const pastedMarkdown = raw.includes('](') || /[\u2060\u200B]/.test(raw)
    if (pastedMarkdown) {
      return 'VITE_SUPABASE_URL collée en Markdown (lien cliquable). Cloudflare → colle uniquement : https://jivqfrkwvnzzefnerpii.supabase.co puis redéploie.'
    }
    return `VITE_SUPABASE_URL invalide : « ${url || '(vide)'} ». Utilise https://jivqfrkwvnzzefnerpii.supabase.co`
  }
  if (!anonKey || anonKey.length < 20) {
    return 'VITE_SUPABASE_ANON_KEY manquante ou trop courte.'
  }
  return 'Configuration Supabase incomplète (voir docs/SUPABASE_SETUP.md).'
}

/** Valeurs exposées pour debug prod (sans secrets complets). */
export function getSupabaseConfigDebug(): { url: string; hasKey: boolean; configured: boolean } {
  return {
    url: url ? (isValidHttpUrl(url) ? url : '(URL invalide)') : '(vide)',
    hasKey: anonKey.length > 0,
    configured: isSupabaseConfigured(),
  }
}
