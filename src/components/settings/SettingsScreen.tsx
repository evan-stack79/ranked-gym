import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  CreditCard,
  HeartPulse,
  LogOut,
  Pencil,
  Settings2,
  Shield,
  UserRound,
} from 'lucide-react'
import { isCameraHeartRateEnabled } from '../../native/cameraHeartRate'
import { Avatar } from '../ui/Avatar'
import { uploadUserAvatar } from '../../services/avatarService'
import { IosSheet } from '../ui/IosSheet'
import { DisciplinePicker } from '../discipline/DisciplinePicker'
import { ProPassCard } from './ProPassCard'
import { SettingsMenuRow } from './SettingsMenuRow'
import {
  disciplineFromLabel,
  getDiscipline,
  type AppDisciplineId,
} from '../../data/disciplines'

const PRO_PASS_DISMISSED_KEY = 'ranked-gym:pro-pass-dismissed'

export type SettingsSheet = 'payment' | 'preferences' | null

export type SettingsMenuId = 'personal' | 'privacy' | 'payment' | 'preferences' | 'cameraHeartRate'

interface SettingsScreenProps {
  username: string
  avatarUrl?: string | null
  email?: string
  isAuthenticated: boolean
  profileDiscipline?: string
  onViewProfile?: () => void
  onOpenPersonalInfo?: () => void
  onOpenSecurity?: () => void
  onOpenCameraHeartRate?: () => void
  onRequireAuth?: () => void
  onTryPro?: () => void
  onDisciplineChange?: (disciplineLabel: string) => void
  onSignOut?: () => void
  showSignOut?: boolean
  userId?: string
  onAvatarUpdated?: (url: string) => void
}

function readProPassDismissed(): boolean {
  try {
    return localStorage.getItem(PRO_PASS_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeProPassDismissed() {
  try {
    localStorage.setItem(PRO_PASS_DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function SettingsScreen({
  username,
  avatarUrl,
  isAuthenticated,
  profileDiscipline,
  onViewProfile,
  onOpenPersonalInfo,
  onOpenSecurity,
  onOpenCameraHeartRate,
  onRequireAuth,
  onTryPro,
  onDisciplineChange,
  onSignOut,
  showSignOut = false,
  userId,
  onAvatarUpdated,
}: SettingsScreenProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [proDismissed, setProDismissed] = useState(readProPassDismissed)
  const [sheet, setSheet] = useState<SettingsSheet>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [disciplineId, setDisciplineId] = useState<AppDisciplineId>(() =>
    disciplineFromLabel(profileDiscipline) || 'musculation',
  )

  const displayAvatarUrl = avatarPreview || avatarUrl || null
  const canEditAvatar = Boolean(userId && isAuthenticated)

  useEffect(() => {
    if (profileDiscipline) {
      setDisciplineId(disciplineFromLabel(profileDiscipline))
    }
  }, [profileDiscipline])

  const openAvatarPicker = () => {
    if (!canEditAvatar || avatarUploading) return
    setAvatarError(null)
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return

    const localPreview = URL.createObjectURL(file)
    setAvatarPreview(localPreview)
    setAvatarUploading(true)
    setAvatarError(null)

    try {
      const { publicUrl } = await uploadUserAvatar(userId, file)
      setAvatarPreview(publicUrl)
      onAvatarUpdated?.(publicUrl)
    } catch (err) {
      setAvatarPreview(null)
      setAvatarError(err instanceof Error ? err.message : 'Upload impossible.')
    } finally {
      setAvatarUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  const handleTryPro = () => {
    if (onTryPro) {
      onTryPro()
      return
    }
    if (!isAuthenticated) {
      onRequireAuth?.()
      return
    }
    setSheet('payment')
  }

  const openPersonal = () => {
    if (!isAuthenticated) {
      onRequireAuth?.()
      return
    }
    ;(onOpenPersonalInfo ?? onViewProfile)?.()
  }

  const openSecurity = () => {
    if (!isAuthenticated) {
      onRequireAuth?.()
      return
    }
    onOpenSecurity?.()
  }

  const menuSections: Array<{
    items: Array<{ id: SettingsMenuId; icon: typeof UserRound; label: string }>
  }> = [
    {
      items: [
        { id: 'personal', icon: UserRound, label: 'Informations personnelles' },
        { id: 'privacy', icon: Shield, label: 'Sécurité & Confidentialité' },
        { id: 'payment', icon: CreditCard, label: 'Méthodes de paiement' },
        { id: 'preferences', icon: Settings2, label: 'Préférences' },
        ...(isCameraHeartRateEnabled()
          ? [{ id: 'cameraHeartRate' as const, icon: HeartPulse, label: 'Tester la mesure BPM' }]
          : []),
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex w-full items-center gap-4 rounded-2xl px-1 py-1">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={canEditAvatar ? openAvatarPicker : openPersonal}
            disabled={avatarUploading}
            className="ios-press relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/55 disabled:opacity-100"
            aria-label={canEditAvatar ? 'Changer la photo de profil' : `Avatar de ${username}`}
          >
            <Avatar
              username={username}
              imageUrl={displayAvatarUrl}
              size="xl"
              loading={avatarUploading}
              className="ring-2 ring-[#FF2B2B]/35"
            />
            {canEditAvatar ? (
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#2C2C2E] text-white shadow-[0_4px_12px_rgb(0_0_0_/0.45)]"
                aria-hidden
              >
                <Pencil className="h-3 w-3" strokeWidth={2.5} />
              </span>
            ) : null}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void handleAvatarChange(e)}
            tabIndex={-1}
          />
        </div>
        <button
          type="button"
          onClick={openPersonal}
          className="ios-press min-w-0 flex-1 text-left"
        >
          <p className="truncate text-[22px] font-bold tracking-tight text-white">{username}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[15px] text-[#8E8E93]">
            Voir mon profil
            <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
          </p>
          {avatarError ? (
            <p className="mt-1 text-[12px] leading-snug text-[#FF453A]">{avatarError}</p>
          ) : null}
        </button>
      </div>

      {!proDismissed && (
        <ProPassCard
          onTryFree={handleTryPro}
          onDismiss={() => {
            writeProPassDismissed()
            setProDismissed(true)
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#141416]/80">
        {menuSections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            {section.items.map((item, itemIdx) => (
              <div
                key={item.id}
                className={itemIdx < section.items.length - 1 ? 'border-b border-[#2C2C2E]' : ''}
              >
                <SettingsMenuRow
                  icon={item.icon}
                  label={item.label}
                  onClick={() => {
                    if (item.id === 'cameraHeartRate') {
                      onOpenCameraHeartRate?.()
                      return
                    }
                    if (item.id === 'personal') {
                      openPersonal()
                      return
                    }
                    if (item.id === 'privacy') {
                      openSecurity()
                      return
                    }
                    if (!isAuthenticated) {
                      onRequireAuth?.()
                      return
                    }
                    setSheet(item.id)
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {showSignOut && onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF453A]/30 bg-[#FF453A]/12 py-3.5 text-[15px] font-semibold text-[#FF6961]"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      )}

      <IosSheet
        open={sheet === 'payment'}
        onClose={() => setSheet(null)}
        title="Méthodes de paiement"
        subtitle="Pass Pro"
        leading={<CreditCard className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        <div className="space-y-4 pb-2">
          <ProPassCard onTryFree={handleTryPro} onDismiss={() => setSheet(null)} />
          <p className="text-center text-[12px] text-[#636366]">
            Paiement sécurisé · Annulation à tout moment
          </p>
        </div>
      </IosSheet>

      <IosSheet
        open={sheet === 'preferences'}
        onClose={() => setSheet(null)}
        title="Préférences"
        subtitle="Notifications & unités"
        leading={<Settings2 className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        <div className="space-y-4 pb-2">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-white">Sport principal</p>
            <DisciplinePicker
              value={disciplineId}
              onChange={(id) => {
                setDisciplineId(id)
                onDisciplineChange?.(getDiscipline(id).label)
              }}
              compact
            />
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[15px] font-semibold text-white">Notifications</p>
            <p className="mt-1 text-[13px] text-[#8E8E93]">
              Gère les rappels de séance dans l&apos;onglet Train → Agenda.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[15px] font-semibold text-white">Unités</p>
            <p className="mt-1 text-[13px] text-[#8E8E93]">Kilogrammes (kg) · Calories (kcal)</p>
          </div>
        </div>
      </IosSheet>
    </div>
  )
}
