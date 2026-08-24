import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { IosSheet } from '../ui/IosSheet'

/**
 * Bêta privée — connexion email/mot de passe uniquement.
 * Aucune inscription publique (Sign Up désactivé).
 */
export function AuthBottomSheet() {
  const {
    isAuthOpen,
    closeAuth,
    authLoading,
    authError,
    signInWithEmail,
    isAuthenticated,
  } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  /** Gate bêta : on ne peut pas fermer la feuille tant qu’il n’y a pas de session. */
  const dismissible = !authLoading && isAuthenticated

  useEffect(() => {
    if (!isAuthOpen) {
      setEmail('')
      setPassword('')
    }
  }, [isAuthOpen])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void signInWithEmail(email, password)
  }

  return (
    <IosSheet
      open={isAuthOpen}
      onClose={closeAuth}
      dismissible={dismissible}
      title="Ranked Gym"
      subtitle="Bon retour dans l’arène"
      leading={<span className="mt-0.5 text-[15px] font-bold text-[#FF2B2B]">RG</span>}
    >
      <div className="space-y-4 pb-3">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
          <Mail className="h-4 w-4 shrink-0 text-[#FF2B2B]" />
          <p className="text-[13px] text-[#AEAEB2]">Connexion par email — bêta privée</p>
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
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
              Mot de passe
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ton mot de passe"
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

        <p className="pt-1 text-center text-[11px] leading-relaxed text-[#636366]">
          Bêta fermée. Les inscriptions publiques sont actuellement désactivées.
        </p>
      </div>
    </IosSheet>
  )
}
