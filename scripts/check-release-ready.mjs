#!/usr/bin/env node
/**
 * Check manuel avant mise en ligne — PAS exécuté par CI ni `npm run build`.
 * Usage : npm run check:release
 *
 * Lit SUPPORT_EMAIL dans src/config/contact.ts et applique la même règle
 * que checkSupportEmailReady (tests unitaires dans src/config/checkSupportEmail.test.ts).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const MISSING_FR =
  'Adresse de contact manquante : remplis SUPPORT_EMAIL avant la mise en ligne.'

function isValidSupportEmail(email) {
  const trimmed = String(email ?? '').trim()
  if (!trimmed) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

function readSupportEmailFromSource() {
  const source = readFileSync(join(ROOT, 'src/config/contact.ts'), 'utf8')
  const match = source.match(/export const SUPPORT_EMAIL\s*=\s*['"]([^'"]*)['"]/)
  return match ? match[1] : ''
}

const email = readSupportEmailFromSource()
if (!isValidSupportEmail(email)) {
  console.error(MISSING_FR)
  process.exit(1)
}
console.log('check:release OK — SUPPORT_EMAIL renseignée.')
