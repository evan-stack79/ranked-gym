import { useEffect, useRef, useState } from 'react'
import { RankShowcase } from './RankShowcase'
import { ProfileXPBar } from './ProfileXPBar'
import { StatGrid } from './StatGrid'
import { BadgeShowcase } from './BadgeShowcase'
import { CloudBackupCard } from './CloudBackupCard'
import { SettingsScreen } from '../settings/SettingsScreen'
import { useAuth } from '../../context/AuthContext'
import { getRankFromLevel } from '../../utils/rank'
import {
  disciplineFromLabel,
  getDiscipline,
  getStoredDisciplineId,
  type AppDisciplineId,
} from '../../data/disciplines'
import { resolveGhostModeEnabled } from '../../services/ghostModeStorage'

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
  const profileSectionRef = useRef<HTMLDivElement>(null)
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

  const scrollToProfile = () => {
    profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col gap-6 pb-4 ios-fade-up">
        <SettingsScreen
          username="Invité"
          isAuthenticated={false}
          onRequireAuth={() => requireAuth(() => undefined)}
          onViewProfile={() => requireAuth(() => undefined)}
        />
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
        <SettingsScreen
          username={username}
          avatarUrl={profile?.avatar_url}
          email={user.email}
          isAuthenticated
          profileDiscipline={profile?.discipline ?? discipline.label}
          ghostModeEnabled={ghostModeEnabled}
          ghostSaving={ghostSaving}
          userId={user.id}
          onViewProfile={scrollToProfile}
          onRequireAuth={() => requireAuth(() => undefined)}
          onGhostModeChange={(enabled) => {
            void handleGhostModeChange(enabled)
          }}
          onDisciplineChange={(label) => {
            setDisciplineId(disciplineFromLabel(label))
            void updateDiscipline(label)
          }}
          onAvatarUpdated={(url) => {
            patchProfile({ avatar_url: url })
            void refreshProfile()
          }}
          onSignOut={() => {
            void signOut()
          }}
          showSignOut
        />
      </div>

      <div ref={profileSectionRef} className="flex scroll-mt-6 flex-col gap-8">
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
        <div className="ios-fade-up" style={{ animationDelay: '0.18s' }}>
          <StatGrid />
        </div>
        <div className="ios-fade-up" style={{ animationDelay: '0.24s' }}>
          <BadgeShowcase />
        </div>
      </div>
    </div>
  )
}
