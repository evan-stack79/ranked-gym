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

  it('traduit un throttle serveur sans détails internes', () => {
    expect(friendlyAuthError(new Error('RATE_LIMITED'), 'fallback')).toBe(
      'Trop de tentatives. Réessaie dans quelques minutes.',
    )
    expect(friendlyAuthError(new Error('Uncaught Error: RATE_LIMITED'), 'fallback')).toMatch(
      /trop de tentatives/i,
    )
  })

  it('distingue credentials, session, service et ne mappe pas tout vers service indisponible', () => {
    expect(friendlyAuthError(new Error('Invalid login credentials'), 'fallback')).toBe(
      'Email ou mot de passe incorrect.',
    )
    expect(friendlyAuthError(new Error('AUTH_INVALID_CREDENTIALS'), 'fallback')).toBe(
      'Email ou mot de passe incorrect.',
    )
    expect(friendlyAuthError(new Error('jwt expired'), 'fallback')).toBe(
      'Session expirée. Reconnecte-toi.',
    )
    expect(friendlyAuthError(new Error('AUTH_SERVICE_UNAVAILABLE'), 'fallback')).toBe(
      'Service indisponible. Réessaie plus tard.',
    )
    expect(friendlyAuthError(new Error('503'), 'fallback')).toBe(
      'Service indisponible. Réessaie plus tard.',
    )
    expect(friendlyAuthError(new Error('Quelque chose d’imprévu'), 'Connexion impossible.')).toBe(
      'Connexion impossible.',
    )
    expect(friendlyAuthError(new Error('Quelque chose d’imprévu'), 'Connexion impossible.')).not.toMatch(
      /indisponible/i,
    )
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
    expect(getPasswordRecoveryRedirectTo('javascript:alert(1)')).toBeUndefined()
    expect(getPasswordRecoveryRedirectTo('data:text/html,x')).toBeUndefined()
  })
})
