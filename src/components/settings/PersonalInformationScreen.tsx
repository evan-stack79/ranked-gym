import { useEffect, useRef, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { HeightWeightPicker } from '../common/HeightWeightPicker'
import { ProfileSubScreenHeader } from '../settings/ProfileSubScreenChrome'
import { useAuth } from '../../context/AuthContext'
import { uploadUserAvatar } from '../../services/avatarService'
import { updateProfileProgress } from '../../services/authService'
import {
  clearBodyMetrics,
  getCalorieProfile,
  normalizeCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import {
  readHealthDeclarations,
  sanitizeHeightCm,
  sanitizeWeightKg,
  shouldShowHeightWeightPicker,
} from '../../services/nutritionSafetyRules'
import { getTrainingState, setTrainingSports } from '../../services/trainingStorage'
import { SportsMultiSelect } from '../onboarding/SportsMultiSelect'

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
  const [profileAge, setProfileAge] = useState(0)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bodyNoted, setBodyNoted] = useState(false)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [healthFlags, setHealthFlags] = useState(() =>
    readHealthDeclarations(getCalorieProfile()),
  )

  const displayAvatar = avatarPreview || profile?.avatar_url || null
  const email = user?.email ?? ''
  const showBodyMetrics = shouldShowHeightWeightPicker({
    age: profileAge > 0 ? profileAge : null,
    weightKg,
    heightCm,
    sex: getCalorieProfile().sex,
    declarations: healthFlags,
  })

  useEffect(() => {
    setPseudo(profile?.pseudo || user?.displayName || '')
  }, [profile?.pseudo, user?.displayName])

  useEffect(() => {
    const calorie = getCalorieProfile()
    setWeightKg(sanitizeWeightKg(calorie.weightKg))
    setHeightCm(sanitizeHeightCm(calorie.heightCm))
    setProfileAge(calorie.age > 0 ? calorie.age : 0)
    setHealthFlags(readHealthDeclarations(calorie))
    const training = getTrainingState()
    setSportIds(training.sportsUndecided ? [] : training.favoriteSportIds)
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

  const handleSaveBody = (next: { weightKg: number; heightCm: number }) => {
    setError(null)
    setWeightKg(next.weightKg)
    setHeightCm(next.heightCm)
    const current = getCalorieProfile()
    saveCalorieProfile(
      normalizeCalorieProfile({
        ...current,
        weightKg: next.weightKg,
        heightCm: next.heightCm,
        bodyMetricsClearedAt: null,
        onboardingComplete: current.onboardingComplete || true,
      }),
    )
    setBodyNoted(true)
    setMessage('C’est noté.')
    window.setTimeout(() => {
      setBodyNoted(false)
      setMessage(null)
    }, 1600)
  }

  const handleEraseBody = () => {
    clearBodyMetrics()
    setWeightKg(null)
    setHeightCm(null)
    setBodyNoted(false)
    setMessage('Mensurations effacées.')
    window.setTimeout(() => setMessage(null), 2000)
  }

  const handleSkipBody = () => {
    const calorie = getCalorieProfile()
    setWeightKg(sanitizeWeightKg(calorie.weightKg))
    setHeightCm(sanitizeHeightCm(calorie.heightCm))
    setBodyNoted(false)
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

    setSaving(true)
    try {
      const row = await updateProfileProgress(user.id, { pseudo: trimmed.slice(0, 24) })
      patchProfile(row)

      const current = getCalorieProfile()
      saveCalorieProfile(
        normalizeCalorieProfile({
          ...current,
          weightKg: showBodyMetrics ? weightKg : sanitizeWeightKg(current.weightKg),
          heightCm: showBodyMetrics ? heightCm : sanitizeHeightCm(current.heightCm),
          onboardingComplete: current.onboardingComplete || true,
        }),
      )
      if (sportIds.length > 0) {
        setTrainingSports(sportIds)
      }

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
          <span className="absolute -bottom-0.5 -right-0.5 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-[#2C2C2E] text-white shadow-[0_4px_12px_rgb(0_0_0_/0.45)]">
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

        {/* SAFETY (PM / Vérificateur): body weight is a form input — never CountUpNumber. */}
        {showBodyMetrics ? (
          <div className="rg-no-motion" data-testid="personal-info-body-metrics">
            <HeightWeightPicker
              value={{ weightKg, heightCm }}
              onChange={(next) => {
                setWeightKg(next.weightKg)
                setHeightCm(next.heightCm)
              }}
              onSave={handleSaveBody}
              onSkip={handleSkipBody}
              onErase={handleEraseBody}
              allowErase
              confirmMessage={bodyNoted ? 'C’est noté.' : null}
            />
          </div>
        ) : null}

        <div
          className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80 px-4 py-3"
          data-profile-sports
        >
          <p className="text-[12px] font-semibold text-[#8E8E93]">Sports</p>
          <p className="mt-1 text-[12px] text-[#636366]">
            Modifiable à tout moment — alimente les recommandations Training.
          </p>
          <div className="mt-3 max-h-72">
            <SportsMultiSelect selectedIds={sportIds} onChange={setSportIds} idPrefix="profile-sport" />
          </div>
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
          Voir mon profil complet (stats athlète)
        </button>
      ) : null}
    </div>
  )
}
