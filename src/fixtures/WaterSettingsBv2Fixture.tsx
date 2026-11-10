/**
 * Fixture capture — Réglages Eau B v2 (4 tuiles + colonne|cloche compactes).
 * Route: /water-settings-bv2-fixture
 */
import { useEffect, useState } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { IosSheet } from '../components/ui/IosSheet'
import { WaterContainerCarousel } from '../components/hydration/WaterContainerCarousel'
import { WaterGoalColumn } from '../components/hydration/WaterGoalColumn'
import { WaterReminderBell } from '../components/hydration/WaterReminderBell'
import { WaterReminderScheduleSheet } from '../components/hydration/WaterReminderScheduleSheet'
import type { HydrationMode } from '../shared/hydration'
import {
  applyHydrationSettingsLocal,
  onHydrationAccountChanged,
} from '../services/hydration/hydrationService'
import { bottleScreenLabelForMode } from '../utils/hydrationModeDisplay'

function WaterSettingsBv2FixtureShell() {
  const [mode, setMode] = useState<HydrationMode>('classic_2l')
  const [goalMl, setGoalMl] = useState(2000)
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [times, setTimes] = useState<string[]>(['10:00', '14:00', '18:00'])
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [goalDragging, setGoalDragging] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onHydrationAccountChanged('fixture-user')
    applyHydrationSettingsLocal({ mode: 'classic_2l', goalMl: 2000 }, 'fixture-user')
    setReady(true)
  }, [])

  const selectMode = (next: HydrationMode) => {
    setMode(next)
    applyHydrationSettingsLocal({ mode: next }, 'fixture-user')
  }

  if (!ready) return null

  return (
    <div
      className="relative mx-auto min-h-[100dvh] w-full max-w-[390px] bg-black"
      data-water-settings-bv2-fixture="1"
    >
      <div className="px-4 pb-3 pt-10" data-capture="eau-card">
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#141416]/92 px-3.5 py-3"
          data-testid="nutrition-eau-card"
          data-hydration-mode={mode}
        >
          <p className="text-[14px] font-semibold text-white">Eau</p>
          <p className="mt-0.5 text-[15px] font-semibold text-white">0,80&nbsp;/&nbsp;2&nbsp;L</p>
          <p className="mt-0.5 text-[13px] text-[#ACB4BA]" data-hydration-bottle-label>
            {bottleScreenLabelForMode(mode)}
          </p>
        </div>
      </div>

      <IosSheet
        open
        onClose={() => undefined}
        title="Eau"
        dismissible={!goalDragging}
        scrollLocked={goalDragging}
      >
        <div className="space-y-5 pb-8" data-hydration-settings-bv2>
          <WaterContainerCarousel
            mode={mode}
            proActive={false}
            onSelect={selectMode}
            onRequestPro={() => undefined}
          />
          <div
            className="mx-auto flex w-fit max-w-full items-start justify-center gap-5"
            data-hydration-goal-bell-row
          >
            <WaterGoalColumn
              valueMl={goalMl}
              onChange={setGoalMl}
              onDraggingChange={setGoalDragging}
            />
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
