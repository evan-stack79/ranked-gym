import { describe, expect, it } from 'vitest'
import {
  friendlyAuthError,
  isAccountEnumerationError,
  isNetworkAuthError,
  validateNewPassword,
} from './authErrors'
import {
  getPasswordRecoveryRedirectTo,
  PASSWORD_RESET_SENT_MESSAGE,
} from './authRedirect'

describe('validateNewPassword', () => {
  it('rejette un mot de passe trop court', () => {
    expect(validateNewPassword('12345', '12345')).toMatch(/au moins 6/)
  })

  it('rejette des mots de passe différents', () => {
    expect(validateNewPassword('abcdef', 'abcdeg')).toMatch(/ne correspondent pas/)
  })

  it('accepte un couple valide', () => {
    expect(validateNewPassword('abcdef', 'abcdef')).toBeNull()
  })
})

describe('friendlyAuthError', () => {
  it('traduit une erreur réseau', () => {
    expect(friendlyAuthError(new Error('Failed to fetch'), 'fallback')).toMatch(/réseau/i)
  })

  it('détecte failed to fetch comme réseau', () => {
    expect(isNetworkAuthError(new Error('Failed to fetch'))).toBe(true)
  })

  it('détecte les erreurs d’énumération de compte', () => {
    expect(isAccountEnumerationError(new Error('User not found'))).toBe(true)
  })
})

describe('authRedirect', () => {
  it('expose un message neutre (pas d’existence de compte)', () => {
    expect(PASSWORD_RESET_SENT_MESSAGE.toLowerCase()).toMatch(/si un compte existe/)
    expect(PASSWORD_RESET_SENT_MESSAGE.toLowerCase()).not.toContain('introuvable')
  })

  it('préfère VITE_PUBLIC_APP_URL https', () => {
    expect(getPasswordRecoveryRedirectTo('https://app.example.com')).toBe(
      'https://app.example.com/',
    )
  })

  it('ignore une URL publique non-https', () => {
    expect(getPasswordRecoveryRedirectTo('http://insecure.example.com')).toBeUndefined()
    expect(getPasswordRecoveryRedirectTo('capacitor://localhost')).toBeUndefined()
  })
})
