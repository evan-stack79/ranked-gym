import { useState, type FormEvent } from 'react'
import { KeyRound, Loader2, LogOut, Trash2 } from 'lucide-react'
import { GhostModeToggle } from '../profile/GhostModeToggle'
import { IosSheet } from '../ui/IosSheet'
import {
  ProfileSubScreenHeader,
  SettingsActionRow,
} from './ProfileSubScreenChrome'
import { changePassword, deleteOwnAccount, signInWithEmail } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

interface SecurityScreenProps {
  onBack: () => void
  ghostModeEnabled: boolean
  ghostSaving?: boolean
  onGhostModeChange: (enabled: boolean) => void
  onSignOut: () => void
}

export function SecurityScreen({
  onBack,
  ghostModeEnabled,
  ghostSaving = false,
  onGhostModeChange,
  onSignOut,
}: SecurityScreenProps) {
  const { user, signOut } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordOk, setPasswordOk] = useState<string | null>(null)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resetPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setPasswordOk(null)
  }

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordOk(null)

    if (!user?.email) {
      setPasswordError('Session invalide. Reconnecte-toi.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les nouveaux mots de passe ne correspondent pas.')
      return
    }

    setPasswordBusy(true)
    try {
      await changePassword(user.email, currentPassword, newPassword)
      setPasswordOk('Mot de passe mis à jour.')
      resetPasswordForm()
      window.setTimeout(() => {
        setPasswordOpen(false)
        setPasswordOk(null)
      }, 1200)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setPasswordError(
        raw.toLowerCase().includes('invalid login')
          ? 'Ancien mot de passe incorrect.'
          : raw || 'Impossible de changer le mot de passe.',
      )
    } finally {
      setPasswordBusy(false)
    }
  }

  const handleDeleteAccount = async (event: FormEvent) => {
    event.preventDefault()
    setDeleteError(null)
    if (!user?.email) {
      setDeleteError('Session invalide. Reconnecte-toi.')
      return
    }
    if (!deletePassword) {
      setDeleteError('Confirme avec ton mot de passe.')
      return
    }

    setDeleteBusy(true)
    try {
      await signInWithEmail(user.email, deletePassword)
      await deleteOwnAccount()
      await signOut()
      onSignOut()
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setDeleteError(
        raw.toLowerCase().includes('invalid login')
          ? 'Mot de passe incorrect.'
          : raw.includes('delete_own_account') || raw.toLowerCase().includes('function')
            ? 'Suppression indisponible pour le moment. Contacte le support Ranked Gym.'
            : raw || 'Suppression impossible.',
      )
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 ios-fade-up pb-4">
      <ProfileSubScreenHeader
        title="Sécurité & Confidentialité"
        subtitle="Compte, Mode Furtif & données"
        onBack={onBack}
      />

      <div className="space-y-3">
        <GhostModeToggle
          enabled={ghostModeEnabled}
          onChange={onGhostModeChange}
          disabled={ghostSaving}
        />
        <p className="px-1 text-[13px] leading-relaxed text-[#8E8E93]">
          Le Mode Furtif masque ta localisation et ton identité dans le feed. Tes données
          d&apos;entraînement restent privées.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80">
        <div className="border-b border-[#2C2C2E]">
          <SettingsActionRow
            icon={KeyRound}
            label="Changer mon mot de passe"
            onClick={() => {
              resetPasswordForm()
              setPasswordOpen(true)
            }}
          />
        </div>
        <SettingsActionRow
          icon={LogOut}
          label="Se déconnecter"
          showChevron={false}
          onClick={() => {
            onSignOut()
          }}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#FF453A]/25 bg-[#FF453A]/08">
        <SettingsActionRow
          icon={Trash2}
          label="Supprimer mon compte"
          danger
          showChevron={false}
          onClick={() => {
            setDeletePassword('')
            setDeleteError(null)
            setDeleteOpen(true)
          }}
        />
      </div>

      <IosSheet
        open={passwordOpen}
        onClose={() => {
          if (!passwordBusy) setPasswordOpen(false)
        }}
        dismissible={!passwordBusy}
        title="Changer mon mot de passe"
        subtitle="Sécurise ton compte"
        leading={<KeyRound className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3 pb-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
              Ancien mot de passe
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordBusy}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
              Nouveau mot de passe
            </span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordBusy}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
              Confirmer le nouveau mot de passe
            </span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordBusy}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white outline-none focus:border-[#FF2B2B]/45 disabled:opacity-50"
            />
          </label>

          {passwordError ? (
            <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
              {passwordError}
            </p>
          ) : null}
          {passwordOk ? (
            <p className="rounded-xl border border-[#30D158]/30 bg-[#30D158]/10 px-3 py-2 text-[13px] text-[#30D158]">
              {passwordOk}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={passwordBusy}
            className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {passwordBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Mise à jour…
              </>
            ) : (
              'Enregistrer le mot de passe'
            )}
          </button>
        </form>
      </IosSheet>

      <IosSheet
        open={deleteOpen}
        onClose={() => {
          if (!deleteBusy) setDeleteOpen(false)
        }}
        dismissible={!deleteBusy}
        title="Supprimer mon compte"
        subtitle="Action définitive"
        leading={<Trash2 className="mt-0.5 h-5 w-5 text-[#FF453A]" />}
      >
        <form onSubmit={(e) => void handleDeleteAccount(e)} className="space-y-3 pb-2">
          <p className="text-[13px] leading-relaxed text-[#AEAEB2]">
            Ton profil, tes séances et tes sauvegardes cloud seront définitivement effacés. Cette
            action est irréversible.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
              Confirme avec ton mot de passe
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              disabled={deleteBusy}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-3.5 text-[16px] text-white outline-none focus:border-[#FF453A]/45 disabled:opacity-50"
            />
          </label>
          {deleteError ? (
            <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
              {deleteError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={deleteBusy}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF453A]/40 bg-[#FF453A]/15 py-3.5 text-[15px] font-semibold text-[#FF6961] disabled:opacity-50"
          >
            {deleteBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Suppression…
              </>
            ) : (
              'Supprimer définitivement'
            )}
          </button>
        </form>
      </IosSheet>
    </div>
  )
}
