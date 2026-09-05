import { beforeEach, describe, expect, it, vi } from 'vitest'

const resetPasswordForEmail = vi.fn()
const updateUser = vi.fn()

vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      resetPasswordForEmail,
      updateUser,
    },
  }),
  isSupabaseConfigured: () => true,
}))

describe('authService — récupération mot de passe', () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset()
    updateUser.mockReset()
    vi.resetModules()
  })

  it('envoie le lien via resetPasswordForEmail (avec redirectTo)', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    const { requestPasswordReset } = await import('./authService')
    await requestPasswordReset('User@Email.COM', 'https://app.example.com/')
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@email.com', {
      redirectTo: 'https://app.example.com/',
    })
  })

  it('envoie le lien sans options si pas de redirectTo', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    const { requestPasswordReset } = await import('./authService')
    await requestPasswordReset('a@b.co')
    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', undefined)
  })

  it('propage une erreur réseau à l’appelant', async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new Error('Failed to fetch'),
    })
    const { requestPasswordReset } = await import('./authService')
    await expect(requestPasswordReset('a@b.co')).rejects.toThrow(/failed to fetch/i)
  })

  it('met à jour le mot de passe via updateUser', async () => {
    updateUser.mockResolvedValue({ data: {}, error: null })
    const { updatePassword } = await import('./authService')
    await updatePassword('nouveaumdp1')
    expect(updateUser).toHaveBeenCalledWith({ password: 'nouveaumdp1' })
  })

  it('propage l’échec updateUser', async () => {
    updateUser.mockResolvedValue({
      data: {},
      error: new Error('Password should be at least 6 characters'),
    })
    const { updatePassword } = await import('./authService')
    await expect(updatePassword('x')).rejects.toThrow(/at least 6/i)
  })
})
