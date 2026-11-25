/**
 * Fixture QA — Mon créneau dans AppLayout réel (barre marque / Tab Bar).
 * Route : /creneau-layout-fixture?bleed=0|1&state=principal|empty
 *   bleed=0 → cadre actuel (barre logo + max-w + marges) — « avant »
 *   bleed=1 → plein écran (contentFullBleed) — « après »
 */
import { useEffect, type ReactNode } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { CreneauV9Screen } from '../components/training/creneau/CreneauV9Screen'
import { AuthStateProvider } from '../context/AuthContext'
import { RestTimerProvider, useRestTimerContext } from '../context/RestTimerContext'
import { CRENEAU_PHRASES } from '../creneau/constants'
import { buildAuthContextValue } from '../test/authFixtureValue'
import hero06 from '../assets/photos/creneau/v9/hero-06.jpg'

function BleedSync({ bleed }: { bleed: boolean }) {
  const { setContentFullBleed } = useRestTimerContext()
  useEffect(() => {
    setContentFullBleed(bleed)
    return () => setContentFullBleed(false)
  }, [bleed, setContentFullBleed])
  return null
}

function Screen({ empty }: { empty: boolean }) {
  if (empty) {
    return (
      <CreneauV9Screen
        stateId="empty"
        heroSrc={hero06}
        eyebrow="Ce soir"
        giant="—"
        line1="Aucun créneau pour l’instant."
        line2={CRENEAU_PHRASES.minorEveningHelp}
        primaryLabel="Changer de salle"
        onPrimary={() => undefined}
        secondaryLabel={null}
        onBack={() => undefined}
      />
    )
  }
  return (
    <CreneauV9Screen
      stateId="principal"
      heroSrc={hero06}
      eyebrow="Pars à"
      giant="17:30"
      line1="Salle de la gare · 15 min à pied"
      line2="Le soleil se couche à 16:55."
      primaryLabel={CRENEAU_PHRASES.goButton}
      onPrimary={() => undefined}
      secondaryLabel="Autre heure"
      onSecondary={() => undefined}
      onBack={() => undefined}
    />
  )
}

function Shell({ children, bleed }: { children: ReactNode; bleed: boolean }) {
  return (
    <AuthStateProvider value={buildAuthContextValue()}>
      <RestTimerProvider>
        <BleedSync bleed={bleed} />
        <AppLayout activeTab="training" onTabChange={() => undefined} hasActiveWorkout={false}>
          <div className="train-view flex flex-col gap-0" style={{ paddingBottom: 0 }} data-train-panel="creneau">
            {children}
          </div>
        </AppLayout>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

export function CreneauLayoutFixture() {
  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const bleed = params?.get('bleed') !== '0'
  const empty = params?.get('state') === 'empty'

  return (
    <div data-creneau-layout-fixture="1" data-bleed={bleed ? '1' : '0'} data-state={empty ? 'empty' : 'principal'}>
      <Shell bleed={bleed}>
        <Screen empty={empty} />
      </Shell>
    </div>
  )
}
