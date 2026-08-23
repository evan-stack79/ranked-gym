import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  CreditCard,
  LogOut,
  Pencil,
  Settings2,
  Shield,
  UserRound,
} from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { uploadUserAvatar } from '../../services/avatarService'
import { IosSheet } from '../ui/IosSheet'
import { GhostModeToggle } from '../profile/GhostModeToggle'
import { DisciplinePicker } from '../discipline/DisciplinePicker'
import { ProPassCard } from './ProPassCard'
import { SettingsMenuRow } from './SettingsMenuRow'
import {
  disciplineFromLabel,
  getDiscipline,
  type AppDisciplineId,
} from '../../data/disciplines'
import {
  getLocalGhostModeEnabled,
  resolveGhostModeEnabled,
  setLocalGhostModeEnabled,
} from '../../services/ghostModeStorage'

const PRO_PASS_DISMISSED_KEY = 'ranked-gym:pro-pass-dismissed'

export type SettingsSheet = 'personal' | 'privacy' | 'payment' | 'preferences' | null

interface SettingsScreenProps {
  username: string
  avatarUrl?: string | null
  email?: string
  isAuthenticated: boolean
  profileDiscipline?: string
  ghostModeEnabled?: boolean
  ghostSaving?: boolean
  onViewProfile?: () => void
  onRequireAuth?: () => void
  onTryPro?: () => void
  onGhostModeChange?: (enabled: boolean) => void
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
  email,
  isAuthenticated,
  profileDiscipline,
  ghostModeEnabled: ghostProp,
  ghostSaving = false,
  onViewProfile,
  onRequireAuth,
  onTryPro,
  onGhostModeChange,
  onDisciplineChange,
  onSignOut,
  showSignOut = false,
  userId,
  onAvatarUpdated,
}: SettingsScreenProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [proDismissed, setProDismissed] = useState(readProPassDismissed)
  const [sheet, setSheet] = useState<SettingsSheet>(null)
  const [localGhost, setLocalGhost] = useState(getLocalGhostModeEnabled)
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

  const ghostEnabled = isAuthenticated
    ? Boolean(ghostProp)
    : localGhost

  const handleGhostChange = (enabled: boolean) => {
    if (isAuthenticated && onGhostModeChange) {
      onGhostModeChange(enabled)
      return
    }
    setLocalGhostModeEnabled(enabled)
    setLocalGhost(enabled)
    window.dispatchEvent(new Event('ranked-gym:ghost-mode-changed'))
  }

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

  const menuSections: Array<{
    items: Array<{ id: SettingsSheet; icon: typeof UserRound; label: string }>
  }> = [
    {
      items: [
        { id: 'personal', icon: UserRound, label: 'Informations personnelles' },
        { id: 'privacy', icon: Shield, label: 'Sécurité & Confidentialité' },
        { id: 'payment', icon: CreditCard, label: 'Méthodes de paiement' },
        { id: 'preferences', icon: Settings2, label: 'Préférences' },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex w-full items-center gap-4 rounded-2xl px-1 py-1">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={canEditAvatar ? openAvatarPicker : onViewProfile}
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
            onChange={handleAvatarChange}
            tabIndex={-1}
          />
        </div>
        <button
          type="button"
          onClick={onViewProfile}
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
                    if (!isAuthenticated && item.id !== 'privacy') {
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
        open={sheet === 'personal'}
        onClose={() => setSheet(null)}
        title="Informations personnelles"
        subtitle="Compte & identité"
        leading={<UserRound className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        <div className="space-y-4 pb-2">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[13px] text-[#8E8E93]">Pseudo</p>
            <p className="mt-1 text-[17px] font-semibold text-white">{username}</p>
            {email && (
              <>
                <p className="mt-4 text-[13px] text-[#8E8E93]">Email</p>
                <p className="mt-1 break-all text-[15px] text-[#EBEBF5]">{email}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSheet(null)
              onViewProfile?.()
            }}
            className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
          >
            Voir mon profil complet
          </button>
        </div>
      </IosSheet>

      <IosSheet
        open={sheet === 'privacy'}
        onClose={() => setSheet(null)}
        title="Sécurité & Confidentialité"
        subtitle="Mode Furtif & données"
        leading={<Shield className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        <div className="space-y-4 pb-2">
          <GhostModeToggle
            enabled={ghostEnabled}
            onChange={handleGhostChange}
            disabled={ghostSaving}
          />
          <p className="px-1 text-[13px] leading-relaxed text-[#8E8E93]">
            Le Mode Furtif masque ta localisation et ton identité. Tes données d&apos;entraînement
            restent strictement privées et cryptées.
          </p>
        </div>
      </IosSheet>

      <IosSheet
        open={sheet === 'payment'}
        onClose={() => setSheet(null)}
        title="Méthodes de paiement"
        subtitle="Pass Pro"
        leading={<CreditCard className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        <div className="space-y-4 pb-2">
          <ProPassCard
            onTryFree={handleTryPro}
            onDismiss={() => setSheet(null)}
          />
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

export { resolveGhostModeEnabled }
