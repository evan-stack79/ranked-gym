import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function sectionFor(headersFile: string, pathPattern: string): string {
  const lines = headersFile.split('\n')
  const start = lines.findIndex((line) => line.trim() === pathPattern)
  expect(start, `missing section ${pathPattern}`).toBeGreaterThanOrEqual(0)
  const chunk: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() === '') break
    if (!line.startsWith(' ') && !line.startsWith('\t') && line.trim().startsWith('/')) break
    chunk.push(line)
  }
  return chunk.join('\n')
}

describe('PWA cache headers (Cloudflare Pages)', () => {
  const headersFile = readFileSync(join(root, 'public/_headers'), 'utf8')
  const middleware = readFileSync(join(root, 'functions/_middleware.ts'), 'utf8')

  it('sert sw.js et registerSW.js sans cache HTTP', () => {
    expect(sectionFor(headersFile, '/sw.js')).toContain('Cache-Control: no-cache')
    expect(sectionFor(headersFile, '/registerSW.js')).toContain('Cache-Control: no-cache')
  })

  it('sert index.html et / sans cache HTTP', () => {
    expect(sectionFor(headersFile, '/index.html')).toContain('Cache-Control: no-cache')
    expect(sectionFor(headersFile, '/')).toContain('Cache-Control: no-cache')
  })

  it('garde un cache long sur les assets hashés', () => {
    expect(sectionFor(headersFile, '/assets/*')).toContain(
      'Cache-Control: public, max-age=31536000, immutable',
    )
    expect(sectionFor(headersFile, '/assets/*.js')).toContain(
      'Cache-Control: public, max-age=31536000, immutable',
    )
  })

  it('middleware aligne no-cache SW/HTML et cache long assets', () => {
    expect(middleware).toContain("path === '/sw.js'")
    expect(middleware).toContain("path === '/registerSW.js'")
    expect(middleware).toContain("path === '/index.html'")
    expect(middleware).toContain("headers.set('Cache-Control', 'no-cache')")
    expect(middleware).toContain(
      "headers.set('Cache-Control', 'public, max-age=31536000, immutable')",
    )
  })
})
