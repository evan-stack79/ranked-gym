/**
 * Fixture QA — Train v2 dans AppLayout (plein écran hub).
 * Route : /train-v2-fixture?state=normal|empty
 */
import { useEffect } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { TrainV2Hub } from '../components/training/TrainV2Hub'
import { AuthStateProvider } from '../context/AuthContext'
import { RestTimerProvider, useRestTimerContext } from '../context/RestTimerContext'
import { buildAuthContextValue } from '../test/authFixtureValue'
import type {
  RecentSessionItem,
  TodayHubCard,
  WeekDayCell,
  WeeklySummary,
} from '../utils/trainHub'

function BleedOn() {
  const { setContentFullBleed } = useRestTimerContext()
  useEffect(() => {
    setContentFullBleed(true)
    return () => setContentFullBleed(false)
  }, [setContentFullBleed])
  return null
}

const WEEK: WeekDayCell[] = [
  { dateKey: '2026-11-23', weekday: 1, shortLabel: 'L', dayNumber: 23, isToday: false, hasSession: true, accessibleLabel: 'lundi' },
  { dateKey: '2026-11-24', weekday: 2, shortLabel: 'M', dayNumber: 24, isToday: false, hasSession: true, accessibleLabel: 'mardi' },
  { dateKey: '2026-11-25', weekday: 3, shortLabel: 'M', dayNumber: 25, isToday: true, hasSession: false, accessibleLabel: 'mercredi' },
  { dateKey: '2026-11-26', weekday: 4, shortLabel: 'J', dayNumber: 26, isToday: false, hasSession: false, accessibleLabel: 'jeudi' },
  { dateKey: '2026-11-27', weekday: 5, shortLabel: 'V', dayNumber: 27, isToday: false, hasSession: false, accessibleLabel: 'vendredi' },
  { dateKey: '2026-11-28', weekday: 6, shortLabel: 'S', dayNumber: 28, isToday: false, hasSession: false, accessibleLabel: 'samedi' },
  { dateKey: '2026-11-29', weekday: 0, shortLabel: 'D', dayNumber: 29, isToday: false, hasSession: false, accessibleLabel: 'dimanche' },
]

const TODAY_OK: TodayHubCard = {
  cta: 'start',
  title: 'Upper',
  sportLabel: 'Musculation',
  summaryLine: '4 exercices',
  routineId: 'upper',
  canLaunchRoutine: true,
  openTarget: 'notebook',
  sportId: 'musculation',
  sessionKind: 'strength',
}

const TODAY_EMPTY: TodayHubCard = {
  cta: 'choose_activity',
  title: 'Aucune séance',
  sportLabel: 'Multisport',
  summaryLine: null,
  routineId: null,
  canLaunchRoutine: false,
  openTarget: 'activity',
  sportId: null,
  sessionKind: null,
}

const SUMMARY_OK: WeeklySummary = {
  filter: 'all',
  sessionCount: 2,
  metrics: [
    { id: 'sessions', label: 'Séances', value: 2, display: '2' },
    { id: 'active_min', label: 'Temps actif', value: 92, display: '92 min' },
  ],
}

const SUMMARY_EMPTY: WeeklySummary = {
  filter: 'all',
  sessionCount: 0,
  metrics: [
    { id: 'sessions', label: 'Séances', value: 0, display: '0' },
    { id: 'active_min', label: 'Temps actif', value: 0, display: '0 min' },
  ],
}

const LAST: RecentSessionItem = {
  id: 'n1',
  title: 'Développé couché',
  sportLabel: 'Musculation',
  dateLabel: 'Hier',
  summary: '4 exos · 16 séries · 52 min',
  note: {
    id: 'n1',
    title: 'Développé couché',
    dateKey: '2026-11-24',
    createdAt: Date.now(),
    durationMin: 52,
    estimatedKcal: 0,
    sessionKind: 'strength',
    sportId: 'musculation',
    exercises: [],
  },
}

export function TrainV2Fixture() {
  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const empty = params?.get('state') === 'empty'

  return (
    <div data-train-v2-fixture="1" data-state={empty ? 'empty' : 'normal'}>
      <AuthStateProvider value={buildAuthContextValue()}>
        <RestTimerProvider>
          <BleedOn />
          <AppLayout activeTab="training" onTabChange={() => undefined}>
            <TrainV2Hub
              today={empty ? TODAY_EMPTY : TODAY_OK}
              weekStrip={WEEK.map((d) =>
                empty ? { ...d, hasSession: false } : d,
              )}
              weeklySummary={empty ? SUMMARY_EMPTY : SUMMARY_OK}
              lastSession={empty ? null : LAST}
              onSettings={() => undefined}
              onStart={() => undefined}
              onOpenCreneau={() => undefined}
              onOpenLastSession={() => undefined}
            />
          </AppLayout>
        </RestTimerProvider>
      </AuthStateProvider>
    </div>
  )
}
