import { useCallback, useEffect, useState } from 'react'
import { CloudBackupCard } from './CloudBackupCard'
import { SettingsScreen } from '../settings/SettingsScreen'
import { PersonalInformationScreen } from '../settings/PersonalInformationScreen'
import { SecurityScreen } from '../settings/SecurityScreen'
import { CameraHeartRateScreen } from '../settings/CameraHeartRateScreen'
import { NeedToTalkScreen } from '../settings/NeedToTalkScreen'
import { BetaFeedbackScreen } from '../settings/BetaFeedbackScreen'
import { EnergyRecoveryInfo } from '../settings/EnergyRecoveryInfo'
import {
  HealthSituationsForm,
  healthSituationsFromProfile,
  type HealthSituationsValue,
} from '../settings/HealthSituationsForm'
import { FullProfileScreen } from './FullProfileScreen'
import { useAuth } from '../../context/AuthContext'
import {
  getCalorieProfile,
  saveCalorieProfile,
} from '../../services/nutritionStorage'
import { M_INFO_1 } from '../../content/safetyCopy'
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
import {
  OPEN_BETA_FEEDBACK_EVENT,
  consumeBetaFeedbackPendingOpen,
  setBetaFeedbackPrefillPage,
  type OpenBetaFeedbackDetail,
} from '../../services/betaFeedbackNav'
import { canOpenBetaFeedback } from '../../services/betaFeedbackAccess'
import { confirmSignOutClearingAvisQueue } from '../../services/avisBetaLogoutWarn'

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
  const [healthValue, setHealthValue] = useState<HealthSituationsValue>(() =>
    healthSituationsFromProfile(getCalorieProfile()),
  )

  useEffect(() => {
    if (isAuthenticated) {
      void refreshProfile()
    }
  }, [isAuthenticated, refreshProfile])

  useEffect(() => {
    const openFeedback = (page?: string) => {
      if (!canOpenBetaFeedback()) return
      if (page) setBetaFeedbackPrefillPage(page)
      if (!isAuthenticated) {
        requireAuth(() => navigate('giveFeedback'))
        return
      }
      navigate('giveFeedback')
    }

    if (consumeBetaFeedbackPendingOpen()) {
      openFeedback()
    }

    const onOpenFeedback = (event: Event) => {
      const detail = (event as CustomEvent<OpenBetaFeedbackDetail>).detail
      openFeedback(detail?.page?.trim())
    }
    window.addEventListener(OPEN_BETA_FEEDBACK_EVENT, onOpenFeedback)
    return () => window.removeEventListener(OPEN_BETA_FEEDBACK_EVENT, onOpenFeedback)
  }, [isAuthenticated, navigate, requireAuth])

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

  useEffect(() => {
    if (route === 'healthSituations') {
      setHealthValue(healthSituationsFromProfile(getCalorieProfile()))
    }
  }, [route])

  const handleGhostModeChange = async (enabled: boolean) => {
    setGhostSaving(true)
    try {
      await updateGhostMode(enabled)
    } finally {
      setGhostSaving(false)
    }
  }

  const handleHealthChange = useCallback((next: HealthSituationsValue) => {
    setHealthValue(next)
    const current = getCalorieProfile()
    saveCalorieProfile({
      ...current,
      ...next,
      healthAnswerUpdatedAt: Date.now(),
    })
  }, [])

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
          if (!confirmSignOutClearingAvisQueue()) return
          void signOut()
        }}
      />
    )
  }

  if (route === 'cameraHeartRate') {
    return <CameraHeartRateScreen onBack={goBack} />
  }

  if (route === 'needToTalk') {
    return <NeedToTalkScreen onBack={goBack} />
  }

  if (route === 'giveFeedback') {
    if (!canOpenBetaFeedback()) {
      goBack()
      return null
    }
    if (!isAuthenticated || !user) {
      requireAuth(() => navigate('giveFeedback'))
      goBack()
      return null
    }
    return (
      <BetaFeedbackScreen
        onBack={goBack}
        onOpenNeedToTalk={() => navigate('needToTalk')}
        onOpenProfile={() => navigate('personalInfo')}
      />
    )
  }

  if (route === 'energyInfo') {
    return (
      <section className="ios-fade-up space-y-4 pb-8">
        <button
          type="button"
          onClick={goBack}
          className="ios-press rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] font-semibold text-[#AEAEB2]"
        >
          Retour
        </button>
        <EnergyRecoveryInfo />
      </section>
    )
  }

  if (route === 'healthSituations') {
    return (
      <section className="ios-fade-up space-y-4 pb-8">
        <button
          type="button"
          onClick={goBack}
          className="ios-press rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] font-semibold text-[#AEAEB2]"
        >
          Retour
        </button>
        <h1 className="text-[28px] font-bold tracking-tight text-white">Situations de santé</h1>
        <HealthSituationsForm
          value={healthValue}
          onChange={handleHealthChange}
          onOpenNeedToTalk={() => navigate('needToTalk')}
          sex={getCalorieProfile().sex}
        />
        {healthValue.healthAnswer === 'prefer_not' ? (
          <p className="text-[12px] text-[#8E8E93]">{M_INFO_1}</p>
        ) : null}
      </section>
    )
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
          onOpenNeedToTalk={() => navigate('needToTalk')}
          onOpenHealthSituations={() => navigate('healthSituations')}
          onOpenEnergyInfo={() => navigate('energyInfo')}
          onOpenGiveFeedback={() => requireAuth(() => navigate('giveFeedback'))}
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
        onOpenNeedToTalk={() => navigate('needToTalk')}
        onOpenHealthSituations={() => navigate('healthSituations')}
        onOpenEnergyInfo={() => navigate('energyInfo')}
        onOpenGiveFeedback={() => navigate('giveFeedback')}
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
          if (!confirmSignOutClearingAvisQueue()) return
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
