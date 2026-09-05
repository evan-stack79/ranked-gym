import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { IosSheet } from '../ui/IosSheet'

type AuthPanel = 'login' | 'forgot' | 'recovery'

/**
 * Bêta privée — connexion email/mot de passe.
 * Inscription publique désactivée. Récupération de mot de passe disponible.
 */
export function AuthBottomSheet() {
  const {
    isAuthOpen,
    closeAuth,
    authLoading,
    authError,
    authInfo,
    signInWithEmail,
    isAuthenticated,
    isPasswordRecovery,
    requestPasswordReset,
    confirmPasswordRecovery,
    clearAuthMessages,
  } = useAuth()

  const [panel, setPanel] = useState<AuthPanel>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  /** Gate bêta / recovery : pas de fermeture tant que non connecté ou MDP non enregistré. */
  const dismissible = !authLoading && isAuthenticated && !isPasswordRecovery

  useEffect(() => {
    if (isPasswordRecovery) {
      setPanel('recovery')
      setPassword('')
      setConfirmPassword('')
      clearAuthMessages()
    }
  }, [isPasswordRecovery, clearAuthMessages])

  useEffect(() => {
    if (!isAuthOpen) {
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmPassword(false)
      if (!isPasswordRecovery) setPanel('login')
      clearAuthMessages()
    }
  }, [isAuthOpen, isPasswordRecovery, clearAuthMessages])

  const title =
    panel === 'forgot'
      ? 'Mot de passe oublié'
      : panel === 'recovery'
        ? 'Nouveau mot de passe'
        : 'Ranked Gym'

  const subtitle =
    panel === 'forgot'
      ? 'Reçois un lien par email'
      : panel === 'recovery'
        ? 'Choisis un mot de passe sécurisé'
        : 'Bon retour dans l’arène'

  const handleLogin = (event: FormEvent) => {
    event.preventDefault()
    void signInWithEmail(email, password)
  }

  const handleForgot = (event: FormEvent) => {
    event.preventDefault()
    void requestPasswordReset(email)
  }

  const handleRecovery = (event: FormEvent) => {
    event.preventDefault()
    void confirmPasswordRecovery(password, confirmPassword)
  }

  return (
    <IosSheet
      open={isAuthOpen}
      onClose={closeAuth}
      dismissible={dismissible}
      title={title}
      subtitle={subtitle}
      leading={<span className="mt-0.5 text-[15px] font-bold text-[#FF2B2B]">RG</span>}
    >
      <div className="space-y-4 pb-3">
        {panel === 'login' && (
          <>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <Mail className="h-4 w-4 shrink-0 text-[#FF2B2B]" />
              <p className="text-[13px] text-[#AEAEB2]">Connexion par email — bêta privée</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ton mot de passe"
                    disabled={authLoading}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93]"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              {authError && (
                <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connexion…
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            <button
              type="button"
              className="w-full text-center text-[13px] font-medium text-[#AEAEB2] underline-offset-2 hover:text-white hover:underline"
              disabled={authLoading}
              onClick={() => {
                clearAuthMessages()
                setPanel('forgot')
                setPassword('')
              }}
            >
              Mot de passe oublié ?
            </button>

            <p className="pt-1 text-center text-[11px] leading-relaxed text-[#636366]">
              Bêta fermée. Les inscriptions publiques sont actuellement désactivées.
            </p>
          </>
        )}

        {panel === 'forgot' && (
          <>
            <p className="text-[13px] leading-relaxed text-[#AEAEB2]">
              Indique ton email. Si un compte existe, tu recevras un lien pour choisir un nouveau mot
              de passe.
            </p>

            <form onSubmit={handleForgot} className="space-y-3">
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

              {authError && (
                <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
                  {authError}
                </p>
              )}
              {authInfo && (
                <p className="rounded-xl border border-[#30D158]/30 bg-[#30D158]/10 px-3 py-2 text-[13px] text-[#30D158]">
                  {authInfo}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  'Envoyer le lien'
                )}
              </button>
            </form>

            <button
              type="button"
              className="w-full text-center text-[13px] font-medium text-[#AEAEB2] underline-offset-2 hover:text-white hover:underline"
              disabled={authLoading}
              onClick={() => {
                clearAuthMessages()
                setPanel('login')
              }}
            >
              Retour à la connexion
            </button>
          </>
        )}

        {panel === 'recovery' && (
          <>
            <p className="text-[13px] leading-relaxed text-[#AEAEB2]">
              Ton lien est valide. Définis un nouveau mot de passe pour retrouver l’accès.
            </p>

            <form onSubmit={handleRecovery} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                  Nouveau mot de passe
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    disabled={authLoading}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93]"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
                  Confirmer le mot de passe
                </span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retape le mot de passe"
                    disabled={authLoading}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93]"
                    aria-label={
                      showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'
                    }
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </label>

              {authError && (
                <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
                  {authError}
                </p>
              )}
              {authInfo && (
                <p className="rounded-xl border border-[#30D158]/30 bg-[#30D158]/10 px-3 py-2 text-[13px] text-[#30D158]">
                  {authInfo}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  'Enregistrer'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </IosSheet>
  )
}
