import { useEffect, useRef, useState } from 'react'
import { Loader2, Pencil, Ruler, Scale } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import { ProfileSubScreenHeader } from '../settings/ProfileSubScreenChrome'
import { useAuth } from '../../context/AuthContext'
import { uploadUserAvatar } from '../../services/avatarService'
import { updateProfileProgress } from '../../services/authService'
import {
  getCalorieProfile,
  normalizeCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'

interface PersonalInformationScreenProps {
  onBack: () => void
  onOpenFullProfile?: () => void
}

export function PersonalInformationScreen({
  onBack,
  onOpenFullProfile,
}: PersonalInformationScreenProps) {
  const { user, profile, refreshProfile, patchProfile } = useAuth()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [pseudo, setPseudo] = useState(profile?.pseudo || user?.displayName || '')
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayAvatar = avatarPreview || profile?.avatar_url || null
  const email = user?.email ?? ''

  useEffect(() => {
    setPseudo(profile?.pseudo || user?.displayName || '')
  }, [profile?.pseudo, user?.displayName])

  useEffect(() => {
    const calorie = getCalorieProfile()
    setWeightKg(calorie.weightKg > 0 ? calorie.weightKg : null)
    setHeightCm(calorie.heightCm > 0 ? calorie.heightCm : null)
  }, [])

  const openAvatarPicker = () => {
    if (!user?.id || avatarUploading) return
    setAvatarError(null)
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user?.id) return

    const localPreview = URL.createObjectURL(file)
    setAvatarPreview(localPreview)
    setAvatarUploading(true)
    setAvatarError(null)

    try {
      const { publicUrl } = await uploadUserAvatar(user.id, file)
      setAvatarPreview(publicUrl)
      patchProfile({ avatar_url: publicUrl })
      void refreshProfile()
    } catch (err) {
      setAvatarPreview(null)
      setAvatarError(err instanceof Error ? err.message : 'Upload impossible.')
    } finally {
      setAvatarUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  const handleSave = async () => {
    if (!user?.id) return
    setError(null)
    setMessage(null)

    const trimmed = pseudo.trim()
    if (trimmed.length < 2) {
      setError('Le pseudo doit contenir au moins 2 caractères.')
      return
    }
    if (weightKg == null || heightCm == null || weightKg <= 0 || heightCm <= 0) {
      setError('Indique un poids et une taille valides.')
      return
    }

    setSaving(true)
    try {
      const row = await updateProfileProgress(user.id, { pseudo: trimmed.slice(0, 24) })
      patchProfile(row)

      const current = getCalorieProfile()
      saveCalorieProfile(
        normalizeCalorieProfile({
          ...current,
          weightKg,
          heightCm,
          onboardingComplete: current.onboardingComplete || true,
        }),
      )

      setMessage('Modifications enregistrées.')
      void refreshProfile()
      window.setTimeout(() => setMessage(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sauvegarde impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 ios-fade-up pb-4">
      <ProfileSubScreenHeader
        title="Informations personnelles"
        subtitle="Compte, photo & biométrie"
        onBack={onBack}
      />

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={openAvatarPicker}
          disabled={avatarUploading}
          className="ios-press relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/55 disabled:opacity-70"
          aria-label="Changer la photo de profil"
        >
          <Avatar
            username={pseudo || 'Athlète'}
            imageUrl={displayAvatar}
            size="xl"
            loading={avatarUploading}
            className="ring-2 ring-[#FF2B2B]/35"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#2C2C2E] text-white shadow-[0_4px_12px_rgb(0_0_0_/0.45)]">
            {avatarUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            )}
          </span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void handleAvatarChange(e)}
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={openAvatarPicker}
          className="ios-press text-[13px] font-semibold text-[#FF2B2B]"
        >
          Changer la photo
        </button>
        {avatarError ? <p className="text-[12px] text-[#FF453A]">{avatarError}</p> : null}
      </div>

      <div className="space-y-3">
        <label className="block overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80 px-4 py-3">
          <span className="text-[12px] font-semibold text-[#8E8E93]">Pseudo</span>
          <input
            type="text"
            value={pseudo}
            maxLength={24}
            onChange={(e) => setPseudo(e.target.value)}
            className="mt-1 w-full bg-transparent text-[17px] font-semibold text-white outline-none placeholder:text-[#48484A]"
            placeholder="Ton pseudo"
            autoComplete="nickname"
          />
        </label>

        <div className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80 px-4 py-3">
          <p className="text-[12px] font-semibold text-[#8E8E93]">Adresse email</p>
          <p className="mt-1 break-all text-[15px] text-[#EBEBF5]">{email || '—'}</p>
          <p className="mt-1 text-[11px] text-[#636366]">
            L’email est lié à ton compte. Contacte le support pour le modifier.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80 px-4 py-3">
            <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#8E8E93]">
              <Scale className="h-3.5 w-3.5" aria-hidden />
              Poids
            </span>
            <div className="flex items-end gap-1">
              <ClearableNumberInput
                value={weightKg}
                onChange={setWeightKg}
                min={35}
                max={250}
                step={0.1}
                aria-label="Poids en kg"
                className="w-full bg-transparent text-[22px] font-bold text-white outline-none"
              />
              <span className="pb-0.5 text-[13px] text-[#8E8E93]">kg</span>
            </div>
          </label>

          <label className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80 px-4 py-3">
            <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#8E8E93]">
              <Ruler className="h-3.5 w-3.5" aria-hidden />
              Taille
            </span>
            <div className="flex items-end gap-1">
              <ClearableNumberInput
                value={heightCm}
                onChange={setHeightCm}
                min={120}
                max={230}
                step={1}
                aria-label="Taille en cm"
                className="w-full bg-transparent text-[22px] font-bold text-white outline-none"
              />
              <span className="pb-0.5 text-[13px] text-[#8E8E93]">cm</span>
            </div>
          </label>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-3 py-2 text-[13px] text-[#FF6961]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-[#30D158]/30 bg-[#30D158]/10 px-3 py-2 text-[13px] text-[#30D158]">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Enregistrement…
          </>
        ) : (
          'Sauvegarder les modifications'
        )}
      </button>

      {onOpenFullProfile ? (
        <button
          type="button"
          onClick={onOpenFullProfile}
          className="ios-press text-center text-[13px] font-medium text-[#8E8E93]"
        >
          Voir mon profil complet (stats d’arène)
        </button>
      ) : null}
    </div>
  )
}
