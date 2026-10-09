import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Architect rule: animation assets are bundled offline-only.
 * No CDN / remote loading. Licenses live in public/animations/LICENSES.md.
 */

const root = process.cwd()

const EXTERNAL_URL_RE =
  /(?:https?:)?\/\/(?!(?:localhost|127\.0\.0\.1)(?::\d+)?\/)[^\s"'`)]+/gi

const ANIM_FILE_GLOBS = [
  'src/components/motion',
  'src/components/streak',
  'src/fixtures',
  'public/animations',
]

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      walkFiles(full, out)
    } else if (/\.(tsx?|jsx?|css|md|json|html|svg)$/i.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function isAnimationAssetUrl(url: string): boolean {
  const lower = url.toLowerCase()
  // Remote scripts / CDNs that could host motion assets
  if (/unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com|lottiefiles\.com|cdn\.|raw\.githubusercontent\.com/i.test(lower)) {
    return true
  }
  // Explicit animation media extensions on remote hosts
  if (/\.(json|lottie|mp4|webm|gif|svg|mov)(?:\?|#|$)/i.test(lower) && /^https?:\/\//i.test(url)) {
    return true
  }
  return false
}

describe('animation assets — offline / bundled only', () => {
  it('public/animations/LICENSES.md documents licenses (or none)', () => {
    const licensePath = join(root, 'public/animations/LICENSES.md')
    expect(existsSync(licensePath)).toBe(true)
    const body = readFileSync(licensePath, 'utf8')
    expect(body).toMatch(/license/i)
    expect(body).toMatch(/No CDN|bundled|offline/i)
  })

  it('no external animation asset URLs in motion-related sources', () => {
    const files = ANIM_FILE_GLOBS.flatMap((rel) => walkFiles(join(root, rel)))
    // Also scan CSS entry that imports team animations
    files.push(join(root, 'src/main.tsx'))
    files.push(join(root, 'src/index.css'))

    const offenders: string[] = []
    for (const file of files) {
      if (!existsSync(file)) continue
      const src = readFileSync(file, 'utf8')
      const urls = src.match(EXTERNAL_URL_RE) ?? []
      for (const raw of urls) {
        // Allow markdown/doc links to license sources inside LICENSES.md only
        if (file.endsWith('LICENSES.md')) continue
        if (isAnimationAssetUrl(raw)) {
          offenders.push(`${file}: ${raw}`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('team animations do not import remote fetch/CDN helpers for assets', () => {
    const motionDir = join(root, 'src/components/motion')
    const files = walkFiles(motionDir).filter(
      (f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f) && !/\.contract\.test\./.test(f),
    )
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      expect(src.includes('lottie-web')).toBe(false)
      expect(src.includes('@lottie')).toBe(false)
      expect(src.includes('dotlottie')).toBe(false)
      expect(src).not.toMatch(/from\s+['"]https?:\/\//i)
      expect(src).not.toMatch(/\.src\s*=\s*['"]https?:\/\//i)
    }
  })
})
