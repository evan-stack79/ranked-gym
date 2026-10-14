/**
 * B7 extra : la clé service-role Supabase reste serveur uniquement.
 * - jamais VITE_*
 * - jamais lue via import.meta.env dans le client
 * - jamais dans les messages d’erreur renvoyés au téléphone
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toClientSafePurgeError } from '../../convex/purgeSupabaseMeals'
import {
  ERASE_MEALS_CONNECT_MESSAGE,
  ERASE_MEALS_COUNT_UNKNOWN_MESSAGE,
  ERASE_MEALS_NONE_MESSAGE,
  ERASE_MEALS_PURGE_FAILED_MESSAGE,
  ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
} from '../services/eraseUserMeals'

const ROOT = join(import.meta.dirname, '../..')

const SERVICE_ROLE_ENV_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'MIGRATION_SUPABASE_SERVICE_ROLE_KEY',
] as const

const VITE_SERVICE_ROLE_RE = /VITE_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/g
const IMPORT_META_SERVICE_ROLE_RE =
  /import\.meta\.env\.[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/g

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walkFiles(full, out)
    else out.push(full)
  }
  return out
}

function isClientRuntimeSource(path: string): boolean {
  const rel = relative(ROOT, path).replace(/\\/g, '/')
  if (!rel.startsWith('src/')) return false
  if (rel.includes('.test.') || rel.includes('.spec.')) return false
  if (rel.startsWith('src/backend/') && rel.endsWith('.ts')) {
    // backend/*.ts are Vitest contracts / pure helpers, not shipped UI —
    // still forbid VITE_SERVICE_ROLE and import.meta.env service-role there.
  }
  return /\.(ts|tsx|js|jsx)$/.test(rel)
}

describe('Supabase service-role — server-only', () => {
  it('aucun VITE_*SERVICE_ROLE* dans vite-env, .env.example, ni sources client', () => {
    const viteEnv = readFileSync(join(ROOT, 'src/vite-env.d.ts'), 'utf8')
    expect(viteEnv).not.toMatch(VITE_SERVICE_ROLE_RE)
    for (const name of SERVICE_ROLE_ENV_NAMES) {
      expect(viteEnv).not.toContain(name)
    }

    const envExample = readFileSync(join(ROOT, '.env.example'), 'utf8')
    expect(envExample).not.toMatch(VITE_SERVICE_ROLE_RE)
    for (const line of envExample.split('\n')) {
      const trimmed = line.replace(/^\s*#\s*/, '').trim()
      if (!trimmed.includes('SERVICE_ROLE')) continue
      expect(trimmed.startsWith('VITE_')).toBe(false)
    }

    const offenders: string[] = []
    for (const file of walkFiles(join(ROOT, 'src'))) {
      if (!isClientRuntimeSource(file)) continue
      const text = readFileSync(file, 'utf8')
      if (VITE_SERVICE_ROLE_RE.test(text) || IMPORT_META_SERVICE_ROLE_RE.test(text)) {
        offenders.push(relative(ROOT, file))
      }
      // Reset lastIndex for global regexes
      VITE_SERVICE_ROLE_RE.lastIndex = 0
      IMPORT_META_SERVICE_ROLE_RE.lastIndex = 0
      for (const name of SERVICE_ROLE_ENV_NAMES) {
        if (text.includes(name)) offenders.push(`${relative(ROOT, file)}:${name}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('seuls les modules serveur Convex / scripts / edge lisent la service-role key', () => {
    const allowed = [
      'convex/purgeSupabaseMeals.ts',
      'convex/accountLinks.ts',
      'scripts/migrations/supabase/core.mjs',
      'scripts/migrations/supabase/export.mjs',
      'scripts/migrations/supabase/avatar-storage.mjs',
      'scripts/migrations/supabase/CODEX-RISK.ts',
      'supabase/functions/analyze-meal-photo/index.ts',
      '.env.example',
      'docs/CONVEX_SETUP.md',
      'docs/migrations/supabase-to-convex-plan.md',
      'docs/migrations/supabase-to-convex-inventory.md',
    ]
    const hits: string[] = []
    for (const file of walkFiles(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      if (
        rel.startsWith('node_modules/') ||
        rel.startsWith('dist/') ||
        rel.includes('.test.') ||
        rel.includes('.spec.')
      ) {
        continue
      }
      if (!/\.(ts|tsx|js|mjs|md|example)$/.test(rel) && !rel.endsWith('.env.example')) {
        continue
      }
      const text = readFileSync(file, 'utf8')
      const mentions = SERVICE_ROLE_ENV_NAMES.some((n) => text.includes(n))
      if (!mentions) continue
      if (!allowed.includes(rel)) hits.push(rel)
    }
    expect(hits).toEqual([])
  })

  it('messages d’erreur client ne contiennent ni nom ni valeur de clé service-role', () => {
    const fakeKey = 'super-secret-service-role-key-value-do-not-leak'
    const clientMessages = [
      ERASE_MEALS_CONNECT_MESSAGE,
      ERASE_MEALS_COUNT_UNKNOWN_MESSAGE,
      ERASE_MEALS_NONE_MESSAGE,
      ERASE_MEALS_PURGE_FAILED_MESSAGE,
      ERASE_MEALS_RECONNECT_LEGACY_MESSAGE,
    ]
    for (const msg of clientMessages) {
      expect(msg).not.toMatch(/SERVICE_ROLE/i)
      expect(msg).not.toContain(fakeKey)
      expect(msg.toLowerCase()).not.toContain('service role')
      expect(msg.toLowerCase()).not.toContain('service-role')
    }

    const leaked = toClientSafePurgeError(
      new Error(`fetch failed Authorization Bearer ${fakeKey}`),
      [fakeKey],
    )
    expect(leaked.message).toBe('ERASE_MEALS_PURGE_FAILED')
    expect(leaked.message).not.toContain(fakeKey)

    expect(toClientSafePurgeError(new Error('ACCOUNT_LINK_MISSING')).message).toBe(
      'ACCOUNT_LINK_MISSING',
    )
  })

  it('bundle client (dist) sans SERVICE_ROLE_KEY si un build est présent', () => {
    const distDir = join(ROOT, 'dist')
    if (!existsSync(distDir)) return
    const offenders: string[] = []
    for (const file of walkFiles(distDir)) {
      if (!/\.(js|mjs|css|html|map)$/.test(file)) continue
      const text = readFileSync(file, 'utf8')
      if (
        text.includes('SUPABASE_SERVICE_ROLE_KEY') ||
        text.includes('MIGRATION_SUPABASE_SERVICE_ROLE_KEY') ||
        /VITE_[A-Z0-9_]*SERVICE_ROLE/.test(text)
      ) {
        offenders.push(relative(ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })
})
