import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

const PLACEHOLDER_MARKERS = ['YOUR_PROJECT', 'YOUR_SUPABASE', 'example.supabase.co', 'undefined', 'null']

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
        },
      })
    } catch (e) {
      clientInitFailed = true
      console.error('[supabase] createClient failed:', e)
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
