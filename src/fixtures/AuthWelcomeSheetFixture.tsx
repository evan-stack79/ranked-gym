import { useMemo, useState } from 'react'
import { WelcomeScreen } from '../components/auth/WelcomeScreen'
import { AuthBottomSheet } from '../components/auth/AuthBottomSheet'
import { AuthStateProvider } from '../context/AuthContext'
import { buildAuthContextValue } from '../test/authFixtureValue'

/** Welcome + feuille login (erreurs / oubli) sans session réelle. */
export function AuthWelcomeSheetFixture() {
  const params = new URLSearchParams(window.location.search)
  const errorKey = params.get('error')
  const authError =
    errorKey === 'credentials'
      ? 'Email ou mot de passe incorrect.'
      : errorKey === 'service'
        ? 'Service indisponible. Réessaie plus tard.'
        : errorKey === 'expired'
          ? 'Session expirée. Reconnecte-toi.'
          : errorKey === 'offline'
            ? 'Connexion réseau impossible. Vérifie ta connexion puis réessaie.'
          : errorKey === 'signup-disabled'
            ? 'Les inscriptions sont fermées pour le moment. Contacte le support Ranked Gym.'
            : errorKey === 'throttle'
              ? 'Trop de tentatives. Réessaie dans quelques minutes.'
              : null
  const infoKey = params.get('info')
  const authInfo =
    infoKey === 'manual-reset'
      ? 'Réinitialisation par email indisponible pour le moment. Contacte le support pour recevoir un lien.'
      : null
  const [isAuthOpen, setAuthOpen] = useState(params.get('open') !== '0')

  const value = useMemo(
    () =>
      buildAuthContextValue({
        isAuthenticated: false,
        isLoading: false,
        isAuthOpen,
        authError,
        authInfo,
        openAuth: () => setAuthOpen(true),
        closeAuth: () => setAuthOpen(false),
      }),
    [isAuthOpen, authError, authInfo],
  )

  return (
    <AuthStateProvider value={value}>
      <WelcomeScreen onConnect={() => setAuthOpen(true)} />
      <AuthBottomSheet />
    </AuthStateProvider>
  )
}
