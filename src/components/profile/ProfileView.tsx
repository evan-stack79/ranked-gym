import { useEffect, useState } from 'react'
import { CloudBackupCard } from './CloudBackupCard'
import { SettingsScreen } from '../settings/SettingsScreen'
import { FullProfileScreen } from './FullProfileScreen'
import { useAuth } from '../../context/AuthContext'
import {
  disciplineFromLabel,
  getDiscipline,
  getStoredDisciplineId,
  type AppDisciplineId,
} from '../../data/disciplines'
import { resolveGhostModeEnabled } from '../../services/ghostModeStorage'
import {
  ProfileNavigationProvider,
  useProfileNavigation,
} from '../../navigation/profileNavigation'

function ProfileViewContent() {
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
  const { route, navigate, goBack } = useProfileNavigation()
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

  useEffect(() => {
    if (route === 'fullProfile' && (!isAuthenticated || !user)) {
      goBack()
    }
  }, [route, isAuthenticated, user, goBack])

  if (route === 'fullProfile') {
    if (!isAuthenticated || !user) {
      return null
    }
    return <FullProfileScreen onBack={goBack} />
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col gap-6 pb-4 ios-fade-up">
        <SettingsScreen
          username="Invité"
          isAuthenticated={false}
          onRequireAuth={() => requireAuth(() => undefined)}
          onViewProfile={() => requireAuth(() => navigate('fullProfile'))}
        />
        <CloudBackupCard />
      </div>
    )
  }

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
    <div className="flex flex-col gap-6 pb-4 ios-fade-up">
      <SettingsScreen
        username={username}
        avatarUrl={profile?.avatar_url}
        email={user.email}
        isAuthenticated
        profileDiscipline={profile?.discipline ?? discipline.label}
        ghostModeEnabled={ghostModeEnabled}
        ghostSaving={ghostSaving}
        userId={user.id}
        onViewProfile={() => navigate('fullProfile')}
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
  )
}

export function ProfileView() {
  return (
    <ProfileNavigationProvider>
      <ProfileViewContent />
    </ProfileNavigationProvider>
  )
}
