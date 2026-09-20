/**
 * Copie byte-à-byte du hero welcome fourni par Evan.
 * Ne génère rien, ne redessine pas la panthère.
 *
 * Usage : node scripts/generate-auth-welcome-assets.mjs
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const PUBLIC_DIR = path.join(root, 'public')

const SRC_PNG_CANDIDATES = [
  '/home/ubuntu/.cursor/projects/workspace/uploads/auth-welcome-hero-source_ab97.png',
  '/workspace/welcome-bg-v2/auth-welcome-hero-source.png',
]
const SRC_WEBP_CANDIDATES = [
  '/home/ubuntu/.cursor/projects/workspace/uploads/auth-welcome-hero_fc2c.webp',
]
const DEST_PNG = path.join(PUBLIC_DIR, 'auth-welcome-hero.png')
const DEST_WEBP = path.join(PUBLIC_DIR, 'auth-welcome-hero.webp')

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function firstExisting(candidates) {
  return candidates.find((filePath) => existsSync(filePath))
}

function copyExact(src, dest) {
  if (!src) {
    if (!existsSync(dest)) {
      throw new Error(`Hero source absente et dest absente (${dest})`)
    }
    console.log(`  keep ${path.relative(root, dest)} (source upload indisponible)`)
    return
  }
  copyFileSync(src, dest)
  const a = sha256(src)
  const b = sha256(dest)
  if (a !== b) throw new Error(`Copie non identique : ${dest}`)
  console.log(`  copied ${path.relative(root, dest)} sha256=${a.slice(0, 12)}`)
}

copyExact(firstExisting(SRC_PNG_CANDIDATES), DEST_PNG)
copyExact(firstExisting(SRC_WEBP_CANDIDATES), DEST_WEBP)
console.log('Done — exact hero bytes, no generation.')
