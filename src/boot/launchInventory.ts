/**
 * Inventaire figé des opérations au lancement.
 * Toute récupération listée ici DOIT continuer à tourner (mêmes appels, même ordre).
 * Ce module ne déclenche rien : il documente et sert de preuve anti-régression.
 */
export const LAUNCH_OPERATIONS = [
  {
    id: 'secure-auth-storage',
    label: 'Restauration session (stockage auth chiffré)',
    files: ['src/main.tsx'],
    symbols: ['initSecureAuthStorage'],
  },
  {
    id: 'secure-auth-storage-impl',
    label: 'Implémentation stockage auth',
    files: ['src/services/secureAuthStorage.ts'],
    symbols: ['initSecureAuthStorage'],
  },
  {
    id: 'secure-local-store',
    label: 'Restauration données locales chiffrées',
    files: ['src/main.tsx'],
    symbols: ['initSecureLocalStore'],
  },
  {
    id: 'secure-local-store-impl',
    label: 'Implémentation store local',
    files: ['src/services/secureLocalStore.ts'],
    symbols: ['initSecureLocalStore'],
  },
  {
    id: 'session-restore',
    label: 'Restauration de session (Convex ou getSession)',
    files: ['src/context/AuthContext.tsx'],
    symbols: ['getConvexSessionUser', 'getSession'],
  },
  {
    id: 'user-profile',
    label: 'Profil utilisateur (ensure + fetch)',
    files: ['src/context/AuthContext.tsx'],
    symbols: ['ensureProfile', 'fetchProfile'],
  },
  {
    id: 'user-profile-service',
    label: 'Service profil (ensure + fetch)',
    files: ['src/services/authService.ts'],
    symbols: ['ensureProfile', 'fetchProfile'],
  },
  {
    id: 'discipline-settings',
    label: 'Objectifs / discipline / sport principal',
    files: ['src/context/AuthContext.tsx'],
    symbols: ['syncLocalDiscipline', 'setPrimarySport'],
  },
  {
    id: 'streak-subscription',
    label: 'Série quotidienne / droits de streak',
    files: ['src/context/AuthContext.tsx'],
    symbols: ['applyDailyLoginStreak'],
  },
  {
    id: 'streak-service',
    label: 'Service streak',
    files: ['src/services/streakService.ts'],
    symbols: ['applyDailyLoginStreak'],
  },
  {
    id: 'cloud-hydrate',
    label: 'Réconciliation distante (nutrition, train, sommeil, lobby, progression)',
    files: ['src/services/cloudBackup.ts'],
    symbols: ['hydrateCloudBackupForUser', 'pullCloudBackup', 'fetchRemotePayload'],
  },
  {
    id: 'cloud-hydrate-callsite',
    label: 'Appel hydrate au login',
    files: ['src/context/AuthContext.tsx'],
    symbols: ['hydrateCloudBackupForUser'],
  },
  {
    id: 'nutrition-local',
    label: 'Nutrition / hydratation locales',
    files: ['src/services/nutritionStorage.ts'],
    symbols: ['getCalorieProfile', 'getMealJournal'],
  },
  {
    id: 'training-local',
    label: 'Entraînements / séance active',
    files: ['src/services/trainingStorage.ts'],
    symbols: ['getTrainingState', 'ensureActiveWorkoutClock'],
  },
  {
    id: 'sleep-recovery',
    label: 'Récupération / sommeil',
    files: ['src/services/sleepStorage.ts'],
    symbols: ['getSleepLog'],
  },
  {
    id: 'profile-progress',
    label: 'Progression / XP locaux',
    files: ['src/services/profileStorage.ts'],
    symbols: ['getProfileProgress'],
  },
  {
    id: 'lobby-checkin',
    label: 'Check-in / spots locaux',
    files: ['src/services/lobbyStorage.ts'],
    symbols: ['getActiveCheckIn', 'getCustomGyms'],
  },
  {
    id: 'cloud-collect-local',
    label: 'Collecte locale pour réconciliation cloud',
    files: ['src/services/cloudBackup.ts'],
    symbols: [
      'getCalorieProfile',
      'getMealJournal',
      'getTrainingState',
      'getSleepLog',
      'getProfileProgress',
      'getActiveCheckIn',
      'getCustomGyms',
      'collectLocalBackup',
    ],
  },
  {
    id: 'background-streak',
    label: 'Retour premier plan — streak',
    files: ['src/context/AuthContext.tsx'],
    symbols: ['visibilitychange', 'applyDailyLoginStreak'],
  },
  {
    id: 'background-cloud-flush',
    label: 'Retour premier plan — flush cloud',
    files: ['src/services/cloudBackup.ts'],
    symbols: ['visibilitychange', 'flushCloudPush'],
  },
] as const

export type LaunchOperationId = (typeof LAUNCH_OPERATIONS)[number]['id']
