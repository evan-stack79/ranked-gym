import { useEffect, useState } from 'react'
import { LogOut, Settings } from 'lucide-react'
import { FighterHeader } from './FighterHeader'
import { RankShowcase } from './RankShowcase'
import { ProfileXPBar } from './ProfileXPBar'
import { StatGrid } from './StatGrid'
import { BadgeShowcase } from './BadgeShowcase'
import { CloudBackupCard } from './CloudBackupCard'
import { GhostModeToggle } from './GhostModeToggle'
import { DisciplinePicker } from '../discipline/DisciplinePicker'
import { resolveGhostModeEnabled } from '../../services/ghostModeStorage'
import { IosSheet } from '../ui/IosSheet'
import { useAuth } from '../../context/AuthContext'
import { getRankFromLevel } from '../../utils/rank'
import {
  disciplineFromLabel,
  getDiscipline,
  getStoredDisciplineId,
  type AppDisciplineId,
} from '../../data/disciplines'

const XP_PER_LEVEL = 1000

export function ProfileView() {
  const {
    user,
    profile,
    signOut,
    isAuthenticated,
    requireAuth,
    refreshProfile,
    patchProfile,
    updateDiscipline,
    updateGhostMode,
  } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ghostSaving, setGhostSaving] = useState(false)
  const [disciplineId, setDisciplineId] = useState<AppDisciplineId>(() =>
    disciplineFromLabel(profile?.discipline) || getStoredDisciplineId(),
  )

  useEffect(() => {
    if (isAuthenticated) {
      void refreshProfile()
    }
  }, [isAuthenticated, refreshProfile])

  useEffect(() => {
    if (profile?.discipline) {
      setDisciplineId(disciplineFromLabel(profile.discipline))
    }
  }, [profile?.discipline])

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col gap-6 py-12 ios-fade-up">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-[17px] font-semibold text-white">Profil verrouillé</p>
          <p className="max-w-xs text-[15px] text-[#8E8E93]">
            Connecte-toi pour voir ton rank, ton sport et sauvegarder ta progression.
          </p>
          <button
            type="button"
            onClick={() => requireAuth(() => undefined)}
            className="btn-brand ios-press rounded-2xl border border-white/15 px-6 py-3.5 text-[15px] font-semibold text-white"
          >
            Créer mon profil
          </button>
        </div>
        <CloudBackupCard />
      </div>
    )
  }

  const level = profile?.level ?? 1
  const currentXp = profile?.xp ?? 0
  const rank = getRankFromLevel(level)
  const username = profile?.pseudo || user.displayName
  const discipline = getDiscipline(disciplineId)
  const ghostModeEnabled = resolveGhostModeEnabled(profile)

  const handleGhostModeChange = async (enabled: boolean) => {
    setGhostSaving(true)
    try {
      await updateGhostMode(enabled)
    } finally {
      setGhostSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-4">
      <div className="ios-fade-up">
        <FighterHeader
          username={username}
          title={rank.title}
          level={level}
          rank={profile?.rank ?? rank.tier}
          email={user.email}
          provider={user.provider}
          disciplineLabel={discipline.label}
          disciplineAccent={discipline.accent}
          avatarUrl={profile?.avatar_url}
          userId={user.id}
          onAvatarUpdated={(url) => {
            patchProfile({ avatar_url: url })
            void refreshProfile()
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>
      <div className="ios-fade-up ios-fade-up-delay-1">
        <RankShowcase rank={rank} level={level} />
      </div>
      <div className="ios-fade-up ios-fade-up-delay-2">
        <ProfileXPBar
          level={level}
          currentXp={currentXp % XP_PER_LEVEL}
          xpToNextLevel={XP_PER_LEVEL}
        />
      </div>
      <div className="ios-fade-up ios-fade-up-delay-3">
        <CloudBackupCard />
      </div>
      <div className="ios-fade-up" style={{ animationDelay: '0.15s' }}>
        <GhostModeToggle
          enabled={ghostModeEnabled}
          onChange={(enabled) => {
            void handleGhostModeChange(enabled)
          }}
          disabled={ghostSaving}
        />
      </div>
      <div className="ios-fade-up" style={{ animationDelay: '0.18s' }}>
        <StatGrid />
      </div>
      <div className="ios-fade-up" style={{ animationDelay: '0.24s' }}>
        <BadgeShowcase />
      </div>

      <IosSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Paramètres"
        subtitle="Compte, sport & session"
        leading={<Settings className="mt-0.5 h-5 w-5 text-[#8E8E93]" />}
      >
        <div className="space-y-4 pb-3">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[13px] text-[#8E8E93]">Compte connecté</p>
            <p className="mt-1 font-semibold text-white">{username}</p>
            <p className="mt-0.5 break-all text-[13px] text-[#AEAEB2]">{user.email}</p>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-[#636366]">
              {profile?.rank ?? rank.tier} · Niv. {level}
            </p>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-white">Sport principal</p>
            <p className="mb-2 text-[12px] text-[#8E8E93]">
              Adapte Train, Lobby et ton badge profil.
            </p>
            <DisciplinePicker
              value={disciplineId}
              onChange={(id) => {
                setDisciplineId(id)
                void updateDiscipline(getDiscipline(id).label)
              }}
              compact
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false)
              void signOut()
            }}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF453A]/35 bg-[#FF453A]/18 py-4 text-[16px] font-semibold text-[#FF453A]"
          >
            <LogOut className="h-5 w-5" />
            Se déconnecter
          </button>
        </div>
      </IosSheet>
    </div>
  )
}
