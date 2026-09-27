import { describe, expect, it } from 'vitest'
import { friendlyAuthError, isAccountEnumerationError } from './authErrors'

describe('authErrors helpers', () => {
  it('maps AUTH_SIGNUP_DISABLED to a clear french message', () => {
    const message = friendlyAuthError(new Error('AUTH_SIGNUP_DISABLED'), 'Inscription impossible.')
    expect(message).toBe('Les inscriptions sont fermées pour le moment. Contacte le support Ranked Gym.')
  })

  it('keeps AUTH_SESSION_MISSING user-facing in french', () => {
    const message = friendlyAuthError(new Error('AUTH_SESSION_MISSING'), 'Erreur.')
    expect(message).toBe('Session expirée. Reconnecte-toi.')
  })

  it('does not classify signup disabled as account-enumeration signal', () => {
    expect(isAccountEnumerationError(new Error('signup is disabled'))).toBe(false)
  })
})
