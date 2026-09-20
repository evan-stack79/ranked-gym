import { describe, expect, it } from 'vitest'
import { decideAuthRestore } from './sessionRestore'
import type { AuthUser } from '../services/authService'

const user: AuthUser = {
  id: 'u1',
  email: 'a@b.c',
  displayName: 'A',
  provider: 'email',
}

describe('decideAuthRestore', () => {
  it('sans token → écran d’accueil (déconnecté)', () => {
    expect(
      decideAuthRestore({
        token: null,
        remoteUser: null,
        remoteError: null,
        cachedUser: null,
      }),
    ).toEqual({ kind: 'disconnected' })
  })

  it('session réseau valide → connecté, jamais welcome', () => {
    expect(
      decideAuthRestore({
        token: 'tok',
        remoteUser: user,
        remoteError: null,
        cachedUser: null,
      }),
    ).toEqual({ kind: 'authenticated', user, source: 'network' })
  })

  it('session expirée (token local, remote null) → déconnecté', () => {
    expect(
      decideAuthRestore({
        token: 'tok',
        remoteUser: null,
        remoteError: null,
        cachedUser: user,
      }),
    ).toEqual({ kind: 'disconnected' })
  })

  it('hors-ligne avec session locale → reste connecté', () => {
    expect(
      decideAuthRestore({
        token: 'tok',
        remoteUser: null,
        remoteError: new Error('Failed to fetch'),
        cachedUser: user,
      }),
    ).toEqual({ kind: 'authenticated', user, source: 'local-cache' })
  })

  it('hors-ligne avec token sans cache → skip welcome (session locale)', () => {
    const decision = decideAuthRestore({
      token: 'tok',
      remoteUser: null,
      remoteError: new Error('network error'),
      cachedUser: null,
    })
    expect(decision.kind).toBe('authenticated')
    if (decision.kind === 'authenticated') {
      expect(decision.source).toBe('local-token')
    }
  })
})
