import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { AppLayout } from '../../src/components/layout/AppLayout'
import { AuthStateProvider } from '../../src/context/AuthContext'
import { RestTimerProvider } from '../../src/context/RestTimerContext'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../../src/test/authFixtureValue'
import type { TabId } from '../../src/types'
import { AccueilEauWidget } from './screens/AccueilEauWidget'
import { AlimentationGlisser } from './screens/AlimentationGlisser'
import { MaBouteillePro } from './screens/MaBouteillePro'

const FIXED_ISO = '2026-10-07T18:30:00.000'
const FIXED_MS = new Date(FIXED_ISO).getTime()
const TODAY = '2026-10-07'

document.documentElement.style.setProperty('--app-safe-area-top', '47px')
document.documentElement.style.setProperty('--app-safe-area-bottom', '34px')
document.documentElement.dataset.bottomNavPreview = 'floating-pill'
document.documentElement.dataset.mockupHydratation = 'v2'

type ScreenId = 'accueil' | 'alimentation' | 'ma-bouteille'

function resolveScreen(): ScreenId {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('screen') ?? 'accueil'
  if (raw === 'alimentation' || raw === 'ma-bouteille' || raw === 'accueil') return raw
  return 'accueil'
}

function MockupShell() {
  const screen = useMemo(() => resolveScreen(), [])
  const activeTab: TabId = screen === 'accueil' ? 'home' : 'nutrition'

  const authValue = useMemo(
    () =>
      buildAuthContextValue({
        user: FIXTURE_AUTH_USER,
        profile: {
          id: 'harness-local',
          pseudo: 'Alex',
          level: 4,
          xp: 420,
          rank: 'Silver',
          discipline: 'musculation',
          custom_spots: [],
          active_checkin: null,
          current_streak: 4,
          last_login_date: TODAY,
          avatar_url: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: FIXED_ISO,
        },
        isAuthenticated: true,
        isLoading: false,
      }),
    [],
  )

  return (
    <AuthStateProvider value={authValue}>
      <RestTimerProvider>
        <div
          data-harness-ready="1"
          data-mockup-hydratation-v2="1"
          data-mockup-active-screen={screen}
          data-fixed-now={FIXED_ISO}
          data-fixed-ms={String(FIXED_MS)}
        >
          <AppLayout
            activeTab={activeTab}
            onTabChange={() => undefined}
            onStartTraining={() => undefined}
            hasActiveWorkout={false}
          >
            {screen === 'accueil' ? <AccueilEauWidget /> : null}
            {screen === 'alimentation' ? <AlimentationGlisser /> : null}
            {screen === 'ma-bouteille' ? <MaBouteillePro /> : null}
          </AppLayout>
        </div>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MockupShell />
  </StrictMode>,
)
