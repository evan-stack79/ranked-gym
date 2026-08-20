import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

export function isSupabaseConfigured(): boolean {
  return url.length > 0 && anonKey.length > 0 && !url.includes('YOUR_PROJECT')
}

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configuré. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env',
    )
  }
  if (!client) {
    client = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export function getSupabaseConfigError(): string | null {
  if (isSupabaseConfigured()) return null
  return 'Configure VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir docs/SUPABASE_SETUP.md).'
}
