import { describe, expect, it } from 'vitest'
import { CSP_CONNECT_ALLOWLIST, CSP_FORBIDDEN_HOST_MARKERS, CSP_HEADER_VALUE } from './cspPolicy'

describe('CSP — téléphone ne contacte jamais Open Food Facts', () => {
  it('retire world.openfoodfacts.org de connect-src', () => {
    expect(CSP_HEADER_VALUE).not.toContain('openfoodfacts')
    expect(CSP_CONNECT_ALLOWLIST.join(' ')).not.toContain('openfoodfacts')
    expect(CSP_FORBIDDEN_HOST_MARKERS).toContain('openfoodfacts.org')
  })
})
