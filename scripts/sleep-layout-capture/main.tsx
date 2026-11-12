import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { AppLayout } from '../../src/components/layout/AppLayout'
import { SleepView } from '../../src/components/home/SleepView'
import { AuthStateProvider } from '../../src/context/AuthContext'
import { RestTimerProvider } from '../../src/context/RestTimerContext'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../../src/test/authFixtureValue'
import { markMorningPromptShown, saveSleepSchedule } from '../../src/services/sleepStorage'
import { saveSleepAlarmSettings } from '../../src/services/sleepAlarmStorage'
import { todayDateKey } from '../../src/utils/sleepTimeFormat'
import type { TabId } from '../../src/types'

saveSleepSchedule({ bedtime: '23:00', waketime: '07:00' })
// Empêche la modal « Ce matin » de couvrir la page pendant les captures.
markMorningPromptShown(todayDateKey())
saveSleepAlarmSettings({
  enabled: false,
  timeHm: '07:00',
  days: [1, 2, 3, 4, 5, 6, 7],
  label: 'Lever',
  soundId: 'petits_oiseaux',
  snoozeEnabled: true,
  snoozeMinutes: 9,
  alarmKitId: null,
})

function Harness() {
  const [tab, setTab] = useState<TabId>('sleep')
  const auth = useMemo(() => buildAuthContextValue({ user: FIXTURE_AUTH_USER }), [])
  return (
    <AuthStateProvider value={auth}>
      <RestTimerProvider>
        <div data-harness-ready data-harness="sleep-layout">
          <AppLayout activeTab={tab} onTabChange={setTab} hasActiveWorkout={false}>
            {tab === 'sleep' ? (
              <SleepView />
            ) : (
              <div className="py-8 text-white" data-other-tab={tab}>
                Tab {tab}
              </div>
            )}
          </AppLayout>
        </div>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
