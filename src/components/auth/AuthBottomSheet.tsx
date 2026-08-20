import { useEffect, useId, useState, type FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
      <path d="M16.7 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.03-.01-2.3-.9-2.3-3.7zM14.9 6.3c.6-.7 1-1.7.9-2.7-0.9.0-1.9.6-2.5 1.3-.6.6-1.1 1.6-1 2.6 1 .1 2-.5 2.6-1.2z" />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function AuthBottomSheet() {
  const {
    isAuthOpen,
    closeAuth,
    authLoading,
    authError,
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
  } = useAuth()

  const titleId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isAuthOpen) {
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
  }, [isAuthOpen])

  useEffect(() => {
    if (!isAuthOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !authLoading) closeAuth()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAuthOpen, authLoading, closeAuth])

  if (!isAuthOpen) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void signInWithEmail(email, password)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className={`absolute inset-0 bg-black/65 backdrop-blur-md transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Fermer"
        disabled={authLoading}
        onClick={() => {
          if (!authLoading) closeAuth()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 w-full max-w-lg overflow-hidden rounded-t-[28px] border border-white/10 sm:rounded-[28px] sm:mx-4 transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-8'
        }`}
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgb(255 43 43 / 0.18) 0%, transparent 55%), rgb(22 22 24 / 0.96)',
          boxShadow: '0 -8px 40px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.08)',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <p id={titleId} className="text-[17px] font-semibold tracking-tight text-white">
              Ranked <span className="text-[#FF2B2B]">Gym</span>
            </p>
            <p className="mt-0.5 text-[13px] text-[#8E8E93]">Crée ton profil pour checker et progresser</p>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            disabled={authLoading}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#8E8E93] disabled:opacity-40"
            aria-label="Fermer la connexion"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 pb-5 pt-3">
          <button
            type="button"
            disabled={authLoading}
            onClick={() => void signInWithApple()}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-[16px] font-semibold text-black transition-opacity active:opacity-85 disabled:opacity-50"
          >
            <AppleLogo />
            Continuer avec Apple
          </button>

          <button
            type="button"
            disabled={authLoading}
            onClick={() => void signInWithGoogle()}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-[#2C2C2E] px-4 py-3.5 text-[16px] font-semibold text-white transition-opacity active:opacity-85 disabled:opacity-50"
          >
            <GoogleLogo />
            Continuer avec Google
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[12px] font-medium text-[#8E8E93]">ou avec un email</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@email.com"
                disabled={authLoading}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Mot de passe</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={authLoading}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
              />
            </label>

            {authError && (
              <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="btn-brand flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connexion…
                </>
              ) : (
                'Créer mon profil'
              )}
            </button>
          </form>

          <p className="pt-1 text-center text-[11px] leading-relaxed text-[#636366]">
            En continuant, tu acceptes les conditions Ranked Gym.
            <br />
            Mode simulation — aucun compte réel n&apos;est créé.
          </p>
        </div>
      </div>
    </div>
  )
}
