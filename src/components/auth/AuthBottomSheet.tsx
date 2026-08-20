import { useEffect, useId, useState, type FormEvent } from 'react'
import { Loader2, Mail, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export function AuthBottomSheet() {
  const {
    isAuthOpen,
    closeAuth,
    authLoading,
    authError,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth()

  const titleId = useId()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pseudo, setPseudo] = useState('')
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
    if (mode === 'signup') {
      void signUpWithEmail(email, password, pseudo || undefined)
    } else {
      void signInWithEmail(email, password)
    }
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
        className={`relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/10 sm:mx-4 sm:rounded-[28px] transition-transform duration-300 ease-out ${
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
            <p className="mt-0.5 text-[13px] text-[#8E8E93]">
              {mode === 'signup' ? 'Crée ton profil athlète' : 'Bon retour dans l’arène'}
            </p>
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

        <div className="space-y-4 px-5 pb-5 pt-3">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
                mode === 'signup' ? 'bg-[#FF2B2B] text-white' : 'text-[#8E8E93]'
              }`}
            >
              Inscription
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
                mode === 'login' ? 'bg-[#FF2B2B] text-white' : 'text-[#8E8E93]'
              }`}
            >
              Connexion
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
            <Mail className="h-4 w-4 shrink-0 text-[#FF2B2B]" />
            <p className="text-[13px] text-[#AEAEB2]">
              Authentification sécurisée par email via Supabase.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Pseudo</span>
                <input
                  type="text"
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="Evan_Lift"
                  disabled={authLoading}
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
                />
              </label>
            )}

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
              <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                Mot de passe
              </span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
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
                  {mode === 'signup' ? 'Création…' : 'Connexion…'}
                </>
              ) : mode === 'signup' ? (
                'Créer mon profil'
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <p className="pt-1 text-center text-[11px] leading-relaxed text-[#636366]">
            {mode === 'signup'
              ? 'Déjà un compte ? Passe sur Connexion.'
              : 'Nouveau ici ? Passe sur Inscription.'}
          </p>
        </div>
      </div>
    </div>
  )
}
