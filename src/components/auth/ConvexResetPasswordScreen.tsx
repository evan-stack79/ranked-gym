import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { requestPasswordReset, updatePassword } from '../../services/authService'
import { friendlyAuthError, validateNewPassword } from '../../utils/authErrors'
import {
  getPasswordRecoveryRedirectTo,
  PASSWORD_RESET_MANUAL_MESSAGE,
  PASSWORD_RESET_SENT_MESSAGE,
} from '../../utils/authRedirect'
import {
  WELCOME_HERO_HEIGHT,
  WELCOME_HERO_PNG,
  WELCOME_HERO_WEBP,
  WELCOME_HERO_WIDTH,
} from './welcomeCopy'

function readResetTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const url = new URL(window.location.href)
    const fromQuery = url.searchParams.get('token')?.trim()
    if (fromQuery) return fromQuery
    const hash = url.hash.replace(/^#/, '')
    if (hash) {
      const params = new URLSearchParams(hash)
      const fromHash = params.get('token')?.trim()
      if (fromHash) return fromHash
    }
    const state = window.history.state as { __rgResetToken?: unknown } | null
    return typeof state?.__rgResetToken === 'string' ? state.__rgResetToken : null
  } catch {
    return null
  }
}

function stripTokenFromUrl(token: string | null): void {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('token') && !url.hash.includes('token=')) return
    url.searchParams.delete('token')
    const trimmedHash = url.hash.replace(/^#/, '')
    if (trimmedHash) {
      const params = new URLSearchParams(trimmedHash)
      params.delete('token')
      url.hash = params.toString() ? `#${params.toString()}` : ''
    }
    const suffix = `${url.pathname}${url.search}${url.hash}`
    const nextState = {
      ...(window.history.state && typeof window.history.state === 'object' ? window.history.state : {}),
      __rgResetToken: token || undefined,
    }
    window.history.replaceState(nextState, '', suffix)
  } catch {
    // Ignore malformed URL states.
  }
}

export function ConvexResetPasswordScreen() {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const nextToken = readResetTokenFromUrl()
    setToken(nextToken)
    if (!nextToken) {
      setError('Lien de réinitialisation invalide. Redemande un nouveau lien.')
    } else if (nextToken.length < 16) {
      setError('Lien expiré ou déjà utilisé. Redemande un nouveau lien.')
    }
    stripTokenFromUrl(nextToken)
  }, [])

  const missingToken = useMemo(() => !token || token.length < 12, [token])
  const canResend = useMemo(
    () =>
      missingToken ||
      (error != null &&
        /(lien de réinitialisation|lien expiré|lien invalide)/i.test(error)),
    [error, missingToken],
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (missingToken) {
      setError('Lien de réinitialisation invalide. Redemande un nouveau lien.')
      return
    }
    const validation = validateNewPassword(password, confirmPassword)
    if (validation) {
      setError(validation)
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await updatePassword(password, token ?? undefined)
      setInfo('Mot de passe mis à jour. Redirection vers la connexion…')
      window.setTimeout(() => {
        window.location.replace('/')
      }, 900)
    } catch (err) {
      setError(friendlyAuthError(err, 'Impossible de réinitialiser le mot de passe.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    const email = resendEmail.trim()
    if (!email || !email.includes('@')) {
      setError('Indique un email valide pour recevoir un nouveau lien.')
      setInfo(null)
      return
    }
    setResendLoading(true)
    setError(null)
    setInfo(null)
    try {
      const redirectTo = getPasswordRecoveryRedirectTo()
      const reset = await requestPasswordReset(email, redirectTo)
      setInfo(reset.delivery === 'manual' ? PASSWORD_RESET_MANUAL_MESSAGE : PASSWORD_RESET_SENT_MESSAGE)
    } catch (err) {
      setError(friendlyAuthError(err, 'Envoi impossible. Réessaie plus tard.'))
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="welcome-screen relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#070708] font-sans">
      <picture className="welcome-screen__picture">
        <source srcSet={WELCOME_HERO_WEBP} type="image/webp" />
        <img
          src={WELCOME_HERO_PNG}
          alt=""
          width={WELCOME_HERO_WIDTH}
          height={WELCOME_HERO_HEIGHT}
          decoding="async"
          draggable={false}
          className="welcome-screen__hero pointer-events-none select-none"
        />
      </picture>

      <div className="welcome-screen__body relative z-[1] mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-end">
        <h1 className="welcome-screen__brand text-center font-semibold tracking-tight text-[#F2F2F7]">
          Ranked <span className="text-brand">Gym</span>
        </h1>
        <div className="rounded-3xl border border-white/10 bg-[#111113]/90 p-4 backdrop-blur">
          <p className="text-center text-[19px] font-bold tracking-tight text-white">
            Nouveau mot de passe
          </p>
          <p className="mt-1 text-center text-[13px] leading-relaxed text-[#AEAEB2]">
            Définis un nouveau mot de passe pour récupérer ton accès.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3" data-reset-password-form="1">
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
                  disabled={loading}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-brand/45 disabled:opacity-50"
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
                  disabled={loading}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 pr-12 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-brand/45 disabled:opacity-50"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93]"
                  aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
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

            <div className="min-h-[3rem] px-0.5">
              {error ? (
                <p className="text-[13px] leading-snug text-[#FF6961]" role="alert" data-reset-error="1">
                  {error}
                </p>
              ) : null}
              {!error && info ? (
                <p className="text-[13px] leading-snug text-[#30D158]" role="status">
                  {info}
                </p>
              ) : null}
            </div>

            {canResend ? (
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={resendEmail}
                    onChange={(event) => setResendEmail(event.target.value)}
                    placeholder="toi@email.com"
                    disabled={loading || resendLoading}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white placeholder:text-[#48484A] outline-none focus:border-brand/45 disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={loading || resendLoading}
                  className="ios-press w-full rounded-2xl border border-white/15 py-3 text-[14px] font-semibold text-[#F2F2F7] disabled:opacity-50"
                >
                  {resendLoading ? 'Envoi…' : 'Renvoyer le lien'}
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || resendLoading}
              className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </form>

          <button
            type="button"
            className="mt-3 w-full text-center text-[13px] font-medium text-[#AEAEB2] underline-offset-2 hover:text-white hover:underline"
            onClick={() => window.location.replace('/')}
            disabled={loading || resendLoading}
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  )
}
