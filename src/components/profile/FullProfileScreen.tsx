import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Dumbbell,
  Pencil,
  Ruler,
  Scale,
  Shield,
  UserRound,
} from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import { RankShowcase } from './RankShowcase'
import { ProfileXPBar } from './ProfileXPBar'
import { StatGrid } from './StatGrid'
import { BadgeShowcase } from './BadgeShowcase'
import { useAuth } from '../../context/AuthContext'
import { uploadUserAvatar } from '../../services/avatarService'
import {
  getCalorieProfile,
  normalizeCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import { loadProfileStats } from '../../services/profileStats'
import { getRankFromLevel } from '../../utils/rank'

const XP_PER_LEVEL = 1000

interface FullProfileScreenProps {
  onBack: () => void
}

function TrustBanner() {
  return (
    <div className="flex gap-3 rounded-2xl border border-[#FF2B2B]/20 bg-[#FF2B2B]/08 px-4 py-3.5">
      <span className="shrink-0 text-[18px]" aria-hidden>
        🔒
      </span>
      <p className="text-[13px] leading-relaxed text-[#C7C7CC]">
        <span className="font-semibold text-white">Ta sécurité avant tout.</span>{' '}
        Ces données servent uniquement à ton évolution. Nous refusons de les revendre ou de faire
        de la publicité ciblée. Ton corps, tes règles, tes données.
      </p>
    </div>
  )
}

export function FullProfileScreen({ onBack }: FullProfileScreenProps) {
  const { user, profile, refreshProfile, patchProfile } = useAuth()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [age, setAge] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const username = profile?.pseudo || user?.displayName || 'Athlète'
  const level = profile?.level ?? 1
  const currentXp = profile?.xp ?? 0
  const rank = getRankFromLevel(level)
  const displayAvatarUrl = avatarPreview || profile?.avatar_url || null

  useEffect(() => {
    const calorie = getCalorieProfile()
    setWeightKg(calorie.weightKg > 0 ? calorie.weightKg : null)
    setHeightCm(calorie.heightCm > 0 ? calorie.heightCm : null)
    setAge(calorie.age > 0 ? calorie.age : null)
  }, [])

  const refreshSessions = useCallback(() => {
    if (!user?.id) {
      setSessionCount(0)
      return
    }
    void loadProfileStats({
      userId: user.id,
      streakDays: profile?.current_streak ?? 0,
    }).then((stats) => setSessionCount(stats.sessionCount))
  }, [user?.id, profile?.current_streak])

  useEffect(() => {
    refreshSessions()
    const onRestore = () => refreshSessions()
    window.addEventListener('ranked-gym:backup-restored', onRestore)
    return () => window.removeEventListener('ranked-gym:backup-restored', onRestore)
  }, [refreshSessions])

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
    setSaveError(null)
    setSaveMessage(null)

    if (weightKg == null || heightCm == null || age == null) {
      setSaveError('Remplis poids, taille et âge.')
      return
    }
    if (weightKg <= 0 || heightCm <= 0 || age <= 0) {
      setSaveError('Les valeurs doivent être supérieures à zéro.')
      return
    }

    setSaving(true)
    try {
      const current = getCalorieProfile()
      saveCalorieProfile(
        normalizeCalorieProfile({
          ...current,
          weightKg,
          heightCm,
          age,
          goalWeightKg: current.goalWeightKg > 0 ? current.goalWeightKg : weightKg,
          onboardingComplete: current.onboardingComplete || true,
        }),
      )
      setSaveMessage('Profil enregistré.')
      window.setTimeout(() => setSaveMessage(null), 2500)
    } catch {
      setSaveError('Impossible de sauvegarder. Réessaie.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6 ios-fade-up">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="ios-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#EBEBF5]"
          aria-label="Retour aux paramètres"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-bold tracking-tight text-white">Mon profil</h1>
          <p className="text-[13px] text-[#8E8E93]">Statistiques & données personnelles</p>
        </div>
        <Shield className="h-5 w-5 shrink-0 text-[#636366]" strokeWidth={2} aria-hidden />
      </div>

      <TrustBanner />

      <div className="flex flex-col items-center gap-3 pt-1">
        <div className="relative">
          <button
            type="button"
            onClick={openAvatarPicker}
            disabled={avatarUploading || !user?.id}
            className="ios-press relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/55"
            aria-label="Changer la photo de profil"
          >
            <Avatar
              username={username}
              imageUrl={displayAvatarUrl}
              size="xl"
              loading={avatarUploading}
              className="h-28 w-28 text-3xl ring-[3px] ring-[#FF2B2B]/40"
            />
            {user?.id ? (
              <span
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#2C2C2E] text-white shadow-[0_4px_12px_rgb(0_0_0_/0.45)]"
                aria-hidden
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleAvatarChange}
            tabIndex={-1}
          />
        </div>
        <p className="text-[22px] font-bold tracking-tight text-white">{username}</p>
        <p className="text-[14px] font-medium text-[#FF6961]">{rank.title}</p>
        {avatarError ? (
          <p className="text-center text-[12px] text-[#FF453A]">{avatarError}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8E8E93]">
            Niveau
          </p>
          <p className="mt-1 text-[32px] font-black tabular-nums tracking-tight text-white">
            {level}
          </p>
          <p className="mt-0.5 text-[13px] text-[#636366]">{rank.tier}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5 text-[#00B4FF]" strokeWidth={2.25} />
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8E8E93]">
              Séances
            </p>
          </div>
          <p className="mt-1 text-[32px] font-black tabular-nums tracking-tight text-white">
            {sessionCount}
          </p>
          <p className="mt-0.5 text-[13px] text-[#636366]">Total enregistrées</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="ios-label px-1">Corps & métabolisme</h2>

        <label className="glass-card block rounded-2xl p-4">
          <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
            <Scale className="h-3.5 w-3.5 text-[#FF9F0A]" />
            Poids
          </span>
          <div className="flex items-end gap-1">
            <ClearableNumberInput
              value={weightKg}
              onChange={setWeightKg}
              min={35}
              max={250}
              step={0.1}
              required={false}
              placeholder="70.5"
              aria-label="Poids"
              className="w-full bg-transparent text-[28px] font-bold text-white outline-none"
            />
            <span className="pb-1 text-[13px] text-[#8E8E93]">kg</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="glass-card block rounded-2xl p-4">
            <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
              <UserRound className="h-3.5 w-3.5 text-[#FF9F0A]" />
              Âge
            </span>
            <ClearableNumberInput
              value={age}
              onChange={setAge}
              min={14}
              max={90}
              required={false}
              placeholder="24"
              aria-label="Âge"
              className="w-full bg-transparent text-[24px] font-bold text-white outline-none"
            />
          </label>

          <label className="glass-card block rounded-2xl p-4">
            <span className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
              <Ruler className="h-3.5 w-3.5 text-[#00B4FF]" />
              Taille
            </span>
            <div className="flex items-end gap-1">
              <ClearableNumberInput
                value={heightCm}
                onChange={setHeightCm}
                min={120}
                max={230}
                required={false}
                placeholder="175"
                aria-label="Taille"
                className="w-full bg-transparent text-[24px] font-bold text-white outline-none"
              />
              <span className="pb-0.5 text-[13px] text-[#8E8E93]">cm</span>
            </div>
          </label>
        </div>

        {saveError ? (
          <p className="px-1 text-[13px] text-[#FF453A]">{saveError}</p>
        ) : null}
        {saveMessage ? (
          <p className="px-1 text-[13px] font-medium text-[#30D158]">{saveMessage}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Enregistrement…' : 'Sauvegarder'}
        </button>
      </section>

      <div className="flex flex-col gap-8 pt-2">
        <RankShowcase rank={rank} level={level} />
        <ProfileXPBar
          level={level}
          currentXp={currentXp % XP_PER_LEVEL}
          xpToNextLevel={XP_PER_LEVEL}
        />
        <StatGrid />
        <BadgeShowcase />
      </div>
    </div>
  )
}
