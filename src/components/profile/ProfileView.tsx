import { useEffect, useState } from 'react'
import { CloudBackupCard } from './CloudBackupCard'
import { SettingsScreen } from '../settings/SettingsScreen'
import { PersonalInformationScreen } from '../settings/PersonalInformationScreen'
import { SecurityScreen } from '../settings/SecurityScreen'
import { CameraHeartRateScreen } from '../settings/CameraHeartRateScreen'
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
    const needsAuth =
      route === 'fullProfile' || route === 'personalInfo' || route === 'security'
    if (needsAuth && (!isAuthenticated || !user)) {
      goBack()
    }
  }, [route, isAuthenticated, user, goBack])

  const handleGhostModeChange = async (enabled: boolean) => {
    setGhostSaving(true)
    try {
      await updateGhostMode(enabled)
    } finally {
      setGhostSaving(false)
    }
  }

  if (route === 'personalInfo') {
    if (!isAuthenticated || !user) return null
    return (
      <PersonalInformationScreen
        onBack={goBack}
        onOpenFullProfile={() => navigate('fullProfile')}
      />
    )
  }

  if (route === 'security') {
    if (!isAuthenticated || !user) return null
    return (
      <SecurityScreen
        onBack={goBack}
        ghostModeEnabled={resolveGhostModeEnabled(profile)}
        ghostSaving={ghostSaving}
        onGhostModeChange={(enabled) => {
          void handleGhostModeChange(enabled)
        }}
        onSignOut={() => {
          void signOut()
        }}
      />
    )
  }


  if (route === 'cameraHeartRate') {
    return <CameraHeartRateScreen onBack={goBack} />
  }

  if (route === 'fullProfile') {
    if (!isAuthenticated || !user) return null
    return <FullProfileScreen onBack={goBack} />
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col gap-6 pb-4 ios-fade-up">
        <SettingsScreen
          username="Invité"
          isAuthenticated={false}
          onRequireAuth={() => requireAuth(() => undefined)}
          onViewProfile={() => requireAuth(() => navigate('personalInfo'))}
          onOpenPersonalInfo={() => requireAuth(() => navigate('personalInfo'))}
          onOpenSecurity={() => requireAuth(() => navigate('security'))}
          onOpenCameraHeartRate={() => navigate('cameraHeartRate')}
        />
        <CloudBackupCard />
      </div>
    )
  }

  const username = profile?.pseudo || user.displayName
  const discipline = getDiscipline(disciplineId)

  return (
    <div className="flex flex-col gap-6 pb-4 ios-fade-up">
      <SettingsScreen
        username={username}
        avatarUrl={profile?.avatar_url}
        email={user.email}
        isAuthenticated
        profileDiscipline={profile?.discipline ?? discipline.label}
        userId={user.id}
        onViewProfile={() => navigate('personalInfo')}
        onOpenPersonalInfo={() => navigate('personalInfo')}
        onOpenSecurity={() => navigate('security')}
        onOpenCameraHeartRate={() => navigate('cameraHeartRate')}
        onRequireAuth={() => requireAuth(() => undefined)}
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
