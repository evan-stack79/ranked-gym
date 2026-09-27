import { describe, expect, it } from 'vitest'
import { toUserFacingError } from './userFacingError'

describe('toUserFacingError', () => {
  it('maps avatar upload codes to french copy', () => {
    expect(toUserFacingError(new Error('CONVEX_AVATAR_UPLOAD_FAILED'), 'Upload impossible.')).toBe(
      'Upload de la photo impossible pour le moment. Réessaie.',
    )
    expect(toUserFacingError(new Error('CONVEX_AVATAR_STORAGE_ID_MISSING'), 'Upload impossible.')).toBe(
      'Upload de la photo impossible pour le moment. Réessaie.',
    )
  })

  it('maps session/auth raw codes to french copy', () => {
    expect(toUserFacingError(new Error('AUTH_SESSION_MISSING'), 'Erreur.')).toBe(
      'Session expirée. Reconnecte-toi.',
    )
  })
})
