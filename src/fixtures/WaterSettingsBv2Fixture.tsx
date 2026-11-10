/**
 * Fixture capture — Réglages Eau B v2 (colonne + cloche).
 * Route: /water-settings-bv2-fixture
 */
import { useState } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { IosSheet } from '../components/ui/IosSheet'
import { WaterContainerCarousel } from '../components/hydration/WaterContainerCarousel'
import { WaterGoalColumn } from '../components/hydration/WaterGoalColumn'
import { WaterReminderBell } from '../components/hydration/WaterReminderBell'
import { WaterReminderScheduleSheet } from '../components/hydration/WaterReminderScheduleSheet'
import type { HydrationMode } from '../shared/hydration'

function WaterSettingsBv2FixtureShell() {
  const [mode, setMode] = useState<HydrationMode>('classic_2l')
  const [goalMl, setGoalMl] = useState(2000)
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [times, setTimes] = useState<string[]>(['10:00', '14:00', '18:00'])
  const [scheduleOpen, setScheduleOpen] = useState(false)

  return (
    <div
      className="relative mx-auto min-h-[100dvh] w-full max-w-[390px] bg-black"
      data-water-settings-bv2-fixture="1"
    >
      <IosSheet open onClose={() => undefined} title="Eau">
        <div className="space-y-5 pb-8" data-hydration-settings-bv2>
          <WaterContainerCarousel
            mode={mode}
            proActive={false}
            onSelect={setMode}
            onRequestPro={() => undefined}
          />
          <div className="flex items-start gap-3">
            <WaterGoalColumn valueMl={goalMl} onChange={setGoalMl} />
            <WaterReminderBell
              enabled={remindersEnabled}
              times={times}
              goalReachedToday={false}
              onChange={(next) => {
                setRemindersEnabled(next.enabled)
                setTimes(next.times)
              }}
              onOpenSchedule={() => setScheduleOpen(true)}
            />
          </div>
        </div>
      </IosSheet>
      <WaterReminderScheduleSheet
        open={scheduleOpen}
        times={times}
        onClose={() => setScheduleOpen(false)}
        onSave={(next) => {
          setTimes(next)
          setRemindersEnabled(true)
        }}
      />
    </div>
  )
}

export function WaterSettingsBv2Fixture() {
  return (
    <AuthProvider>
      <WaterSettingsBv2FixtureShell />
    </AuthProvider>
  )
}
