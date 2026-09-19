import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CSP_CONNECT_ALLOWLIST,
  CSP_FORBIDDEN_HOST_MARKERS,
  CSP_HEADER_VALUE,
  CSP_META_VALUE,
  CSP_SCRIPT_SRC_FORBIDDEN,
  SECURITY_HEADERS,
} from './cspPolicy'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function extractDirective(csp: string, name: string): string {
  const parts = csp.split(';').map((p) => p.trim())
  const found = parts.find((p) => p.startsWith(`${name} `) || p === name)
  expect(found, `missing directive ${name}`).toBeTruthy()
  return found!
}

describe('cspPolicy canonical value', () => {
  it('includes required connect-src allowlist hosts', () => {
    const connect = extractDirective(CSP_HEADER_VALUE, 'connect-src')
    for (const host of CSP_CONNECT_ALLOWLIST) {
      expect(connect).toContain(host)
    }
  })

  it('blocks framing and locks base/form targets', () => {
    expect(CSP_HEADER_VALUE).toContain("frame-ancestors 'none'")
    expect(CSP_HEADER_VALUE).toContain("base-uri 'self'")
    expect(CSP_HEADER_VALUE).toContain("form-action 'self'")
    expect(CSP_HEADER_VALUE).toContain("object-src 'none'")
    expect(CSP_HEADER_VALUE).toContain("frame-src 'none'")
  })

  it('keeps script-src strict (no unsafe-inline / unsafe-eval)', () => {
    const scriptSrc = extractDirective(CSP_HEADER_VALUE, 'script-src')
    for (const marker of CSP_SCRIPT_SRC_FORBIDDEN) {
      expect(scriptSrc).not.toContain(marker)
    }
    expect(scriptSrc).toContain("'self'")
    expect(scriptSrc).toContain('https://maps.googleapis.com')
  })

  it('does not allowlist known unauthorized third-party hosts', () => {
    for (const marker of CSP_FORBIDDEN_HOST_MARKERS) {
      expect(CSP_HEADER_VALUE).not.toContain(marker)
    }
  })

  it('meta CSP omits frame-ancestors (header-only)', () => {
    expect(CSP_META_VALUE).not.toContain('frame-ancestors')
    expect(CSP_HEADER_VALUE).toContain("frame-ancestors 'none'")
  })
})

describe('deployed CSP surfaces stay in sync', () => {
  it('public/_headers ships the canonical CSP + companion headers', () => {
    const headersFile = readFileSync(join(root, 'public/_headers'), 'utf8')
    expect(headersFile).toContain(`Content-Security-Policy: ${CSP_HEADER_VALUE}`)
    expect(headersFile).toContain(`Referrer-Policy: ${SECURITY_HEADERS['Referrer-Policy']}`)
    expect(headersFile).toContain(`X-Frame-Options: ${SECURITY_HEADERS['X-Frame-Options']}`)
    expect(headersFile).toContain(
      `Strict-Transport-Security: ${SECURITY_HEADERS['Strict-Transport-Security']}`,
    )
    expect(headersFile).toContain(
      `Permissions-Policy: ${SECURITY_HEADERS['Permissions-Policy']}`,
    )
  })

  it('index.html meta CSP matches CSP_META_VALUE and loads external boot script', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain(`content="${CSP_META_VALUE}"`)
    expect(html).toContain('src="/boot-t0.js"')
    expect(html).not.toMatch(/<script>\s*window\.__RG_BOOT_T0__/)
    expect(html).toContain(
      `content="${SECURITY_HEADERS['Permissions-Policy']}"`,
    )
  })

  it('Pages middleware embeds the canonical CSP header value', () => {
    const middleware = readFileSync(join(root, 'functions/_middleware.ts'), 'utf8')
    expect(middleware).toContain(CSP_HEADER_VALUE)
    expect(middleware).toContain(SECURITY_HEADERS['Referrer-Policy'])
    expect(middleware).toContain(SECURITY_HEADERS['Strict-Transport-Security'])
  })

  it('boot-t0.js exists as a self-hosted script (CSP script-src self)', () => {
    const boot = readFileSync(join(root, 'public/boot-t0.js'), 'utf8')
    expect(boot).toContain('__RG_BOOT_T0__')
    expect(boot).not.toMatch(/https?:\/\//)
  })
})
