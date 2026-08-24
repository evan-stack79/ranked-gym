import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ProfileRoute = 'settings' | 'personalInfo' | 'security' | 'fullProfile'

interface ProfileNavigationContextValue {
  route: ProfileRoute
  navigate: (route: ProfileRoute) => void
  goBack: () => void
}

const ProfileNavigationContext = createContext<ProfileNavigationContextValue | null>(null)

export function ProfileNavigationProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<ProfileRoute>('settings')

  const navigate = useCallback((next: ProfileRoute) => {
    setRoute(next)
  }, [])

  const goBack = useCallback(() => {
    setRoute('settings')
  }, [])

  const value = useMemo(
    () => ({ route, navigate, goBack }),
    [route, navigate, goBack],
  )

  return (
    <ProfileNavigationContext.Provider value={value}>
      {children}
    </ProfileNavigationContext.Provider>
  )
}

export function useProfileNavigation(): ProfileNavigationContextValue {
  const ctx = useContext(ProfileNavigationContext)
  if (!ctx) {
    throw new Error('useProfileNavigation must be used within ProfileNavigationProvider')
  }
  return ctx
}
