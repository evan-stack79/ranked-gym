import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { BrandMark } from '../brand/BrandMark'
import { MetalButton } from '../10k/web-metal-button/MetalButton'
import { IosSheet } from '../ui/IosSheet'

/** CTA auth plein largeur — anneau métal liquide (thème Radix via --tk-*). */
function AuthMetalSubmit({
  loading,
  idleLabel,
  loadingLabel,
}: {
  loading: boolean
  idleLabel: string
  loadingLabel: string
}) {
  return (
    <div className="rg-metal-auth">
      <MetalButton
        type="submit"
        disabled={loading}
        theme="dark"
        preset="chromatic"
        strength={0.92}
        icon={
          loading ? (
            <Loader2 className="tk-metal-btn__icon animate-spin" aria-hidden />
          ) : null
        }
        aria-busy={loading || undefined}
      >
        {loading ? loadingLabel : idleLabel}
      </MetalButton>
    </div>
  )
}

type AuthPanel = 'login' | 'signup' | 'forgot' | 'recovery'

function readPanelFromQuery(): AuthPanel | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('authPanel')
  if (raw === 'login' || raw === 'signup' || raw === 'forgot') return raw
  return null
}

/**
 * Auth email/mot de passe.
 * L’inscription reste gouvernée par la configuration backend.
 */
export function AuthBottomSheet() {
  const {
    isAuthOpen,
    closeAuth,
    authLoading,
    authError,
    authErrorCode,
    authInfo,
    signInWithEmail,
    signUpWithEmail,
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

  /** Recovery : pas de fermeture tant que le mot de passe n’est pas enregistré. */
  const dismissible = !authLoading && !isPasswordRecovery

  useEffect(() => {
    if (isPasswordRecovery) {
      setPanel('recovery')
      setPassword('')
      setConfirmPassword('')
      clearAuthMessages()
    }
  }, [isPasswordRecovery, clearAuthMessages])

  useEffect(() => {
    if (!isAuthOpen || isPasswordRecovery) return
    const fromQuery = readPanelFromQuery()
    if (fromQuery) setPanel(fromQuery)
  }, [isAuthOpen, isPasswordRecovery])

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
        : panel === 'signup'
          ? 'Créer un compte'
        : 'Ranked Gym'

  const subtitle =
    panel === 'forgot'
      ? 'Demande un lien de réinitialisation'
      : panel === 'recovery'
        ? 'Choisis un mot de passe sécurisé'
        : panel === 'signup'
          ? 'Inscription email + mot de passe'
        : 'Bon retour à la salle'

  const handleLogin = (event: FormEvent) => {
    event.preventDefault()
    void signInWithEmail(email, password)
  }

  const handleForgot = (event: FormEvent) => {
    event.preventDefault()
    void requestPasswordReset(email)
  }

  const handleSignup = (event: FormEvent) => {
    event.preventDefault()
    const pseudo = email.split('@')[0]?.trim()
    void signUpWithEmail(email, password, pseudo || undefined)
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
      leading={
        <BrandMark
          variant="compact"
          showWordmark={false}
          className="mt-0.5"
        />
      }
    >
      <div className="space-y-4 pb-3">
        {panel === 'login' && (
          <>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <Mail className="h-4 w-4 shrink-0 text-[#FF0702]" />
              <p className="text-[13px] text-[#ACB4BA]">Connexion par email</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@email.com"
                  disabled={authLoading}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white placeholder:text-[#596166] outline-none focus:border-[#FF0702]/45 disabled:opacity-50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">
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
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#596166] outline-none focus:border-[#FF0702]/45 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ACB4BA]"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              {authError && (
                <p
                  className="rounded-xl border-2 border-[#FF0702] bg-[#2A0000] px-3 py-3 text-[20px] font-extrabold leading-tight text-[#FF0702] [overflow-wrap:anywhere]"
                  role="alert"
                  data-auth-error="1"
                  data-auth-error-raw="1"
                >
                  {authError}
                </p>
              )}
              {authErrorCode === 'AUTH_PASSWORD_RESET_REQUIRED' && email.trim().length > 3 ? (
                <button
                  type="button"
                  className="w-full text-left text-[13px] font-medium text-[#ACB4BA] underline-offset-2 hover:text-white hover:underline"
                  disabled={authLoading}
                  onClick={() => void requestPasswordReset(email)}
                >
                  Renvoyer le lien de réinitialisation
                </button>
              ) : null}
              {authInfo && (
                <p className="px-0.5 text-[13px] leading-snug text-[#30D158]" role="status">
                  {authInfo}
                </p>
              )}

              <AuthMetalSubmit
                loading={authLoading}
                idleLabel="Se connecter"
                loadingLabel="Connexion…"
              />
            </form>

            <button
              type="button"
              className="w-full text-center text-[13px] font-medium text-[#ACB4BA] underline-offset-2 hover:text-white hover:underline"
              disabled={authLoading}
              onClick={() => {
                clearAuthMessages()
                setPanel('forgot')
                setPassword('')
              }}
            >
              Mot de passe oublié ?
            </button>

            <button
              type="button"
              className="w-full text-center text-[13px] font-medium text-[#ACB4BA] underline-offset-2 hover:text-white hover:underline"
              disabled={authLoading}
              onClick={() => {
                clearAuthMessages()
                setPanel('signup')
                setPassword('')
              }}
            >
              Créer un compte
            </button>
          </>
        )}

        {panel === 'signup' && (
          <>
            <p className="text-[13px] leading-relaxed text-[#ACB4BA]">
              Crée un compte test. L’inscription peut être limitée par la configuration backend.
            </p>

            <form onSubmit={handleSignup} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@email.com"
                  disabled={authLoading}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white placeholder:text-[#596166] outline-none focus:border-[#FF0702]/45 disabled:opacity-50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">
                  Mot de passe
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
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#596166] outline-none focus:border-[#FF0702]/45 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ACB4BA]"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              {authError && (
                <p className="px-0.5 text-[13px] leading-snug text-[#FF907F]" role="alert" data-auth-error="1">
                  {authError}
                </p>
              )}
              {authInfo && (
                <p className="px-0.5 text-[13px] leading-snug text-[#30D158]" role="status">
                  {authInfo}
                </p>
              )}

              <AuthMetalSubmit
                loading={authLoading}
                idleLabel="Créer le compte"
                loadingLabel="Création…"
              />
            </form>

            <button
              type="button"
              className="w-full text-center text-[13px] font-medium text-[#ACB4BA] underline-offset-2 hover:text-white hover:underline"
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

        {panel === 'forgot' && (
          <>
            <p className="text-[13px] leading-relaxed text-[#ACB4BA]">
              Indique ton email. Si un compte existe, tu recevras un lien pour choisir un nouveau mot
              de passe.
            </p>

            <form onSubmit={handleForgot} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@email.com"
                  disabled={authLoading}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white placeholder:text-[#596166] outline-none focus:border-[#FF0702]/45 disabled:opacity-50"
                />
              </label>

              {authError && (
                <p className="px-0.5 text-[13px] leading-snug text-[#FF907F]" role="alert" data-auth-error="1">
                  {authError}
                </p>
              )}
              {authInfo && (
                <p className="px-0.5 text-[13px] leading-snug text-[#30D158]" role="status">
                  {authInfo}
                </p>
              )}

              <AuthMetalSubmit
                loading={authLoading}
                idleLabel="Envoyer le lien"
                loadingLabel="Envoi…"
              />
            </form>

            <button
              type="button"
              className="w-full text-center text-[13px] font-medium text-[#ACB4BA] underline-offset-2 hover:text-white hover:underline"
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
            <p className="text-[13px] leading-relaxed text-[#ACB4BA]">
              Ton lien est valide. Définis un nouveau mot de passe pour retrouver l’accès.
            </p>

            <form onSubmit={handleRecovery} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">
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
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#596166] outline-none focus:border-[#FF0702]/45 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ACB4BA]"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#ACB4BA]">
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
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#596166] outline-none focus:border-[#FF0702]/45 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ACB4BA]"
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
                <p className="px-0.5 text-[13px] leading-snug text-[#FF907F]" role="alert" data-auth-error="1">
                  {authError}
                </p>
              )}
              {authInfo && (
                <p className="px-0.5 text-[13px] leading-snug text-[#30D158]" role="status">
                  {authInfo}
                </p>
              )}

              <AuthMetalSubmit
                loading={authLoading}
                idleLabel="Enregistrer"
                loadingLabel="Enregistrement…"
              />
            </form>
          </>
        )}
      </div>
    </IosSheet>
  )
}
