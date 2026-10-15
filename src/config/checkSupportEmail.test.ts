import { describe, expect, it } from 'vitest'
import { checkSupportEmailReady, SUPPORT_EMAIL_MISSING_FR } from './checkSupportEmail'

describe('checkSupportEmailReady — logique check:release', () => {
  it('vide → refuse', () => {
    const r = checkSupportEmailReady('')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe(SUPPORT_EMAIL_MISSING_FR)
  })

  it('invalide → refuse', () => {
    expect(checkSupportEmailReady('pas-un-email').ok).toBe(false)
    expect(checkSupportEmailReady('a@b').ok).toBe(false)
    expect(checkSupportEmailReady('  ').ok).toBe(false)
  })

  it('valide → passe', () => {
    expect(checkSupportEmailReady('support@rankedgym.app').ok).toBe(true)
  })
})
